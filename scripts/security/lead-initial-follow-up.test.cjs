/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic fixtures. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')
const h = createHarness()
const { withInitialLeadFollowUp } = h.load('lib/lead-initial-follow-up.ts')
const { getFollowUpTone } = h.load('lib/follow-up.ts')
const { formatPhoneNumber, toE164PhoneNumber } = h.load('lib/phone.ts')

test('new inquiries get a first reminder due the day they arrive, including near midnight', () => {
  for (const type of ['lesson_inquiry', 'service_inquiry', 'band_inquiry', 'general_inquiry']) {
    for (const time of ['2026-11-03T00:01:00-08:00', '2026-11-03T23:59:00-08:00']) {
      const received = new Date(time)
      const payload = withInitialLeadFollowUp({ student_name: 'Keep student' }, type, received.toISOString())
      assert.equal(payload.follow_up_at, received.toISOString())
      assert.equal(payload.follow_up_note, 'First follow-up')
      assert.equal(payload.student_name, 'Keep student')
      assert.equal(getFollowUpTone(payload.follow_up_at, received).urgency, 'today')
    }
  }
})

test('explicit reminders, cleared reminders and job applications are not overridden', () => {
  for (const date of [null, '2026-11-07T18:00:00.000Z']) {
    const payload = { follow_up_at: date, follow_up_note: 'Keep existing note' }
    assert.equal(withInitialLeadFollowUp(payload, 'lesson_inquiry'), payload)
  }
  const application = { positions: ['Teacher'] }
  assert.equal(withInitialLeadFollowUp(application, 'job_application'), application)
})

for (const capture of [false, true]) test(`intake persists initial reminder in ${capture ? 'durable capture' : 'immediate CRM'} mode`, async () => {
  const harness = createHarness()
  harness.setScenario({ env: capture ? { ODEON_CRM_CALLBACK_MODE: 'capture' } : {}, rpcResults: { odeon_crm_capture: 'receipt' } })
  const before = Date.now()
  const response = await harness.load('app/api/intake/route.ts').POST(new Request('https://synthetic.invalid/api/intake', {
    method: 'POST', body: JSON.stringify({ tenant_id: HEAD, intake_type: 'lesson_inquiry', source_form: 'manual-other', full_name: 'Sample Contact', email: 'sample@example.invalid' }),
  }))
  assert.equal(response.status, capture ? 202 : 200)
  const write = harness.getWrites().find(row => row.table === (capture ? 'odeon_crm_capture' : 'lead_intakes'))
  const payload = capture ? write.payload.p_payload.payload : write.payload.payload
  assert.ok(Date.parse(payload.follow_up_at) >= before)
  assert.ok(Date.parse(payload.follow_up_at) <= Date.now())
  assert.equal(payload.follow_up_note, 'First follow-up')
})

test('shared display omits US country code but delivery and international numbers stay intact', () => {
  assert.equal(formatPhoneNumber('+19162571078'), '(916) 257-1078')
  assert.equal(formatPhoneNumber('19162571078 ext 12'), '(916) 257-1078 ext. 12')
  assert.equal(formatPhoneNumber('9162571078'), '(916) 257-1078')
  assert.equal(formatPhoneNumber('+44 20 1234 5678'), '+44 20 1234 5678')
  assert.equal(toE164PhoneNumber('(916) 257-1078'), '+19162571078')
})