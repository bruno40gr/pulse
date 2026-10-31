/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic route tests. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')

function setup(options = {}) {
  const h = createHarness()
  const lead = (id, changes = {}) => ({ id, tenant_id: HEAD, intake_type: 'lesson_inquiry', source_form: 'website', status: 'new', ...changes })
  h.setScenario({
    actor: options.anonymous ? undefined : { personId: 'staff', instructorId: null, displayName: 'Staff', access: { kind: 'demo', tenantId: HEAD } },
    fixtures: {
      tenants: [{ id: HEAD, is_demo: true }, { id: DEMO, is_demo: true }],
      lead_intakes: [lead('lesson'), lead('tour', { intake_type: 'tour_request' }), lead('service', { intake_type: 'service_inquiry' }), lead('contacted', { status: 'contacted' }), lead('won', { status: 'won' }), lead('winback', { source_form: '2026-disenrollment-import' }), lead('job', { intake_type: 'job_application' }), lead('other-tenant', { tenant_id: DEMO })],
    },
    errors: options.error ? { lead_intakes: { message: 'Count unavailable' } } : {},
  })
  return { h, get: () => h.load('app/api/leads/route.ts').GET(new Request(`https://synthetic.invalid/api/leads?tenant=${HEAD}&count_only=1`)) }
}

test('sidebar count includes only new inquiries in the authorized tenant', async () => {
  const { h, get } = setup()
  const response = await get()
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { count: 3 })
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const queries = h.getQueries().filter(q => q.table === 'lead_intakes')
  assert.equal(queries.length, 1)
  assert.ok(queries[0].filters.some(f => f[0] === 'select' && f[2]?.head === true && f[2]?.count === 'exact'))
  assert.equal(h.getWrites().length, 0)
})

test('anonymous requests cannot read the sidebar lead count', async () => {
  const { h, get } = setup({ anonymous: true })
  assert.equal((await get()).status, 401)
  assert.equal(h.getQueries().filter(q => q.table === 'lead_intakes').length, 0)
})

test('count failures return an error rather than a misleading zero', async () => {
  const { get } = setup({ error: true })
  assert.equal((await get()).status, 500)
})