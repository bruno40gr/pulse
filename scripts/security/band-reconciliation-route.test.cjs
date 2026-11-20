/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic route tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const route = 'app/odeon-demo/band-review-reconciliation/route.ts'
const files = {
  'attendance_report_November_19,_2026_7_50_AM_PST.csv': 'Client Id,Client Name\n',
  'subscriptions_report_November_19,_2026_7_47_AM_PST.csv': 'Client Id,Client Name\n',
  'Band interest spreedsheet - Sheet1.csv': 'Name,Age,Instrument\nAlex Test,10,guitar\n',
}
function setup(options = {}) {
  const h = createHarness()
  const grants = options.grants || ['contacts.read', 'leads.read']
  h.setScenario({ env: { NODE_ENV: options.env || 'development', LOCAL_BAND_REVIEW_DIR: '/synthetic', LOCAL_BAND_REVIEW_TENANT_ID: options.configuredTenant ?? HEAD }, syntheticFiles: files,
    actor: options.actor === false ? undefined : { personId: 'viewer', displayName: 'Viewer' },
    fixtures: {
      tenant_memberships: [{ id: 'm', tenant_id: HEAD, person_id: 'viewer', role_id: 'r', legacy_access_enabled: true, status: 'unclaimed' }],
      roles: [{ id: 'r', tenant_id: HEAD, key: 'staff' }], permissions: grants.map(key => ({ id: key, key })),
      role_permissions: grants.map(key => ({ role_id: 'r', permission_id: key })),
      people: [{ id: 'p', tenant_id: HEAD, first_name: 'Alex', last_name: 'Test' }, { id: 'other', tenant_id: DEMO, first_name: 'Alex', last_name: 'Test' }],
      lead_intakes: [{ id: 'o', tenant_id: HEAD, intake_type: 'lesson_inquiry', program_label: 'Band', payload: { student_name: 'Alex Test' } }],
    }, errors: options.errors || {}, queryResult: options.queryResult,
  })
  return h
}
const request = (query = HEAD, host = '127.0.0.1:3250') => new Request(`http://127.0.0.1:3250/odeon-demo/band-review-reconciliation?tenant=${query}`, { headers: { host } })

test('returns only reviewed-name suggestions from the authorized tenant without writes', async () => {
  const h = setup(); const response = await h.load(route).GET(request())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { matches: [{ candidateId: 'candidate-0', personIds: ['p'], opportunityIds: ['o'], matchType: 'name_only', requiresReview: true }] })
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(h.getWrites().length, 0)
  for (const q of h.getQueries().filter(q => ['people', 'lead_intakes'].includes(q.table))) assert.ok(q.filters.some(f => f[0] === 'eq' && f[1] === 'tenant_id' && f[2] === HEAD))
})

test('checks service opportunities as well as lesson inquiries', async () => {
  const h = setup(); const response = await h.load(route).GET(request())
  assert.equal(response.status, 200)
  const query = h.getQueries().find(q => q.table === 'lead_intakes')
  assert.ok(query.filters.some(([op, column, values]) => op === 'in' && column === 'intake_type' && values.includes('service_inquiry') && values.includes('lesson_inquiry')))
  assert.equal(h.getWrites().length, 0)
})

test('rejects untrusted host, production, anonymous, other tenant, and missing permissions', async () => {
  for (const [options, req, expected] of [
    [{}, request(HEAD, 'example.com'), 404], [{ env: 'production' }, request(), 404],
    [{ configuredTenant: '' }, request(), 404], [{ configuredTenant: DEMO }, request(), 403],
    [{ actor: false }, request(), 401], [{}, request(DEMO), 403],
    [{ grants: ['contacts.read'] }, request(), 403], [{ grants: ['leads.read'] }, request(), 403],
  ]) {
    const h = setup(options); const response = await h.load(route).GET(req)
    assert.equal(response.status, expected)
    assert.equal(h.getQueries().some(q => ['people', 'lead_intakes'].includes(q.table)), false)
    assert.equal(h.getWrites().length, 0)
  }
})

test('database errors fail closed instead of returning incomplete results', async () => {
  const h = setup({ errors: { lead_intakes: { message: 'unavailable' } } })
  const response = await h.load(route).GET(request())
  assert.equal(response.status, 503)
  assert.equal(h.getWrites().length, 0)
})

test('null database pages fail closed', async () => {
  for (const table of ['people', 'lead_intakes']) {
    const h = setup({ queryResult: q => q.table === table ? { data: null, error: null } : undefined })
    const response = await h.load(route).GET(request())
    assert.equal(response.status, 503)
    assert.equal(h.getWrites().length, 0)
  }
})

test('CSV endpoint requires both permissions and the configured tenant', async () => {
  const dataRoute = 'app/odeon-demo/band-review-data/route.ts'
  for (const [options, req, expected] of [
    [{}, request(), 200], [{ actor: false }, request(), 401],
    [{ grants: ['contacts.read'] }, request(), 403], [{ grants: ['leads.read'] }, request(), 403],
    [{ configuredTenant: DEMO }, request(), 403], [{ configuredTenant: '' }, request(), 404],
    [{}, request(HEAD, 'example.com'), 404], [{ env: 'production' }, request(), 404],
  ]) {
    const h = setup(options); const response = await h.load(dataRoute).GET(req)
    assert.equal(response.status, expected)
    assert.equal(h.getWrites().length, 0)
  }
})

test('reads every page of both stores before reconciling', async () => {
  const h = createHarness()
  const people = Array.from({ length: 501 }, (_, index) => ({ id: `p${index}`, first_name: index === 500 ? 'Alex' : 'Other', last_name: index === 500 ? 'Test' : String(index) }))
  const leads = Array.from({ length: 501 }, (_, index) => ({ id: `o${index}`, program_label: 'Band', payload: { student_name: index === 500 ? 'Alex Test' : `Other ${index}` } }))
  h.setScenario({ env: { NODE_ENV: 'development', LOCAL_BAND_REVIEW_DIR: '/synthetic', LOCAL_BAND_REVIEW_TENANT_ID: HEAD }, syntheticFiles: files,
    actor: { personId: 'viewer', displayName: 'Viewer' },
    fixtures: { tenant_memberships: [{ id: 'm', tenant_id: HEAD, person_id: 'viewer', role_id: 'r', legacy_access_enabled: true, status: 'unclaimed' }], roles: [{ id: 'r', tenant_id: HEAD, key: 'owner' }], role_permissions: [] },
    queryResult({ table, operation, filters }) {
      if (operation !== 'select' || !['people', 'lead_intakes'].includes(table)) return
      const range = filters.find(filter => filter[0] === 'range')
      return { data: (table === 'people' ? people : leads).slice(range[1], range[2] + 1), error: null }
    },
  })
  const response = await h.load(route).GET(request())
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.deepEqual(result.matches[0].personIds, ['p500'])
  assert.deepEqual(result.matches[0].opportunityIds, ['o500'])
  assert.equal(h.getQueries().filter(q => q.table === 'people').length, 2)
  assert.equal(h.getQueries().filter(q => q.table === 'lead_intakes').length, 2)
  assert.equal(h.getWrites().length, 0)
})