/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic regression tests. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')

test('lifecycle tabs partition lesson, tour and service inquiries without changing records', async () => {
  const h = createHarness()
  const lead = (id, intake_type, status, source_form = 'manual') => ({ id, tenant_id: HEAD, intake_type, status, source_form, created_at: '2026-10-01T00:00:00Z', payload: {} })
  h.setScenario({ actor: { personId: 'staff', instructorId: null, displayName: 'Staff', access: { kind: 'demo', tenantId: HEAD } }, fixtures: { tenants: [{ id: HEAD, is_demo: true }], lead_intakes: [
    lead('lesson-open', 'lesson_inquiry', 'contacted'), lead('service-open', 'service_inquiry', 'new'),
    lead('lesson-won', 'lesson_inquiry', 'won'), lead('service-won', 'service_inquiry', 'won'), lead('tour-won', 'tour_request', 'won'),
    lead('lost', 'lesson_inquiry', 'lost'), lead('ghost', 'service_inquiry', 'ghosted_us'),
    lead('former', 'lesson_inquiry', 'lost', '2026-disenrollment-import'),
    { ...lead('foreign', 'service_inquiry', 'won'), tenant_id: DEMO },
  ] } })
  const expected = { lesson_inquiry: ['lesson-open'], service_inquiry: ['service-open'], enrolled: ['lesson-won', 'service-won', 'tour-won'], lost: ['ghost', 'lost'], winback: ['former'] }
  for (const [tab, ids] of Object.entries(expected)) {
    const response = await h.load('app/api/leads/route.ts').GET(new Request(`https://synthetic.invalid/api/leads?tenant=${HEAD}&intake_type=${tab}&include_counts=1`))
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.deepEqual(data.leads.map(lead => lead.id).sort(), ids.sort())
    for (const [key, rows] of Object.entries(expected)) assert.equal(data.counts[key], rows.length)
  }
  assert.equal(h.getWrites().length, 0)
})

test('detail membership follows lifecycle tabs including service wins and ghosts', () => {
  const { leadBelongsToTab } = createHarness().load('lib/lead-lesson-details.ts')
  for (const intake_type of ['lesson_inquiry', 'tour_request', 'service_inquiry']) {
    assert.equal(leadBelongsToTab({ intake_type, status: 'won' }, 'enrolled'), true)
    assert.equal(leadBelongsToTab({ intake_type, status: 'lost' }, 'lost'), true)
    assert.equal(leadBelongsToTab({ intake_type, status: 'ghosted_us' }, 'lost'), true)
    assert.equal(leadBelongsToTab({ intake_type, status: 'won' }, intake_type === 'service_inquiry' ? intake_type : 'lesson_inquiry'), false)
  }
  assert.equal(leadBelongsToTab({ intake_type: 'job_application', status: 'won' }, 'enrolled'), false)
})