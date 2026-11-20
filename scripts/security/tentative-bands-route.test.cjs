/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const route = 'app/api/leads/tentative-bands/route.ts'
const lead = '11111111-1111-4111-8111-111111111111'
const band = '22222222-2222-4222-8222-222222222222'
function setup(options = {}) {
  const h = createHarness()
  h.setScenario({ env: { ENABLE_CONTACT_BAND_OPPORTUNITIES: options.disabled ? 'false' : 'true' }, actor: options.anonymous ? null : { personId: 'viewer', displayName: 'Viewer' },
    fixtures: { tenant_memberships: [{ id: 'm', tenant_id: HEAD, person_id: 'viewer', role_id: 'r', legacy_access_enabled: true, status: 'unclaimed' }], roles: [{ id: 'r', tenant_id: HEAD, key: options.noPermission ? 'staff' : 'owner' }], role_permissions: [],
      band_tentative_opportunities: [{ tenant_id: HEAD, lead_id: lead, band_id: band }, { tenant_id: DEMO, lead_id: lead, band_id: 'foreign' }],
      band_tentative_groups: [{ tenant_id: HEAD, id: band, name: 'Synthetic Band' }] }, errors: options.errors || {}, queryResult: options.queryResult, rpcResults: { set_band_tentative_opportunities: 1 }, rpcErrors: options.rpcError ? { set_band_tentative_opportunities: { message: 'offline' } } : {} })
  return h
}
const request = (tenant = HEAD, id = lead) => new Request(`http://synthetic.invalid/api/leads/tentative-bands?tenant=${tenant}&lead_id=${id}`)
test('returns only tenant-scoped tentative associations and never writes', async () => {
  const h = setup(), response = await h.load(route).GET(request())
  assert.equal(response.status, 200); assert.deepEqual((await response.json()).associations, [{ lead_id: lead, band_id: band, name: 'Synthetic Band' }])
  for (const q of h.getQueries().filter(q => q.table.startsWith('band_tentative'))) assert.ok(q.filters.some(f => f[0] === 'eq' && f[1] === 'tenant_id' && f[2] === HEAD))
  assert.equal(h.getWrites().length, 0)
})
test('denies disabled, anonymous, unprivileged, invalid and foreign requests', async () => {
  for (const [options, req, status] of [[{ disabled: true }, request(), 404], [{ anonymous: true }, request(), 401], [{ noPermission: true }, request(), 403], [{}, request(HEAD, 'bad'), 400], [{}, request(DEMO), 403]]) {
    const h = setup(options), response = await h.load(route).GET(req)
    assert.equal(response.status, status); assert.equal(h.getQueries().some(q => q.table.startsWith('band_tentative')), false)
  }
})
test('database errors fail closed without returning partial associations', async () => {
  const h = setup({ errors: { band_tentative_groups: { message: 'offline' } } }), response = await h.load(route).GET(request())
  assert.equal(response.status, 503); assert.equal(h.getWrites().length, 0)
})
test('association reads paginate beyond the first page', async () => {
  const rows = Array.from({ length: 501 }, (_, index) => ({ tenant_id: HEAD, lead_id: lead, band_id: `band-${index}` }))
  const h = setup({ queryResult: ({ table, filters }) => {
    if (table === 'band_tentative_opportunities') { const range = filters.find(f => f[0] === 'range'); return { data: rows.slice(range[1], range[2] + 1), error: null } }
    if (table === 'band_tentative_groups') { const ids = filters.find(f => f[0] === 'in')[2]; return { data: ids.map(id => ({ id, name: id })), error: null } }
  } })
  const response = await h.load(route).GET(request())
  assert.equal(response.status, 200); assert.equal((await response.json()).associations.length, 501)
  assert.equal(h.getQueries().filter(q => q.table === 'band_tentative_opportunities').length, 2)
  assert.equal(h.getWrites().length, 0)
})
const update = (tenant = HEAD, bands = [band]) => new Request('http://synthetic.invalid/api/leads/tentative-bands', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tenant_id: tenant, lead_id: lead, band_ids: bands }) })
test('authorized updates invoke one tenant-scoped transaction', async () => {
  const h = setup(), response = await h.load(route).PUT(update())
  assert.equal(response.status, 200)
  const call = h.getQueries().find(q => q.operation === 'rpc')
  assert.equal(call.database, 'crm'); assert.equal(call.payload.p_tenant, HEAD); assert.equal(call.payload.p_lead, lead); assert.deepEqual(Array.from(call.payload.p_band_ids), [band])
})
test('write permissions, tenant scope and duplicate validation fail before database transaction', async () => {
  for (const [options, req, status] of [[{ disabled: true }, update(), 404], [{ anonymous: true }, update(), 401], [{ noPermission: true }, update(), 403], [{}, update(DEMO), 403], [{}, update(HEAD, [band, band]), 400]]) {
    const h = setup(options), response = await h.load(route).PUT(req)
    assert.equal(response.status, status); assert.equal(h.getQueries().some(q => q.operation === 'rpc'), false)
  }
})
test('transaction errors do not report success', async () => {
  const h = setup({ rpcError: true }), response = await h.load(route).PUT(update())
  assert.equal(response.status, 503)
})
test('group listing and creation enforce tenant permissions', async () => {
  const groupsRoute = 'app/api/leads/tentative-bands/groups/route.ts'
  const read = request()
  const create = (tenant = HEAD, name = 'New Band') => new Request('http://synthetic.invalid/api/leads/tentative-bands/groups', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tenant_id: tenant, name }) })
  const h = setup(), response = await h.load(groupsRoute).GET(read)
  const listed = await (await h.load(groupsRoute).GET(read)).json()
  assert.equal(listed.groups[0].name, 'Synthetic Band'); assert.equal(listed.groups[0].member_count, 1)
  const created = await h.load(groupsRoute).POST(create())
  assert.equal(created.status, 201)
  assert.equal(h.getQueries().find(q => q.table === 'band_tentative_groups' && q.operation === 'insert').payload.tenant_id, HEAD)
  for (const [options, req, status] of [[{ anonymous: true }, create(), 401], [{ noPermission: true }, create(), 403], [{}, create(DEMO), 403], [{}, create(HEAD, '   '), 400]]) {
    const other = setup(options), result = await other.load(groupsRoute).POST(req)
    assert.equal(result.status, status); assert.equal(other.getQueries().some(q => q.operation === 'insert'), false)
  }
})