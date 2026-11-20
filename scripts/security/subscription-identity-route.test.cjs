/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic route fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const route = 'app/odeon-demo/subscription-review/route.ts'
const file = 'subscriptions_report_November_19,_2026_7_47_AM_PST.csv'
function setup(options = {}) {
  const h = createHarness()
  h.setScenario({ env: { NODE_ENV: 'development', LOCAL_BAND_REVIEW_DIR: '/synthetic', LOCAL_BAND_REVIEW_TENANT_ID: HEAD },
    actor: options.anonymous ? null : { personId: 'viewer', displayName: 'Viewer' },
    syntheticFiles: { [file]: options.csv ?? 'Client Id,Client Name,Status\na,Alex,Active\na,Alex,Ended\nb,Bella,Pending\n' },
    fixtures: { tenant_memberships: [{ id: 'm', tenant_id: HEAD, person_id: 'viewer', role_id: 'r', legacy_access_enabled: true, status: 'unclaimed' }], roles: [{ id: 'r', tenant_id: HEAD, key: 'owner' }],
      people: [{ id: 'p', tenant_id: HEAD, custom_fields: { external_id: 'a' } }, { id: 'foreign', tenant_id: DEMO, custom_fields: { external_id: 'b' } }],
      students: [{ id: 's', person_id: 'p', tenant_id: HEAD }] }, errors: options.errors || {} })
  return h
}
const request = () => new Request(`http://127.0.0.1:3250/odeon-demo/subscription-review?tenant=${HEAD}`, { headers: { host: '127.0.0.1:3250' } })
test('reviews only active and pending rows with tenant-scoped exact IDs and no writes', async () => {
  const h = setup(), response = await h.load(route).GET(request()), data = await response.json()
  assert.equal(response.status, 200); assert.equal(data.clients, 2); assert.equal(data.subscriptions, 2)
  assert.equal(data.counts.matched, 1); assert.equal(data.counts.no_person, 1); assert.deepEqual(data.review[0].names, ['Bella'])
  for (const q of h.getQueries().filter(q => ['people', 'students'].includes(q.table))) assert.ok(q.filters.some(f => f[0] === 'eq' && f[1] === 'tenant_id' && f[2] === HEAD))
  assert.equal(h.getWrites().length, 0)
})
test('denies anonymous access and fails closed for bad CSV or database failure', async () => {
  for (const [options, status] of [[{ anonymous: true }, 401], [{ csv: 'bad,header\nx,y\n' }, 503], [{ errors: { students: { message: 'offline' } } }, 503]]) {
    const h = setup(options), response = await h.load(route).GET(request())
    assert.equal(response.status, status); assert.equal(h.getWrites().length, 0)
  }
})