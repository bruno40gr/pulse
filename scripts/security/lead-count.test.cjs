/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic route tests. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')

function setup(options = {}) {
  const h = createHarness()
  const lead = (id, changes = {}) => ({ id, tenant_id: HEAD, intake_type: 'lesson_inquiry', source_form: 'website', status: 'new', created_at: new Date(Date.now() - 3600000).toISOString(), ...changes })
  h.setScenario({
    enforceRangeFilters: true,
    actor: options.anonymous ? undefined : { personId: 'staff', instructorId: null, displayName: 'Staff', access: { kind: 'demo', tenantId: HEAD } },
    fixtures: {
      tenants: [{ id: HEAD, is_demo: true }, { id: DEMO, is_demo: true }],
      lead_intakes: [lead('lesson'), lead('tour', { intake_type: 'tour_request' }), lead('service', { intake_type: 'service_inquiry' }),
        lead('existing-student-band', { intake_type: 'service_inquiry', person_id: 'student' }),
        lead('legacy-student-band', { intake_type: 'service_inquiry', source_form: 'contact-band-opportunity' }),
        lead('existing-student-lesson', { person_id: 'student' }),
        lead('expired-new', { created_at: new Date(Date.now() - 86400001).toISOString() }),
        lead('future-new', { created_at: new Date(Date.now() + 3600000).toISOString() }),
        lead('missing-date', { created_at: null }),
        lead('booked', { status: 'booked' }), lead('enrolling', { status: 'processing' }), lead('lost', { status: 'lost' }), lead('spam', { status: 'spam' }),
        lead('contacted', { status: 'contacted' }), lead('won', { status: 'won' }), lead('winback', { source_form: '2026-disenrollment-import' }), lead('job', { intake_type: 'job_application' }), lead('other-tenant', { tenant_id: DEMO })],
    },
    errors: options.error ? { lead_intakes: { message: 'Count unavailable' } } : {},
  })
  return { h, get: () => h.load('app/api/leads/route.ts').GET(new Request(`https://synthetic.invalid/api/leads?tenant=${HEAD}&count_only=1`)) }
}

test('sidebar counts only net-new names still New and less than 24 hours old in the authorized tenant', async () => {
  const { h, get } = setup()
  const response = await get()
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { count: 3, newCounts: { lesson_inquiry: 2, service_inquiry: 1 } })
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const queries = h.getQueries().filter(q => q.table === 'lead_intakes')
  assert.equal(queries.length, 2)
  for (const query of queries) {
    assert.ok(query.filters.some(f => f[0] === 'select' && f[2]?.head === true && f[2]?.count === 'exact'))
    assert.ok(query.filters.some(f => f[0] === 'is' && f[1] === 'person_id' && f[2] === null))
    assert.ok(query.filters.some(f => f[0] === 'neq' && f[1] === 'source_form' && f[2] === 'contact-band-opportunity'))
    assert.ok(query.filters.some(f => f[0] === 'eq' && f[1] === 'status' && f[2] === 'new'))
    assert.ok(query.filters.some(f => f[0] === 'gt' && f[1] === 'created_at'))
  }
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