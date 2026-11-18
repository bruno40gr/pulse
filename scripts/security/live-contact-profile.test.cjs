/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic route and family fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')

const student = '10000000-0000-0000-0000-000000000001'
const holder = '10000000-0000-0000-0000-000000000002'
const sibling = '10000000-0000-0000-0000-000000000003'
const summary = '10000000-0000-0000-0000-000000000004'
const profileRoute = 'app/api/contacts/[id]/profile/route.ts'
const accountRoute = 'app/api/contacts/accounts/[id]/profile/route.ts'

function setup(grants = ['contacts.manage', 'notes.manage'], options = {}) {
  const h = createHarness()
  const people = [student, holder, sibling].map(id => ({ id, tenant_id: HEAD, first_name: 'Original', email: 'original@example.test', updated_at: '2026-11-01T00:00:00Z' }))
  people.push({ id: 'staff', tenant_id: HEAD, first_name: 'Staff' })
  const accounts = [{ id: summary, tenant_id: HEAD, name: 'Holder', email: 'holder@example.test', phone: null }]
  h.setScenario({ actor: { personId: 'staff', displayName: 'Staff', ...options.actor }, fixtures: {
    people, accounts,
    tenant_memberships: [{ id: 'membership', tenant_id: HEAD, person_id: 'staff', role_id: 'role', legacy_access_enabled: true, status: 'unclaimed' }],
    roles: [{ id: 'role', tenant_id: HEAD, key: 'staff' }],
    permissions: grants.map(key => ({ id: key, key })),
    role_permissions: grants.map(key => ({ role_id: 'role', permission_id: key })),
  }, queryResult({ table, operation, payload, filters }) {
    if (!['people', 'accounts'].includes(table) || operation !== 'update') return
    if (options.fail) return { data: null, error: { code: 'synthetic' } }
    const row = (table === 'people' ? people : accounts).find(row => filters.filter(([method]) => method === 'eq').every(([, key, value]) => row[key] === value))
    return { data: row ? { ...Object.assign(row, payload) } : null, error: null }
  } })
  const call = (route, method, id, body, tenant = HEAD) => h.load(route)[method](new Request(`https://synthetic.invalid/api/contacts/${id}?tenant=${tenant}`, { method, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })
  return { h, people, call, patch: (id, body, tenant) => call(profileRoute, 'PATCH', id, body, tenant) }
}

test('contact drafts emit only changed fields and clear optional fields as null', () => {
  const profile = createHarness().load('lib/contact-profile.ts')
  const original = profile.contactProfileDraft({ first_name: 'Alex', phone: '555 555 0100', email: 'alex@example.test', date_of_birth: '2000-02-29' })
  const changed = profile.changedContactProfile(original, { ...original, first_name: ' Alex ', phone: '', email: '', date_of_birth: '' })
  assert.equal(JSON.stringify(changed), JSON.stringify({ phone: null, email: null, date_of_birth: null }))
  for (const body of [{ first_name: null }, { email: 'not-an-address' }, { phone: '123' }, { date_of_birth: '2026-02-29' }, { date_of_birth: '2030-01-01' }, { account_holder_phone: '555 555 0100' }, { message_routing: 'student' }, { tenant_id: HEAD }]) {
    assert.equal(profile.validateContactProfile(body, '2026-11-18').ok, false)
  }
})

test('authorized student and holder edits return saved values and touch only each person', async () => {
  const { h, patch, people } = setup()
  const response = await patch(student, { phone: ' (202) 555-0101 ', email: null })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).phone, '(202) 555-0101')
  const updatedHolder = await patch(holder, { first_name: 'Holder', date_of_birth: '1980-02-29' })
  assert.equal(updatedHolder.status, 200)
  assert.equal((await updatedHolder.json()).first_name, 'Holder')
  assert.equal(people.find(row => row.id === student).email, null)
  assert.equal(people.find(row => row.id === holder).email, 'original@example.test')
  assert.equal(people.find(row => row.id === sibling).first_name, 'Original')
  assert.ok(h.getWrites().every(write => write.table === 'people' && write.filters.some(filter => filter[1] === 'tenant_id' && filter[2] === HEAD)))
})

