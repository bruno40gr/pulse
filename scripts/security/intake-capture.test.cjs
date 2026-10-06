const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const queueId = '90000000-0000-0000-0000-000000000001'
const sample = { intake_type: 'lesson_inquiry', source_form: 'voice-form',
  full_name: ' Synthetic Applicant ', email: ' TEST@EXAMPLE.INVALID ',
  program_label: 'Private lessons', payload: { message: 'Synthetic inquiry' } }
function setup(extra = {}) {
  const h = createHarness()
  h.setScenario({ env: { ODEON_CRM_CALLBACK_MODE: 'capture' },
    rpcResults: { odeon_crm_capture: queueId }, ...extra })
  return { h, POST: h.load('app/api/intake/route.ts').POST }
}
function request(body = sample, key) {
  return new Request('https://synthetic.invalid/api/intake', { method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://website.example.invalid',
      ...(key === undefined ? {} : { 'idempotency-key': key }) }, body: JSON.stringify(body) })
}
test('capture acknowledges durable receipt, normalizes fields, and never accesses old CRM', async () => {
  const { h, POST } = setup()
  const response = await POST(request(sample, 'synthetic-submission-1'))
  assert.equal(response.status, 202)
  assert.deepEqual(await response.json(), { success: true, queued: true, receipt_id: queueId })
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://website.example.invalid')
  assert.equal(h.getQueries().length, 1)
  const capture = h.getWrites()[0]
  assert.equal(capture.database, 'primary')
  assert.equal(capture.table, 'odeon_crm_capture')
  assert.equal(capture.payload.p_tenant_id, HEAD)
  assert.equal(capture.payload.p_delivery_key, 'synthetic-submission-1')
  assert.equal(capture.payload.p_payload.email, 'test@example.invalid')
  assert.equal(capture.payload.p_payload.full_name, 'Synthetic Applicant')
  assert.equal(capture.payload.p_payload.payload.source, 'website')
})
test('older website clients can capture without a key; separate requests remain separate', async () => {
  const { h, POST } = setup()
  assert.equal((await POST(request())).status, 202)
  assert.equal((await POST(request())).status, 202)
  const keys = h.getWrites().map(q => q.payload.p_delivery_key)
  assert.notEqual(keys[0], keys[1])
})
test('capture failures do not acknowledge success or fall back to CRM', async () => {
  for (const extra of [{ rpcErrors: { odeon_crm_capture: { message: 'private synthetic failure' } } },
    { rpcResults: {} }]) {
    const { h, POST } = setup(extra)
    const response = await POST(request())
    assert.equal(response.status, 503)
    assert.ok(!(await response.text()).includes('private synthetic failure'))
    assert.ok(h.getQueries().every(q => q.database === 'primary'))
  }
})
test('foreign tenant, invalid key and invalid body refused before writes', async () => {
  for (const [body,key,status] of [[{ ...sample, tenant_id: DEMO },undefined,403],
    [sample,'key with spaces',400], [null,undefined,400], [[],undefined,400],
    [{ ...sample, email: null, phone: null },undefined,400]]) {
    const { h, POST } = setup()
    assert.equal((await POST(request(body,key))).status, status)
    assert.equal(h.getWrites().length, 0)
  }
})
test('phone-only application capture matches replay array handling', async () => {
  const { h, POST } = setup()
  assert.equal((await POST(request({ ...sample, intake_type: 'job_application', email: null,
    phone: '+12025550111', payload: { positions: ['Teacher',4], availability: 'invalid' } }))).status, 202)
  const payload = h.getWrites()[0].payload.p_payload.payload
  assert.deepEqual(Array.from(payload.positions), ['Teacher'])
  assert.deepEqual(Array.from(payload.availability), [])
})
test('invalid capture configuration fails closed without writes', async () => {
  const { h, POST } = setup({ env: { ODEON_CRM_CALLBACK_MODE: 'typo' } })
  assert.equal((await POST(request())).status, 503)
  assert.equal(h.getWrites().length, 0)
})
test('legacy mode retains immediate CRM inquiry response', async () => {
  const { h, POST } = setup({ env: {} })
  assert.equal((await POST(request())).status, 200)
  assert.ok(h.getWrites().some(q => q.table === 'lead_intakes' && q.database === 'crm'))
  assert.ok(h.getQueries().every(q => q.database === 'crm'))
})