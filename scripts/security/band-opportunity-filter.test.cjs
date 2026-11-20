/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic route fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')

function setup() {
  const h = createHarness()
  h.setScenario({ actor: { access: { kind: 'demo', tenantId: HEAD } }, fixtures: {} })
  return h
}

test('band scope queries the same tenant-scoped opportunity table with explicit metadata', async () => {
  const h = setup()
  const response = await h.load('app/api/leads/route.ts').GET(new Request(`https://synthetic.invalid/api/leads?tenant=${HEAD}&intake_type=lesson_inquiry&band_scope=1&include_activity=0`))
  assert.equal(response.status, 200)
  const query = h.getQueries().find(item => item.table === 'lead_intakes')
  assert.equal(query.database, 'crm')
  assert.ok(query.filters.some(([method, field, value]) => method === 'eq' && field === 'tenant_id' && value === HEAD))
  assert.ok(query.filters.some(([method, field, value]) => method === 'eq' && field === 'payload->>service_type' && value === 'band'))
  assert.ok(query.filters.some(([method, field, value]) => method === 'in' && field === 'intake_type' && value.includes('service_inquiry') && value.includes('lesson_inquiry')))
  assert.equal(h.getWrites().length, 0)
})

test('invalid filters and cross-tenant requests fail before lead reads', async () => {
  for (const suffix of ['band_scope=bad', 'band_scope=1&band_id=unassigned', 'band_scope=1&intake_type=job_application']) {
    const h = setup()
    const response = await h.load('app/api/leads/route.ts').GET(new Request(`https://synthetic.invalid/api/leads?tenant=${HEAD}&${suffix}`))
    assert.equal(response.status, 400)
    assert.equal(h.getQueries().some(item => item.table === 'lead_intakes'), false)
  }
  const h = setup()
  const response = await h.load('app/api/leads/route.ts').GET(new Request(`https://synthetic.invalid/api/leads?tenant=${DEMO}&band_scope=1`))
  assert.equal(response.status, 403)
  assert.equal(h.getQueries().some(item => item.table === 'lead_intakes'), false)
})