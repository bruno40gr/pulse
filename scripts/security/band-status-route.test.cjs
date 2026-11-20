/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const route = 'app/api/bands/status/route.ts'
function setup(options = {}) {
  const h = createHarness(), grants = options.grants || ['contacts.manage']
  h.setScenario({ env: { ENABLE_CONTACT_BAND_OPPORTUNITIES: options.disabled ? 'false' : 'true' },
    actor: options.anonymous ? null : { personId: 'viewer', displayName: 'Viewer' },
    fixtures: {
      tenant_memberships: [{ id: 'm', tenant_id: HEAD, person_id: 'viewer', role_id: 'r', legacy_access_enabled: true, status: 'unclaimed' }],
      roles: [{ id: 'r', tenant_id: HEAD, key: 'staff' }],
      permissions: grants.map(key => ({ id: key, key })),
      role_permissions: grants.map(key => ({ role_id: 'r', permission_id: key })),
      band_profiles: [],
    } })
  return h
}
const request = (body = { tenant_id: HEAD, band: 'La Paz', status: 'archived' }) => new Request('https://synthetic.invalid/api/bands/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
test('archiving a band records status for the account only', async () => {
  const h = setup()
  const response = await h.load(route).POST(request())
  assert.equal(response.status, 200)
  const write = h.getWrites().find(query => query.table === 'band_profiles')
  assert.equal(write.payload.tenant_id, HEAD); assert.equal(write.payload.band_name, 'La Paz'); assert.equal(write.payload.status, 'archived')
})
test('invalid status, foreign account and missing permission never write', async () => {
  for (const [options, body, status] of [
    [{ disabled: true }, undefined, 404],
    [{ anonymous: true }, undefined, 401],
    [{ grants: ['contacts.read'] }, undefined, 403],
    [{}, { tenant_id: DEMO, band: 'La Paz', status: 'archived' }, 403],
    [{}, { tenant_id: HEAD, band: 'La Paz', status: 'deleted' }, 400],
  ]) {
    const h = setup(options), response = await h.load(route).POST(request(body))
    assert.equal(response.status, status)
    assert.equal(h.getWrites().length, 0)
  }
})
