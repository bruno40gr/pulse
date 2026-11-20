/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic tests only. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const route = 'app/api/contacts/band-opportunities/route.ts'
const person = '11111111-1111-4111-8111-111111111111'
function setup(options = {}) {
  const h = createHarness(), grants = options.grants ?? ['contacts.read', 'leads.manage']
  h.setScenario({ env: { ENABLE_CONTACT_BAND_OPPORTUNITIES: options.enabled === false ? 'false' : 'true' }, actor: options.anonymous ? null : { personId: 'viewer', displayName: 'Viewer' },
    fixtures: { tenant_memberships: [{ id: 'm', tenant_id: HEAD, person_id: 'viewer', role_id: 'r', legacy_access_enabled: true, status: 'unclaimed' }], roles: [{ id: 'r', tenant_id: HEAD, key: 'staff' }], permissions: grants.map(key => ({ id: key, key })), role_permissions: grants.map(key => ({ role_id: 'r', permission_id: key })),
      people: [{ id: person, tenant_id: options.foreign ? DEMO : HEAD, first_name: 'Synthetic', last_name: 'Student' }], students: options.noStudent ? [] : [{ id: 's', tenant_id: HEAD, person_id: person }] },
    rpcResults: { create_contact_band_opportunities: options.rpcResult ?? [{ person_id: person, result: 'created', lead_ids: ['22222222-2222-4222-8222-222222222222'] }] }, rpcErrors: options.rpcError ? { create_contact_band_opportunities: { message: 'unavailable' } } : {} })
  return h
}
const request = (body = { tenant_id: HEAD, person_ids: [person] }) => new Request('http://synthetic.invalid/api/contacts/band-opportunities', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
test('creates through one CRM transaction using tenant-verified existing students only', async () => {
  const h = setup(), response = await h.load(route).POST(request())
  assert.equal(response.status, 200)
  const call = h.getQueries().find(q => q.operation === 'rpc')
  assert.equal(call.database, 'crm'); assert.equal(call.payload.p_tenant, HEAD)
  assert.equal(call.payload.p_students[0].person_id, person); assert.equal(call.payload.p_students[0].name, 'Synthetic Student')
  assert.equal(h.getQueries().filter(q => q.operation === 'rpc').length, 1)
  assert.equal(h.getQueries().some(q => q.operation !== 'select' && q.operation !== 'rpc'), false)
})
test('unauthorized, cross-tenant, nonstudent and duplicate requests never invoke creation', async () => {
  for (const [options, body, status] of [[{ anonymous: true }, undefined, 401], [{ grants: ['contacts.read'] }, undefined, 403], [{ grants: ['leads.manage'] }, undefined, 403], [{ foreign: true }, undefined, 400], [{ noStudent: true }, undefined, 400], [{}, { tenant_id: HEAD, person_ids: [person, person] }, 400], [{}, { tenant_id: DEMO, person_ids: [person] }, 403]]) {
    const h = setup(options), response = await h.load(route).POST(request(body))
    assert.equal(response.status, status); assert.equal(h.getQueries().some(q => q.operation === 'rpc'), false)
  }
})
test('database errors return a generic failure, not a successful creation', async () => {
  const h = setup({ rpcError: true }), response = await h.load(route).POST(request())
  assert.equal(response.status, 503); assert.doesNotMatch(JSON.stringify(await response.json()), /unavailable/)
})
test('feature defaults to disabled before authorization and database operations', async () => {
  const h = setup({ enabled: false }), response = await h.load(route).POST(request())
  assert.equal(response.status, 404); assert.equal(h.getQueries().length, 0)
})
test('partial or malformed transaction responses fail closed', async () => {
  for (const rpcResult of [[], [{ person_id: person, result: 'created', lead_ids: [] }], [{ person_id: person, result: 'unknown', lead_ids: ['22222222-2222-4222-8222-222222222222'] }]]) {
    const h = setup({ rpcResult }), response = await h.load(route).POST(request())
    assert.equal(response.status, 503)
  }
})