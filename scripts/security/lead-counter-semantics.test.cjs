/* eslint-disable @typescript-eslint/no-require-imports -- Offline count/list parity fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
function setup() {
  const h = createHarness()
  const row = (id, patch = {}) => ({ id, tenant_id: HEAD, intake_type: 'service_inquiry', source_form: 'website', status: 'new', created_at: '2026-11-20T00:00:00Z', payload: {}, ...patch })
  h.setScenario({ actor: { access: { kind: 'demo', tenantId: HEAD } }, fixtures: { lead_intakes: [
    row('service-one'), row('service-two'), row('service-three'),
    ...Array.from({ length: 7 }, (_, index) => row(`band-${index}`, { person_id: `person-${index}`, source_form: 'contact-band-opportunity', payload: { service_type: 'band' } })),
    row('legacy-band', { source_form: 'contact-band-opportunity' }),
    row('contacted', { status: 'contacted' }), row('enrolled', { status: 'won' }), row('lost', { status: 'lost' }),
    row('winback', { source_form: '2026-disenrollment-import' }), row('foreign', { tenant_id: DEMO }),
    row('lesson', { intake_type: 'lesson_inquiry' }), row('tour', { intake_type: 'tour_request' }),
  ] } })
  return { h, get: query => h.load('app/api/leads/route.ts').GET(new Request(`https://synthetic.invalid/api/leads?tenant=${HEAD}&${query}`)) }
}
test('service total includes all current-student band leads, not just three external inquiries', async () => {
  const { get } = setup()
  const summary = await (await get('summary_only=1')).json()
  assert.equal(summary.counts.service_inquiry, 12)
  const rows = await (await get('intake_type=service_inquiry&include_activity=0')).json()
  assert.equal(rows.length, summary.counts.service_inquiry)
  assert.equal(rows.filter(row => row.source_form === 'contact-band-opportunity').length, 8)
  assert.equal(summary.newCounts.service_inquiry, 3)
  assert.equal(summary.newCounts.lesson_inquiry, 2)
  const notification = await (await get('count_only=1')).json()
  assert.equal(notification.count, 5)
  assert.deepEqual(notification.newCounts, summary.newCounts)
})
test('list filters change tab totals without changing unprocessed net-new notification counts', async () => {
  const { get } = setup()
  const summary = await (await get('summary_only=1&status=contacted')).json()
  assert.equal(summary.counts.service_inquiry, 1)
  assert.equal(summary.newCounts.service_inquiry, 3)
  assert.equal(summary.newCounts.lesson_inquiry, 2)
})