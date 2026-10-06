const test = require('node:test')
const assert = require('node:assert/strict')
const { getExpectedTwilioSignature } = require('twilio')
const { createHarness, DEMO } = require('./synthetic-harness.cjs')

const url = 'https://voice.example.invalid/api/calls/status'
const token = 'synthetic-voice-token'
const params = { From: '+12025550122', AccountSid: `AC${'1'.repeat(32)}`,
  CallSid: `CA${'2'.repeat(32)}`, CallStatus: 'completed', CallDuration: '42', SequenceNumber: '3' }
function setup(extra = {}) {
  const h = createHarness()
  h.setScenario({ fixtures: { twilio_config: [{ tenant_id: DEMO, phone_number: params.From,
    auth_token: token, account_sid: params.AccountSid }] },
    env: { ODEON_CRM_CALLBACK_MODE: 'capture' },
    rpcResults: { odeon_crm_capture: '90000000-0000-0000-0000-000000000001' }, ...extra })
  return { h, POST: h.load('app/api/calls/status/route.ts').POST }
}
function request(values = params, signature = getExpectedTwilioSignature(token, url, values)) {
  return new Request(url, { method: 'POST', body: new URLSearchParams(values),
    headers: { 'x-twilio-signature': signature } })
}
test('unsigned or forged voice callbacks cannot write', async () => {
  for (const signature of ['', 'forged']) {
    const { h, POST } = setup()
    assert.equal((await POST(request(params, signature))).status, 403)
    assert.equal(h.getWrites().length, 0)
  }
})
test('signed voice status captures tenant, sequence and duration without CRM writes', async () => {
  const { h, POST } = setup()
  assert.equal((await POST(request())).status, 200)
  const writes = h.getWrites()
  assert.equal(writes.length, 1)
  assert.equal(writes[0].table, 'odeon_crm_capture')
  assert.equal(writes[0].database, 'primary')
  // Normalize objects created in the harness VM before strict prototype comparison.
  assert.deepEqual(JSON.parse(JSON.stringify(writes[0].payload)), { p_tenant_id: DEMO, p_kind: 'voice_status',
    p_delivery_key: `${params.CallSid}:3`,
    p_payload: { call_sid: params.CallSid, status: 'completed', duration: 42, sequence: 3 } })
})
test('foreign account or invalid sequence cannot write', async () => {
  for (const values of [{ ...params, AccountSid: `AC${'9'.repeat(32)}` },
    { ...params, SequenceNumber: '-1' }]) {
    const { h, POST } = setup()
    assert.ok([400,403].includes((await POST(request(values))).status))
    assert.equal(h.getWrites().length, 0)
  }
})
test('failed durable voice capture returns retryable failure with no legacy fallback', async () => {
  const { h, POST } = setup({ rpcErrors: { odeon_crm_capture: { message: 'private synthetic error' } } })
  const response = await POST(request())
  assert.equal(response.status, 503)
  assert.ok(!(await response.text()).includes('private synthetic error'))
  assert.deepEqual(h.getWrites().map(q => q.table), ['odeon_crm_capture'])
})
test('legacy signed callback reads and updates history in configured CRM, scoped to tenant', async () => {
  const { h, POST } = setup({ env: { ODEON_CRM_CALLBACK_MODE: 'legacy' }, fixtures: {
    twilio_config: [{ tenant_id: DEMO, phone_number: params.From, auth_token: token, account_sid: params.AccountSid }],
    lead_events: [{ id: 'synthetic-event', tenant_id: DEMO, event_type: 'call_started',
      'payload->>call_sid': params.CallSid, payload: { retained: 'synthetic' } }],
  } })
  assert.equal((await POST(request())).status, 200)
  const update = h.getWrites()[0]
  assert.equal(update.database, 'crm')
  assert.equal(update.payload.payload.retained, 'synthetic')
  assert.ok(update.filters.some(([method,key,value]) => method === 'eq' && key === 'tenant_id' && value === DEMO))
})