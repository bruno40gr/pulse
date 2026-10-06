const test = require('node:test')
const assert = require('node:assert/strict')
const { getExpectedTwilioSignature } = require('twilio')
const { createHarness, DEMO } = require('./synthetic-harness.cjs')

const url = 'https://sms.example.invalid/api/twilio/webhook?source=test'
const token = 'synthetic-token-not-a-real-secret'
const params = { From: '+12025550111', To: '+12025550122', Body: 'STOP', MessageSid: `SM${'1'.repeat(32)}` }
function setup(fixtures = {}, errors = {}, extra = {}) {
  const h = createHarness()
  h.setScenario({ fixtures: { twilio_config: [{ phone_number: params.To, tenant_id: DEMO, auth_token: token }], ...fixtures }, errors, ...extra })
  return { h, POST: h.load('app/api/twilio/webhook/route.ts').POST }
}
function request(signature, values = params) {
  return new Request(url, { method: 'POST', body: new URLSearchParams(values),
    headers: signature ? { 'x-twilio-signature': signature } : {} })
}
test('unsigned and forged callbacks cannot write', async () => {
  for (const signature of [undefined, 'forged']) {
    const { h, POST } = setup()
    assert.equal((await POST(request(signature))).status, 403)
    assert.equal(h.getWrites().length, 0)
  }
})
test('unknown receiving number cannot write', async () => {
  const { h, POST } = setup({ twilio_config: [] })
  assert.equal((await POST(request('forged'))).status, 403)
  assert.equal(h.getWrites().length, 0)
})
test('signed STOP and START use the receiving number tenant', async () => {
  for (const body of ['STOP', 'START']) {
    const values = { ...params, Body: body }
    const { h, POST } = setup({ people: [{ id: 'synthetic-person', tenant_id: DEMO }] })
    const signature = getExpectedTwilioSignature(token, url, values)
    assert.equal((await POST(request(signature, values))).status, 200)
    const writes = h.getWrites()
    const consent = writes.find(q => q.table === 'people')
    assert.equal(consent.payload.opted_out, body === 'STOP')
    assert.ok(consent.filters.some(([method, key, value]) => method === 'eq' && key === 'tenant_id' && value === DEMO))
    assert.equal(writes.find(q => q.table === 'messages').payload.tenant_id, DEMO)
  }
})
test('storage failure is not acknowledged as success', async () => {
  const { POST } = setup({}, { messages: { code: 'XX000', message: 'synthetic failure' } })
  assert.equal((await POST(request(getExpectedTwilioSignature(token, url, params)))).status, 503)
})
test('lookup and history failures are not silently acknowledged', async () => {
  for (const table of ['twilio_config', 'messages', 'people', 'crm_contacts', 'lead_events']) {
    const { POST } = setup({ crm_contacts: [{ id: 'synthetic-crm', tenant_id: DEMO }],
      lead_intakes: [{ id: 'synthetic-lead', tenant_id: DEMO, contact_id: 'synthetic-crm' }] },
    { [table]: { code: 'XX000', message: 'synthetic private error' } })
    const response = await POST(request(getExpectedTwilioSignature(token, url, params)))
    assert.equal(response.status, 503, table)
    assert.ok(!(await response.text()).includes('synthetic private error'))
  }
})
test('signed filter metacharacters in a phone number are rejected before writes', async () => {
  const values = { ...params, From: '+12025550111,tenant_id.neq.other' }
  const { h, POST } = setup()
  assert.equal((await POST(request(getExpectedTwilioSignature(token, url, values), values))).status, 400)
  assert.equal(h.getWrites().length, 0)
})
test('capture mode validates signature, captures then persists, and never writes old CRM', async () => {
  const { h, POST } = setup({}, {}, { env: { ODEON_CRM_CALLBACK_MODE: 'capture' },
    rpcResults: { odeon_crm_capture: '90000000-0000-0000-0000-000000000001' } })
  assert.equal((await POST(request('forged'))).status, 403)
  assert.equal(h.getWrites().length, 0)
  assert.equal((await POST(request(getExpectedTwilioSignature(token, url, params)))).status, 200)
  assert.deepEqual(h.getWrites().map(q => q.table), ['odeon_crm_capture','odeon_crm_persist_captured_sms'])
  assert.ok(h.getWrites().every(q => q.database === 'primary'))
  assert.equal(h.getWrites()[0].payload.p_tenant_id, DEMO)
})
test('capture or persistence failure never falls back to legacy writes', async () => {
  for (const rpc of ['odeon_crm_capture','odeon_crm_persist_captured_sms']) {
    const { h, POST } = setup({}, {}, { env: { ODEON_CRM_CALLBACK_MODE: 'capture' },
      rpcResults: { odeon_crm_capture: '90000000-0000-0000-0000-000000000001' },
      rpcErrors: { [rpc]: { message: 'synthetic failure' } } })
    assert.equal((await POST(request(getExpectedTwilioSignature(token, url, params)))).status, 503)
    assert.ok(h.getWrites().every(q => q.operation === 'rpc' && q.database === 'primary'))
  }
})
test('invalid callback mode refuses processing', async () => {
  const { h, POST } = setup({}, {}, { env: { ODEON_CRM_CALLBACK_MODE: 'typo' } })
  assert.equal((await POST(request(getExpectedTwilioSignature(token, url, params)))).status, 503)
  assert.equal(h.getWrites().length, 0)
})