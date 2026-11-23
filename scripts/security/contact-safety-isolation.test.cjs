/* eslint-disable @typescript-eslint/no-require-imports -- Offline tenant-isolation regression. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const id = '11111111-1111-4111-8111-111111111111'
const foreign = '22222222-2222-4222-8222-222222222222'
function setup(options = {}) {
  const h = createHarness()
  h.setScenario({ authUser: options.anonymous ? null : { id: 'auth' }, fixtures: {
    tenant_memberships: [{ id: 'member', tenant_id: HEAD, person_id: 'staff', auth_user_id: 'auth', role_id: 'role', status: 'active' }],
    roles: [{ id: 'role', tenant_id: HEAD, key: options.restricted ? 'staff' : 'owner' }], role_permissions: [],
    people: [{ id, tenant_id: HEAD, first_name: 'Local', last_name: 'Contact', opted_out: true, notes: '', notes_history: [{ text: 'Refund complaint' }] },
      { id: foreign, tenant_id: DEMO, first_name: 'Foreign', notes: 'Private complaint', opted_out: true }],
  }, errors: options.error ? { people: { message: 'Private database diagnostic' } } : {} })
  return { h, send: (ids = [id], query = HEAD) => h.load('app/api/contacts/check-sensitive/route.ts').POST(new Request(`https://synthetic.invalid/api/contacts/check-sensitive?tenant=${query}`, {
    method: 'POST', body: JSON.stringify({ contact_ids: ids }),
  })) }
}
test('safety reads canonical notes/history with tenant filter and no-store', async () => {
  const { h, send } = setup(), response = await send()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const body = await response.json()
  assert.equal(body.flagged[0].note, 'Refund complaint')
  assert.equal(body.opted_out.length, 1)
  assert.ok(h.getQueries().filter(q => q.table === 'people').every(q => q.filters.some(f => f[0] === 'eq' && f[1] === 'tenant_id' && f[2] === HEAD)))
  assert.equal(h.getWrites().length, 0)
})
test('foreign IDs never reveal names or notes, even mixed with valid IDs', async () => {
  for (const ids of [[foreign], [id, foreign]]) {
    const { send } = setup(), response = await send(ids)
    assert.equal(response.status, 409)
    assert.doesNotMatch(JSON.stringify(await response.json()), /Private|Foreign|Refund/)
  }
})
test('anonymous, restricted and mismatched-account safety requests fail before contact queries', async () => {
  for (const [options, tenant, status] of [[{ anonymous: true }, HEAD, 401], [{ restricted: true }, HEAD, 403], [{}, DEMO, 403]]) {
    const { h, send } = setup(options)
    assert.equal((await send([id], tenant)).status, status)
    assert.equal(h.getQueries().some(q => q.table === 'people'), false)
  }
})
test('invalid selections and database errors do not become empty safety success', async () => {
  for (const ids of [[], ['bad'], [id, id], Array(5001).fill(id)]) assert.equal((await setup().send(ids)).status, 400)
  const response = await setup({ error: true }).send()
  assert.equal(response.status, 503)
  assert.doesNotMatch(JSON.stringify(await response.json()), /Private database/)
})