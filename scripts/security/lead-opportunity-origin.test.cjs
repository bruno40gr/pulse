/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const route = 'app/api/leads/route.ts'
const lead = (id, tenant = HEAD) => ({ id, tenant_id: tenant, contact_id: 'c' + id, intake_type: 'lesson_inquiry', source_system: 'pulse-manual', source_form: 'manual-phone-call', source_page: null, program_label: 'Band', service_label: null, category: 'Lesson requests', status: 'new', priority: 'normal', temperature: 'warm', payload: {}, created_at: '2026-11-19T10:00:00Z', updated_at: '2026-11-19T10:00:00Z' })
function setup(options = {}) {
  const h = createHarness()
  h.setScenario({ actor: { access: { kind: 'demo', tenantId: HEAD } },
    fixtures: {
      lead_intakes: [lead('l1'), lead('l3'), lead('l2', DEMO)],
      contact_band_opportunity_links: [{ tenant_id: HEAD, lead_id: 'l1', person_id: 'p1' }, { tenant_id: DEMO, lead_id: 'l2', person_id: 'p9' }],
    }, errors: options.errors || {} })
  return h
}
const request = () => new Request(`https://synthetic.invalid/api/leads?tenant=${HEAD}&intake_type=lesson_inquiry&include_activity=0`)
test('an opportunity linked to a contact is marked as an existing student', async () => {
  const h = setup()
  const response = await h.load(route).GET(request())
  assert.equal(response.status, 200)
  const rows = await response.json()
  const byId = new Map(rows.map(row => [row.id, row]))
  assert.equal(byId.get('l1').opportunity_origin, 'existing_student')
  assert.equal(byId.get('l1').linked_person_id, 'p1')
  assert.equal(byId.get('l3').opportunity_origin, 'new_lead')
  assert.equal(byId.get('l3').linked_person_id, null)
  for (const query of h.getQueries().filter(q => q.table === 'contact_band_opportunity_links')) {
    assert.ok(query.filters.some(filter => filter[0] === 'eq' && filter[1] === 'tenant_id' && filter[2] === HEAD))
  }
  assert.equal(h.getWrites().length, 0)
})
test('a failed link lookup reports unknown instead of claiming net-new or existing', async () => {
  const h = setup({ errors: { contact_band_opportunity_links: { message: 'offline' } } })
  const response = await h.load(route).GET(request())
  assert.equal(response.status, 200)
  assert.ok((await response.json()).every(row => row.opportunity_origin === 'unknown' && row.linked_person_id === null))
})
test('other tenants never inherit a link from this account', async () => {
  const h = setup()
  const rows = await (await h.load(route).GET(request())).json()
  assert.equal(rows.some(row => row.id === 'l2'), false)
})