test('view-only and foreign sessions cannot write, demo labs keep editing, summary IDs have no write target', async () => {
  for (const [fixture, id, tenant, status] of [
    [setup(['contacts.read', 'notes.read']), student, HEAD, 403],
    [setup(), student, DEMO, 403],
    [setup(undefined, { actor: { access: { kind: 'demo', tenantId: DEMO } } }), student, HEAD, 403],
  ]) {
    assert.equal((await fixture.patch(id, { email: null }, tenant)).status, status)
    assert.equal(fixture.h.getWrites().length, 0)
  }
  assert.equal((await setup().patch(summary, { email: null })).status, 404)
  const demo = setup(undefined, { actor: { access: { kind: 'demo', tenantId: HEAD } } })
  assert.equal((await demo.patch(student, { email: null })).status, 200)
  assert.deepEqual(demo.h.getWrites().map(write => write.table), ['people'])
})

test('invalid fields never reach the database and rejected writes return an error', async () => {
  const fixture = setup()
  for (const body of [{ email: 'invalid' }, { date_of_birth: '1999-04-31' }, { account_holder_email: 'other@example.test' }, { notes_history: [] }, {}]) {
    assert.equal((await fixture.patch(student, body)).status, 400)
  }
  assert.equal(fixture.h.getWrites().length, 0)
  const failure = await setup(undefined, { fail: true }).patch(student, { email: null })
  assert.equal(failure.status, 500)
  assert.match((await failure.json()).error, /Could not save/)
})

test('the account holder profile edits the account ID without writing any student or person', async () => {
  const { h, call, people } = setup()
  const response = await call(accountRoute, 'PATCH', summary, { name: 'Updated Holder', email: null })
  assert.equal(response.status, 200)
  const saved = await response.json()
  assert.equal(saved.name, 'Updated Holder')
  assert.equal(saved.email, null)
  assert.equal(people.find(row => row.id === student).first_name, 'Original')
  assert.deepEqual(h.getWrites().map(write => write.table), ['accounts'])
  assert.equal((await call(accountRoute, 'PATCH', student, { name: 'Wrong target' })).status, 404)
  assert.equal((await call(accountRoute, 'PATCH', summary, { date_of_birth: '2000-01-01' })).status, 400)
  const readonly = setup(['contacts.read'])
  assert.equal((await readonly.call(accountRoute, 'PATCH', summary, { email: null })).status, 403)
  assert.equal(readonly.h.getWrites().length, 0)
})

test('family navigation uses tenant-local explicit IDs, not a contact name or shared address', () => {
  const { contactProfileFamilies } = createHarness().load('lib/contact-profile-family.ts')
  const rows = [
    { id: student, tenant_id: HEAD, is_student: true, account_id: summary, account_holders: [{ person_id: holder }, { person_id: 'foreign' }] },
    { id: sibling, tenant_id: HEAD, is_student: true, account_id: summary },
    { id: holder, tenant_id: HEAD, is_student: false, email: 'shared@example.test' },
    { id: 'other', tenant_id: HEAD, is_student: false, email: 'shared@example.test' },
    { id: 'foreign', tenant_id: DEMO, account_id: summary },
  ]
  const [family] = contactProfileFamilies(rows, HEAD, holder)
  assert.deepEqual(Array.from(family.students, row => row.id), [student, sibling])
  assert.deepEqual(Array.from(family.holders, row => row.id), [holder])
  assert.equal(contactProfileFamilies(rows, HEAD, 'other').length, 0)
})

test('both note types use the selected person only and deny view-only writes', async () => {
  for (const [kind, field] of [['student-notes', 'student_notes_history'], ['internal-notes', 'notes_history']]) {
    const route = `app/api/contacts/[id]/${kind}/route.ts`
    const { call, people } = setup()
    const posted = await call(route, 'POST', holder, { text: 'Holder follow-up' })
    assert.equal(posted.status, 201)
    const { note } = await posted.json()
    assert.equal(people.find(row => row.id === holder)[field][0].text, 'Holder follow-up')
    assert.equal(people.find(row => row.id === student)[field], undefined)
    assert.equal((await call(route, 'PATCH', holder, { note_id: note.id })).status, 200)
    assert.ok(people.find(row => row.id === holder)[field][0].completed_at)
    assert.equal((await call(route, 'POST', summary, { text: 'No person target' })).status, 404)
    const readonly = setup(['contacts.read', 'notes.read'])
    assert.equal((await readonly.call(route, 'POST', holder, { text: 'Denied' })).status, 403)
    assert.equal((await readonly.call(route, 'PATCH', holder, { note_id: note.id })).status, 403)
    assert.equal(readonly.h.getWrites().length, 0)
  }
})