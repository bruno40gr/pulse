/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const route = 'app/api/bands/members/route.ts'
const person = '11111111-1111-4111-8111-111111111111'
function setup(options = {}) {
  const h = createHarness(), grants = options.grants || ['contacts.manage']
  h.setScenario({ env: { ENABLE_CONTACT_BAND_OPPORTUNITIES: options.disabled ? 'false' : 'true' },
    actor: options.anonymous ? null : { personId: 'viewer', displayName: 'Viewer' },
    fixtures: {
      tenant_memberships: [{ id: 'm', tenant_id: HEAD, person_id: 'viewer', role_id: 'r', legacy_access_enabled: true, status: 'unclaimed' }],
      roles: [{ id: 'r', tenant_id: HEAD, key: 'staff' }],
      permissions: grants.map(key => ({ id: key, key })),
      role_permissions: grants.map(key => ({ role_id: 'r', permission_id: key })),
      people: [{ id: person, tenant_id: HEAD, first_name: 'Ada', last_name: 'Lovelace' }],
      students: [{ id: 's1', tenant_id: HEAD, person_id: person }],
      enrollments: [{ id: 'e1', tenant_id: HEAD, student_id: 's1', service_type: 'band', custom_fields: { band_name: 'La Paz' } }],
      band_memberships: [],
    }, queryResult: options.queryResult })
  return h
}
const request = (method, body = { tenant_id: HEAD, band: 'La Paz', person_id: person }) => new Request('https://synthetic.invalid/api/bands/members', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
test('adding a member writes an explicit membership scoped to the account', async () => {
  const h = setup()
  const response = await h.load(route).POST(request('POST', { tenant_id: HEAD, band: 'La Paz', person_id: person, instrument: 'Bass' }))
  assert.equal(response.status, 201)
  const write = h.getWrites().find(query => query.table === 'band_memberships')
  assert.equal(write.payload.tenant_id, HEAD); assert.equal(write.payload.band_name, 'La Paz')
  assert.equal(write.payload.instrument, 'Bass'); assert.equal(write.payload.person_id, person)
})
test('an instrument change falls back to the band enrollment for an enrolled member', async () => {
  const h = setup({ queryResult: ({ table, operation }) => table === 'band_memberships' && operation === 'update' ? { data: [], error: null } : undefined })
  const response = await h.load(route).PATCH(request('PATCH', { tenant_id: HEAD, band: 'La Paz', person_id: person, instrument: 'Drums' }))
  assert.equal(response.status, 200)
  const enrollmentWrite = h.getWrites().find(query => query.table === 'enrollments')
  assert.equal(enrollmentWrite.payload.custom_fields.band_instrument, 'Drums')
})
test('an enrolled member is not removed from the roster by this action', async () => {
  const h = setup({ queryResult: ({ table, operation }) => table === 'band_memberships' && operation === 'delete' ? { data: [], error: null } : undefined })
  const response = await h.load(route).DELETE(request('DELETE'))
  assert.equal(response.status, 409)
})
test('writes stay closed without the flag, a session, or a permission and never cross accounts', async () => {
  for (const [options, req, status] of [
    [{ disabled: true }, request('POST'), 404],
    [{ anonymous: true }, request('POST'), 401],
    [{ grants: ['contacts.read'] }, request('POST'), 403],
    [{}, request('POST', { tenant_id: DEMO, band: 'La Paz', person_id: person }), 403],
    [{}, request('POST', { tenant_id: HEAD, band: '', person_id: person }), 400],
  ]) {
    const h = setup(options), response = await h.load(route)[req.method](req)
    assert.equal(response.status, status)
    assert.equal(h.getWrites().length, 0)
  }
})
