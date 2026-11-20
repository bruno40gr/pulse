/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const route = 'app/api/bands/candidates/route.ts'
function setup(options = {}) {
  const h = createHarness()
  h.setScenario({ env: { ENABLE_CONTACT_BAND_OPPORTUNITIES: options.disabled ? 'false' : 'true' },
    actor: options.anonymous ? null : { personId: 'viewer', displayName: 'Viewer' },
    fixtures: {
      tenant_memberships: [{ id: 'm', tenant_id: HEAD, person_id: 'viewer', role_id: 'r', legacy_access_enabled: true, status: 'unclaimed' }],
      roles: [{ id: 'r', tenant_id: HEAD, key: options.noPermission ? 'staff' : 'owner' }], role_permissions: [],
      lead_intakes: [
        { id: 'l1', tenant_id: HEAD, person_id: 'p1', intake_type: 'service_inquiry', status: 'new', payload: { service_type: 'band' }, 'payload->>service_type': 'band' },
        { id: 'l2', tenant_id: HEAD, person_id: 'p2', intake_type: 'service_inquiry', status: 'won', payload: { service_type: 'band' }, 'payload->>service_type': 'band' },
        { id: 'l3', tenant_id: HEAD, person_id: null, intake_type: 'service_inquiry', status: 'new', payload: { service_type: 'band' }, 'payload->>service_type': 'band' },
        { id: 'l4', tenant_id: DEMO, person_id: 'p9', intake_type: 'service_inquiry', status: 'new', payload: { service_type: 'band' }, 'payload->>service_type': 'band' },
      ],
      people: [{ id: 'p1', tenant_id: HEAD, first_name: 'Ada', last_name: 'Lovelace' }, { id: 'p2', tenant_id: HEAD, first_name: 'Bo', last_name: 'Chen' }],
    }, errors: options.errors || {} })
  return h
}
const request = (tenant = HEAD) => new Request(`https://synthetic.invalid/api/bands/candidates?tenant=${tenant}`)
test('students seeking a band are the prospects for any band', async () => {
  const h = setup(), response = await h.load(route).GET(request())
  assert.equal(response.status, 200)
  assert.deepEqual(Array.from((await response.json()).prospects, row => row.name), ['Ada Lovelace'])
  const read = h.getQueries().find(query => query.table === 'lead_intakes')
  assert.ok(read.filters.some(filter => filter[0] === 'eq' && filter[1] === 'payload->>service_type' && filter[2] === 'band'))
  assert.ok(read.filters.some(filter => filter[0] === 'eq' && filter[1] === 'tenant_id' && filter[2] === HEAD))
  assert.equal(h.getWrites().length, 0)
})
test('closed won, nameless and other-account opportunities are not prospects', async () => {
  const h = setup(), response = await h.load(route).GET(request())
  const names = (await response.json()).prospects.map(row => row.name)
  assert.equal(names.includes('Bo Chen'), false)
  assert.equal(names.length, 1)
})
test('denies disabled, anonymous, unprivileged and foreign accounts', async () => {
  for (const [options, req, status] of [[{ disabled: true }, request(), 404], [{ anonymous: true }, request(), 401], [{ noPermission: true }, request(), 403], [{}, request(DEMO), 403]]) {
    const h = setup(options), response = await h.load(route).GET(req)
    assert.equal(response.status, status)
    assert.equal(h.getQueries().some(query => query.table === 'lead_intakes'), false)
  }
})
