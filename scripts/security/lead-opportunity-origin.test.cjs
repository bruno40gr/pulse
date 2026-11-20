/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const route = 'app/api/leads/route.ts'
const lead = (id, person = null, tenant = HEAD) => ({ id, tenant_id: tenant, contact_id: null, person_id: person, intake_type: 'lesson_inquiry', source_system: 'pulse-manual', source_form: 'contact-band-opportunity', source_page: null, program_label: 'Band', service_label: null, category: 'Lesson requests', status: 'new', priority: 'normal', temperature: 'warm', payload: { student_name: 'Ada Lovelace' }, created_at: '2026-11-19T10:00:00Z', updated_at: '2026-11-19T10:00:00Z' })
function setup(options = {}) {
  const h = createHarness()
  h.setScenario({ actor: { access: { kind: 'demo', tenantId: HEAD } },
    fixtures: {
      lead_intakes: [lead('l1', 'p1'), lead('l3'), lead('l2', 'p9', DEMO)],
      people: [{ id: 'p1', tenant_id: HEAD, first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.invalid', phone: null }],
    }, errors: options.errors || {} })
  return h
}
const request = () => new Request(`https://synthetic.invalid/api/leads?tenant=${HEAD}&intake_type=lesson_inquiry&include_activity=0`)
test('an opportunity about a person reuses that person instead of a cloned contact', async () => {
  const h = setup()
  const response = await h.load(route).GET(request())
  assert.equal(response.status, 200)
  const byId = new Map((await response.json()).map(row => [row.id, row]))
  assert.equal(byId.get('l1').opportunity_origin, 'existing_student')
  assert.equal(byId.get('l1').linked_person_id, 'p1')
  assert.equal(byId.get('l1').contact.full_name, 'Ada Lovelace')
  assert.equal(byId.get('l1').contact.id, 'p1')
  assert.equal(byId.get('l3').opportunity_origin, 'new_lead')
  assert.equal(byId.get('l3').linked_person_id, null)
  const personReads = h.getQueries().filter(q => q.table === 'people')
  assert.equal(personReads.length, 1)
  assert.ok(personReads[0].filters.some(filter => filter[0] === 'eq' && filter[1] === 'tenant_id' && filter[2] === HEAD))
  assert.equal(h.getWrites().length, 0)
})
test('a failed person lookup reports unknown instead of guessing', async () => {
  const h = setup({ errors: { people: { message: 'offline' } } })
  const response = await h.load(route).GET(request())
  assert.equal(response.status, 200)
  assert.ok((await response.json()).every(row => row.opportunity_origin === 'unknown' && row.linked_person_id === null))
})
test('other tenants never inherit this account people', async () => {
  const h = setup()
  const rows = await (await h.load(route).GET(request())).json()
  assert.equal(rows.some(row => row.id === 'l2'), false)
})
