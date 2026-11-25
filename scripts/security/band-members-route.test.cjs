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
    }, queryResult: options.queryResult, rpcErrors: options.rpcError ? { create_contact_band_opportunities: { message: 'offline' } } : {} })
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
test('removing an enrolled member ends their band enrolment', async () => {
  const h = setup({ queryResult: ({ table, operation }) => table === 'band_memberships' && operation === 'delete' ? { data: [], error: null } : undefined })
  const response = await h.load(route).DELETE(request('DELETE'))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.removed, true)
  assert.equal(body.endedEnrollments, 1)
  const write = h.getWrites().find(query => query.table === 'enrollments' && query.operation === 'update')
  assert.equal(write.payload.custom_fields.status, 'ended')
  assert.equal(write.payload.custom_fields.ended_source, 'removed from band')
})
test('removing someone who is not in the band reports it instead of pretending', async () => {
  const h = setup({
    queryResult: ({ table, operation }) => {
      if (table === 'band_memberships' && operation === 'delete') return { data: [], error: null }
      if (table === 'enrollments') return { data: [{ id: 'e1', custom_fields: { band_name: 'Other Band' } }], error: null }
    },
  })
  const response = await h.load(route).DELETE(request('DELETE'))
  assert.equal(response.status, 404)
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

test('a prospect can be added to more than one band without becoming a member', async () => {
  const h = setup()
  const response = await h.load(route).POST(request('POST', { tenant_id: HEAD, band: 'La Paz', person_id: person, membership: 'prospect' }))
  assert.equal(response.status, 201)
  const write = h.getWrites().find(query => query.table === 'band_memberships')
  assert.equal(write.payload.membership, 'prospect')
  const other = await h.load(route).POST(request('POST', { tenant_id: HEAD, band: 'SunKast', person_id: person, membership: 'prospect' }))
  assert.equal(other.status, 201)
  assert.deepEqual(Array.from(h.getWrites().filter(query => query.table === 'band_memberships'), query => query.payload.band_name), ['La Paz', 'SunKast'])
})
test('membership transitions accept confirmed and pending, and reject anything else', async () => {
  for (const membership of ['confirmed', 'pending']) {
    const h = setup()
    const response = await h.load(route).PATCH(request('PATCH', { tenant_id: HEAD, band: 'La Paz', person_id: person, membership }))
    assert.equal(response.status, 200)
    assert.equal(h.getWrites().find(query => query.table === 'band_memberships').payload.membership, membership)
  }
  const h = setup()
  const response = await h.load(route).PATCH(request('PATCH', { tenant_id: HEAD, band: 'La Paz', person_id: person, membership: 'enrolled' }))
  assert.equal(response.status, 400)
  assert.equal(h.getWrites().length, 0)
})

test('a member can hold several instruments', async () => {
  const h = setup()
  const response = await h.load(route).POST(request('POST', { tenant_id: HEAD, band: 'La Paz', person_id: person, instruments: ['Bass', 'Vocals'] }))
  assert.equal(response.status, 201)
  const write = h.getWrites().find(query => query.table === 'band_memberships')
  assert.deepEqual(Array.from(write.payload.instruments), ['Bass', 'Vocals'])
  assert.equal(write.payload.instrument, 'Bass')
})

test('adding a member also creates their band opportunity so they appear in both views', async () => {
  const h = setup()
  const response = await h.load(route).POST(request('POST', { tenant_id: HEAD, band: 'La Paz', person_id: person, membership: 'prospect' }))
  assert.equal(response.status, 201)
  const call = h.getQueries().find(query => query.operation === 'rpc' && query.table === 'create_contact_band_opportunities')
  assert.ok(call)
  assert.equal(call.payload.p_tenant, HEAD)
  assert.equal(call.payload.p_students[0].person_id, person)
})
test('a failed opportunity write stops the member being added', async () => {
  const h = setup({ rpcError: true })
  const response = await h.load(route).POST(request('POST', { tenant_id: HEAD, band: 'La Paz', person_id: person, membership: 'prospect' }))
  assert.equal(response.status, 503)
  assert.equal(h.getWrites().some(query => query.table === 'band_memberships'), false)
})

test('multi-select saves every instrument on the active reconciled enrollment', async () => {
  const h = setup({ queryResult: ({ table, operation }) => {
    if (table === 'band_memberships' && operation === 'update') return { data: [], error: null }
    if (table === 'enrollments' && operation === 'select') return { data: [
      { id: 'old', student_id: 's1', service_type: 'band', session_name: 'La Paz', status: 'ended', instrument: 'Drums', custom_fields: { band_name: 'La Paz', superseded_by_subscription_snapshot: 'review-v1' } },
      { id: 'new', student_id: 's1', service_type: 'group', instrument: 'Band', status: 'active', custom_fields: { reconciliation_run: 'review-v1' } },
    ], error: null }
  } })
  const response = await h.load(route).PATCH(request('PATCH', { tenant_id: HEAD, band: 'La Paz', person_id: person, instruments: ['Drums', 'Voice'] }))
  assert.equal(response.status, 200)
  const write = h.getWrites().find(query => query.table === 'enrollments')
  assert.deepEqual(Array.from(write.payload.custom_fields.band_instruments), ['Drums', 'Voice'])
  assert.equal(write.payload.custom_fields.band_name, 'La Paz')
  assert.ok(write.filters.some(filter => filter[1] === 'id' && filter[2] === 'new'))
})
