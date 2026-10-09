/* eslint-disable @typescript-eslint/no-require-imports -- Existing synthetic route harness. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')

function setup(errors = {}) {
  const harness = createHarness()
  harness.setScenario({
    authUser: { id: 'auth' },
    errors,
    fixtures: {
      tenant_memberships: [{ id: 'membership', tenant_id: HEAD, person_id: 'person', auth_user_id: 'auth', role_id: 'role', status: 'active' }],
      roles: [{ id: 'role', tenant_id: HEAD, key: 'instructor' }],
      role_permissions: [],
    },
  })
  return { harness, route: harness.load('app/api/notifications/route.ts') }
}

test('Dismiss updates only the current tenant and recipient, without deleting a notification or completing a note', async () => {
  const { harness, route } = setup()
  const response = await route.PATCH(new Request(`http://synthetic.invalid/api/notifications?tenant=${HEAD}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'notice' }),
  }))
  assert.equal(response.status, 200)
  const update = harness.getQueries().find(q => q.table === 'notifications')
  assert.equal(update.operation, 'update')
  assert.ok(update.payload.dismissed_at)
  assert.equal(update.payload.read_at, undefined)
  assert.ok(!harness.getQueries().some(q => q.table === 'notes'))
  for (const filter of [['eq', 'tenant_id', HEAD], ['eq', 'recipient_membership_id', 'membership'], ['eq', 'id', 'notice']]) {
    assert.ok(update.filters.some(value => JSON.stringify(value) === JSON.stringify(filter)))
  }
})

test('Dismiss all only acknowledges the current recipient’s pending notifications', async () => {
  const { harness, route } = setup()
  const response = await route.PATCH(new Request(`http://synthetic.invalid/api/notifications?tenant=${HEAD}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }),
  }))
  assert.equal(response.status, 200)
  const update = harness.getQueries().find(q => q.table === 'notifications')
  assert.equal(update.operation, 'update')
  for (const filter of [['eq', 'tenant_id', HEAD], ['eq', 'recipient_membership_id', 'membership'], ['is', 'dismissed_at', null]]) {
    assert.ok(update.filters.some(value => JSON.stringify(value) === JSON.stringify(filter)))
  }
  assert.ok(!harness.getQueries().some(q => q.table === 'notes'))
})

test('failed acknowledgement is not reported as successful', async () => {
  const { route } = setup({ notifications: { message: 'Synthetic failure' } })
  const response = await route.PATCH(new Request(`http://synthetic.invalid/api/notifications?tenant=${HEAD}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'notice' }),
  }))
  assert.equal(response.status, 500)
})

test('Open records seen without dismissing or completing the underlying note', async () => {
  const { harness, route } = setup()
  const response = await route.PATCH(new Request(`http://synthetic.invalid/api/notifications?tenant=${HEAD}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'notice', action: 'seen' }),
  }))
  assert.equal(response.status, 200)
  const update = harness.getQueries().find(q => q.table === 'notifications')
  assert.ok(update.payload.read_at)
  assert.equal(update.payload.dismissed_at, undefined)
  assert.ok(update.filters.some(value => JSON.stringify(value) === JSON.stringify(['is', 'read_at', null])))
  assert.ok(!harness.getQueries().some(q => q.table === 'notes'))
})

test('GET excludes dismissed items but only unseen items contribute to the red dot', async () => {
  const { harness, route } = setup()
  assert.equal((await route.GET(new Request(`http://synthetic.invalid/api/notifications?tenant=${HEAD}`))).status, 200)
  const queries = harness.getQueries().filter(q => q.table === 'notifications')
  assert.equal(queries.length, 2)
  assert.ok(queries.every(q => q.filters.some(f => JSON.stringify(f) === JSON.stringify(['is', 'dismissed_at', null]))))
  assert.equal(queries.filter(q => q.filters.some(f => JSON.stringify(f) === JSON.stringify(['is', 'read_at', null]))).length, 1)
})

test('invalid actions and bulk seen are rejected without notification writes', async () => {
  for (const body of [{ id: 'notice', action: 'unknown' }, { all: true, action: 'seen' }]) {
    const { harness, route } = setup()
    assert.equal((await route.PATCH(new Request(`http://synthetic.invalid/api/notifications?tenant=${HEAD}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }))).status, 400)
    assert.ok(!harness.getQueries().some(q => q.table === 'notifications'))
  }
})