/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const route = 'app/api/bands/profile/route.ts'
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
      enrollments: [{ id: 'e1', tenant_id: HEAD, student_id: 's1', service_type: 'band', custom_fields: { band_name: 'La Paz' } }],
      band_memberships: [],
    }, rpcResults: { rename_band: null }, rpcErrors: options.rpcError ? { rename_band: { message: 'A band with that name already exists' } } : {} })
  return h
}
const request = (method, body) => new Request('https://synthetic.invalid/api/bands/profile', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
test('saving details updates schedule, picture and status', async () => {
  const h = setup()
  const response = await h.load(route).PATCH(request('PATCH', { tenant_id: HEAD, band: 'La Paz', schedule: 'Tuesdays 6-7 PM', image_url: 'https://example.invalid/pic.png', status: 'active' }))
  assert.equal(response.status, 200)
  const write = h.getWrites().find(query => query.table === 'band_profiles')
  assert.equal(write.payload.schedule, 'Tuesdays 6-7 PM')
  assert.equal(write.payload.image_url, 'https://example.invalid/pic.png')
  assert.equal(write.payload.status, 'active')
})
test('renaming goes through the transactional rename function', async () => {
  const h = setup()
  const response = await h.load(route).PATCH(request('PATCH', { tenant_id: HEAD, band: 'La Paz', name: 'La Paz Band' }))
  assert.equal(response.status, 200)
  const call = h.getQueries().find(query => query.operation === 'rpc')
  assert.equal(call.table, 'rename_band'); assert.equal(call.payload.p_old, 'La Paz'); assert.equal(call.payload.p_new, 'La Paz Band')
  const write = h.getWrites().find(query => query.table === 'band_profiles')
  assert.equal(write.payload.band_name, 'La Paz Band')
})
test('a duplicate name is reported instead of silently merging bands', async () => {
  const h = setup({ rpcError: true })
  const response = await h.load(route).PATCH(request('PATCH', { tenant_id: HEAD, band: 'La Paz', name: 'SunKast' }))
  assert.equal(response.status, 409)
  assert.equal(h.getWrites().some(query => query.table === 'band_profiles'), false)
})
test('deleting archives rather than erasing enrollment history', async () => {
  const h = setup()
  const response = await h.load(route).DELETE(request('DELETE', { tenant_id: HEAD, band: 'La Paz' }))
  assert.equal(response.status, 200)
  const write = h.getWrites().find(query => query.table === 'band_profiles')
  assert.equal(write.payload.status, 'archived')
  assert.equal(h.getQueries().some(query => query.table === 'enrollments' && query.operation !== 'select'), false)
})
test('invalid status, foreign account, missing permission and no flag never write', async () => {
  for (const [options, body, status] of [
    [{ disabled: true }, { tenant_id: HEAD, band: 'La Paz', status: 'active' }, 404],
    [{ anonymous: true }, { tenant_id: HEAD, band: 'La Paz', status: 'active' }, 401],
    [{ grants: ['contacts.read'] }, { tenant_id: HEAD, band: 'La Paz', status: 'active' }, 403],
    [{}, { tenant_id: DEMO, band: 'La Paz', status: 'active' }, 403],
    [{}, { tenant_id: HEAD, band: 'La Paz', status: 'deleted' }, 400],
  ]) {
    const h = setup(options), response = await h.load(route).PATCH(request('PATCH', body))
    assert.equal(response.status, status)
    assert.equal(h.getWrites().length, 0)
  }
})
