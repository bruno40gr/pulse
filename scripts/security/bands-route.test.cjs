/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const route = 'app/api/bands/route.ts'
const enrollment = (id, student, band) => ({ id, tenant_id: HEAD, student_id: student, service_type: 'band', session_name: band, custom_fields: {} })
function setup(options = {}) {
  const h = createHarness()
  h.setScenario({ env: options.env || { ENABLE_CONTACT_BAND_OPPORTUNITIES: options.disabled ? 'false' : 'true' },
    actor: options.anonymous ? null : { personId: 'viewer', displayName: 'Viewer' },
    fixtures: { tenant_memberships: [{ id: 'm', tenant_id: HEAD, person_id: 'viewer', role_id: 'r', legacy_access_enabled: true, status: 'unclaimed' }], roles: [{ id: 'r', tenant_id: HEAD, key: options.noPermission ? 'staff' : 'owner' }], role_permissions: [],
      enrollments: [enrollment('e1', 's1', 'Band A'), enrollment('e2', 's2', 'Band A'), enrollment('e3', 's1', 'Band B'), { ...enrollment('e4', 's3', ''), custom_fields: { band_name: 'Band C' } }, { ...enrollment('e5', 's1', ''), session_name: null, custom_fields: {} }],
      students: [{ id: 's1', tenant_id: HEAD, person_id: 'p1', client_status: 'member' }, { id: 's2', tenant_id: HEAD, person_id: 'p2', client_status: 'active' }, { id: 's3', tenant_id: HEAD, person_id: 'p3', client_status: 'member' }],
      instructors: options.instructors || [],
      people: [{ id: 'p1', tenant_id: HEAD, first_name: 'Ada', last_name: 'Lovelace' }, { id: 'p2', tenant_id: HEAD, first_name: 'Bo', last_name: 'Chen' }, { id: 'p3', tenant_id: HEAD, first_name: 'Cy', last_name: 'Diaz' }] },
    errors: options.errors || {}, queryResult: options.queryResult })
  return h
}
const request = (tenant = HEAD) => new Request(`http://synthetic.invalid/api/bands?tenant=${tenant}`)
test('groups enrolled members into bands and ignores unnamed enrollments', async () => {
  const h = setup(), response = await h.load(route).GET(request())
  assert.equal(response.status, 200)
  const { bands } = await response.json()
  assert.deepEqual(Array.from(bands, band => band.name), ['Band A', 'Band B', 'Band C'])
  assert.deepEqual(Array.from(bands[0].members, member => member.name), ['Ada Lovelace', 'Bo Chen'])
  assert.equal(bands[0].members[0].client_status, 'member')
  for (const q of h.getQueries().filter(q => ['enrollments', 'students', 'people'].includes(q.table))) {
    assert.ok(q.filters.some(filter => filter[0] === 'eq' && filter[1] === 'tenant_id' && filter[2] === HEAD))
  }
  assert.equal(h.getWrites().length, 0)
})
test('denies disabled, anonymous, unprivileged and foreign tenant requests before reads', async () => {
  for (const [options, req, status] of [[{ disabled: true }, request(), 404], [{ anonymous: true }, request(), 401], [{ noPermission: true }, request(), 403], [{}, request(DEMO), 403]]) {
    const h = setup(options), response = await h.load(route).GET(req)
    assert.equal(response.status, status)
    assert.equal(h.getQueries().some(q => q.table === 'enrollments'), false)
  }
})
test('pages past the first 500 band enrollments', async () => {
  const rows = Array.from({ length: 501 }, (_, index) => enrollment('e' + index, 's1', 'Band ' + (index < 500 ? 'A' : 'Z')))
  const h = setup({ queryResult: ({ table, filters }) => {
    const range = filters.find(filter => filter[0] === 'range')
    if (table === 'enrollments') return { data: rows.slice(range[1], range[2] + 1), error: null }
  } })
  const response = await h.load(route).GET(request())
  assert.equal(response.status, 200)
  assert.deepEqual(Array.from((await response.json()).bands, band => band.name), ['Band A', 'Band Z'])
  assert.equal(h.getQueries().filter(q => q.table === 'enrollments').length, 2)
})
test('fails closed when roster lookups error', async () => {
  for (const errors of [{ enrollments: { message: 'offline' } }, { students: { message: 'offline' } }, { people: { message: 'offline' } }]) {
    const h = setup({ errors }), response = await h.load(route).GET(request())
    assert.equal(response.status, 503)
    assert.equal(h.getWrites().length, 0)
  }
})

test('staff teaching records never become band members', async () => {
  const h = setup({ instructors: [{ id: 'i1', tenant_id: HEAD, person_id: 'p2' }] })
  const response = await h.load(route).GET(request())
  assert.equal(response.status, 200)
  const { bands } = await response.json()
  assert.deepEqual(Array.from(bands[0].members, member => member.name), ['Ada Lovelace'])
  assert.equal(bands.some(band => band.members.some(member => member.person_id === 'p2')), false)
})
test('a band with only a staff record is omitted rather than shown as empty', async () => {
  const h = setup({ instructors: [{ id: 'i1', tenant_id: HEAD, person_id: 'p3' }] })
  const { bands } = await (await h.load(route).GET(request())).json()
  assert.equal(bands.some(band => band.name === 'Band C'), false)
})

test('either flag name enables the API so the page cannot outrun its endpoints', async () => {
  for (const env of [{ ENABLE_CONTACT_BAND_OPPORTUNITIES: 'true' }, { NEXT_PUBLIC_ENABLE_CONTACT_BAND_OPPORTUNITIES: 'true' }]) {
    const h = setup({ env })
    assert.equal((await h.load(route).GET(request())).status, 200)
  }
  const h = setup({ env: { ENABLE_CONTACT_BAND_OPPORTUNITIES: 'false', NEXT_PUBLIC_ENABLE_CONTACT_BAND_OPPORTUNITIES: 'false' } })
  assert.equal((await h.load(route).GET(request())).status, 404)
})
