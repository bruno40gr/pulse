/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')
const route = 'app/api/contacts/person/route.ts'

function setup(options = {}) {
  const h = createHarness()
  const grants = options.grants || ['contacts.manage']
  h.setScenario({
    actor: options.anonymous ? null : { personId: 'viewer', displayName: 'Viewer' },
    fixtures: {
      tenant_memberships: [{ id: 'm', tenant_id: HEAD, person_id: 'viewer', role_id: 'r', legacy_access_enabled: true, status: 'unclaimed' }],
      roles: [{ id: 'r', tenant_id: HEAD, key: 'staff' }],
      permissions: grants.map(key => ({ id: key, key })),
      role_permissions: grants.map(key => ({ role_id: 'r', permission_id: key })),
      people: options.people || [],
      students: options.students || [],
    },
    queryResult: options.queryResult,
  })
  return h
}
const request = body => new Request('https://synthetic.invalid/api/contacts/person', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tenant_id: HEAD, ...body }),
})

test('an external student becomes a person and a student in the same account', async () => {
  const h = setup({ queryResult: ({ table, operation }) => table === 'people' && operation === 'insert' ? { data: { id: 'new-person' }, error: null } : table === 'students' && operation === 'insert' ? { data: { id: 'new-student' }, error: null } : undefined })
  const response = await h.load(route).POST(request({ first_name: 'Ada', last_name: 'Lovelace', email: 'ADA@example.com', phone: '5551234567', date_of_birth: '2012-03-04' }))
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), { person: { id: 'new-person', name: 'Ada Lovelace' } })
  const person = h.getWrites().find(query => query.table === 'people' && query.operation === 'insert')
  assert.equal(person.payload.tenant_id, HEAD)
  assert.equal(person.payload.email, 'ada@example.com')
  assert.equal(person.payload.phone, '5551234567')
  assert.equal(person.payload.date_of_birth, '2012-03-04')
  const student = h.getWrites().find(query => query.table === 'students' && query.operation === 'insert')
  assert.equal(student.payload.person_id, 'new-person')
  assert.equal(student.payload.client_status, 'active')
})

test('a name is required and a malformed email is refused', async () => {
  const h = setup()
  const blank = await h.load(route).POST(request({ first_name: '  ', last_name: '' }))
  assert.equal(blank.status, 400)
  const bad = await h.load(route).POST(request({ first_name: 'Ada', email: 'not-an-email' }))
  assert.equal(bad.status, 400)
  assert.equal(h.getWrites().length, 0)
})

test('invalid, impossible and future birthdays are refused before writing', async () => {
  for (const date_of_birth of ['invalid', '2025-02-29', '2012-04-31', '1899-12-31', '9999-01-01']) {
    const h = setup()
    const response = await h.load(route).POST(request({ first_name: 'Ada', date_of_birth }))
    assert.equal(response.status, 400, date_of_birth)
    assert.equal(h.getWrites().length, 0)
  }
})

test('an existing email is reported instead of creating a duplicate person', async () => {
  const h = setup({ people: [{ id: 'p1', tenant_id: HEAD, email: 'ada@example.com', phone: null }] })
  const response = await h.load(route).POST(request({ first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' }))
  assert.equal(response.status, 409)
  assert.equal(h.getWrites().length, 0)
})

test('a failed student write does not leave a person behind', async () => {
  const h = setup({ queryResult: ({ table, operation }) => table === 'people' && operation === 'insert' ? { data: { id: 'new-person' }, error: null } : table === 'students' && operation === 'insert' ? { data: null, error: { message: 'offline' } } : undefined })
  const response = await h.load(route).POST(request({ first_name: 'Ada' }))
  assert.equal(response.status, 503)
  assert.ok(h.getWrites().some(query => query.table === 'people' && query.operation === 'delete'))
})

test('the write needs contact manage permission', async () => {
  const h = setup({ grants: ['contacts.read'] })
  const response = await h.load(route).POST(request({ first_name: 'Ada' }))
  assert.equal(response.status, 403)
})
