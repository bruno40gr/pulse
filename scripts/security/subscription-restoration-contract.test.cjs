/* eslint-disable @typescript-eslint/no-require-imports -- Offline regression of the original subscription repair's route contracts. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')

const request = body => new Request(`https://synthetic.invalid/api/contacts?tenant=${HEAD}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})
const staff = () => ({ actor: { personId: 'staff', displayName: 'Staff' }, fixtures: {
  people: [{ id: 'staff', tenant_id: HEAD }],
  tenant_memberships: [{ id: 'membership', tenant_id: HEAD, person_id: 'staff', role_id: 'owner', legacy_access_enabled: true, status: 'unclaimed' }],
  roles: [{ id: 'owner', tenant_id: HEAD, key: 'owner' }],
} })
const exportHeader = 'Id,Client Id,Primary Staff Id,Primary Staff Name,Service Name,Plan Name,Status\n'
const exportRow = '00000000-0000-0000-0000-000000000010,00000000-0000-0000-0000-000000000011,00000000-0000-0000-0000-000000000012,Current Teacher,Piano - Level 2 (30 min),Monthly Private Piano,Active\n'

test('actual Contacts select includes native enrollment status before current-teacher projection', async () => {
  const h = createHarness()
  h.setScenario({ actor: { access: { kind: 'demo', tenantId: HEAD } }, fixtures: {
    people: [{ id: 'student', tenant_id: HEAD, students: [{ id: 'role', enrollments: [
      { id: 'old', status: 'ended', instructor_person_id: 'old-teacher', custom_fields: {} },
      { id: 'new', status: 'active', instructor_person_id: 'new-teacher', custom_fields: {} },
    ] }] },
    { id: 'old-teacher', tenant_id: HEAD, first_name: 'Old', custom_fields: { staff_status: 'sunset' } },
    { id: 'new-teacher', tenant_id: HEAD, first_name: 'New', last_name: 'Teacher' }],
  } })
  const response = await h.load('app/api/contacts/route.ts').GET(new Request(`https://synthetic.invalid/api/contacts?tenant=${HEAD}`))
  assert.equal(response.status, 200)
  // The harness does not project nested selects: assert the real request contract,
  // so a fixture's status field cannot conceal its absence from the SQL projection.
  const select = h.getQueries().flatMap(query => query.filters)
    .find(filter => filter[0] === 'select' && /enrollments\s*\(/.test(filter[1]))?.[1]
  assert.match(select, /enrollments\s*\(\s*id,\s*status,/)
  const student = (await response.json()).find(row => row.id === 'student')
  assert.equal(student.instructor.name, 'New Teacher')
  assert.deepEqual(student.profile_enrollments.map(row => row.id), ['new'])
  assert.equal(h.getWrites().length, 0)
})

test('booking-only contacts stay non-students while mixed current subscriptions retain student identity', async () => {
  const h = createHarness()
  const booking = { id: 'booking', status: 'active', plan_name: 'Room booking' }
  h.setScenario({ actor: { access: { kind: 'demo', tenantId: HEAD } }, fixtures: {
    people: [
      { id: 'booking-only', tenant_id: HEAD, students: [{ id: 'booking-role', enrollments: [booking] }] },
      { id: 'mixed', tenant_id: HEAD, students: [{ id: 'student-role', enrollments: [booking,
        { id: 'lesson', status: 'active', plan_name: 'Private Piano' }] }] },
    ],
  } })
  const response = await h.load('app/api/contacts/route.ts').GET(new Request(`https://synthetic.invalid/api/contacts?tenant=${HEAD}`))
  assert.equal(response.status, 200)
  const rows = await response.json(), bookingOnly = rows.find(row => row.id === 'booking-only'), mixed = rows.find(row => row.id === 'mixed')
  assert.equal(bookingOnly.is_student, false)
  assert.equal(bookingOnly.student_id, null)
  assert.equal(bookingOnly.custom_fields.contact_kind, 'booking')
  assert.deepEqual(bookingOnly.profile_enrollments, [])
  assert.equal(mixed.is_student, true)
  assert.equal(mixed.student_id, 'student-role')
  assert.deepEqual(mixed.profile_enrollments.map(row => row.id), ['lesson'])
  assert.equal(h.getWrites().length, 0)
})

test('legacy attendance import rejects subscription exports before domain reads or writes', async () => {
  for (const [csv, status] of [
    [exportHeader + exportRow, 409],
    [exportHeader + exportRow.replace(',Active\n', ',Ended\n'), 409],
    ['Primary Staff Name,Plan Name\nTeacher,Private Piano\n', 400],
    [exportHeader + exportRow + exportRow, 400],
  ]) {
    const h = createHarness()
    h.setScenario(staff())
    const response = await h.load('app/api/contacts/route.ts').POST(request({ csv }))
    assert.equal(response.status, status)
    assert.match((await response.json()).error, /subscription|Subscription/)
    assert.equal(h.getWrites().length, 0)
    assert.equal(h.getQueries().some(query => ['enrollments', 'import_profiles', 'accounts'].includes(query.table)), false)
  }
})

test('attendance import preserves source-linked subscriptions and targets only the legacy enrollment', async () => {
  const h = createHarness(), base = staff()
  h.setScenario({ ...base, fixtures: { ...base.fixtures,
    people: [...base.fixtures.people, { id: 'student-person', tenant_id: HEAD, first_name: 'Synthetic', last_name: 'Student', custom_fields: { external_id: 'source-client' } }],
    students: [{ id: 'student-role', person_id: 'student-person', tenant_id: HEAD }],
  }, queryResult: query => {
    if (query.table !== 'enrollments' || query.operation !== 'select') return undefined
    const guarded = query.filters.some(filter => filter[0] === 'is' && filter[1] === 'custom_fields->>subscription_id' && filter[2] === null)
    return { data: guarded ? { id: 'legacy-enrollment', custom_fields: {} } : { id: 'reconciled-subscription', custom_fields: { subscription_id: 'source-subscription' } }, error: null }
  } })
  const response = await h.load('app/api/contacts/route.ts').POST(request({
    csv: 'Client Name,Client Id,Instrument\nSynthetic Student,source-client,Piano\n',
  }))
  assert.equal(response.status, 200)
  const selection = h.getQueries().find(query => query.table === 'enrollments' && query.operation === 'select')
  assert.ok(selection)
  assert.ok(selection.filters.some(filter => filter[0] === 'is' && filter[1] === 'custom_fields->>subscription_id' && filter[2] === null))
  const updates = h.getWrites().filter(query => query.table === 'enrollments')
  assert.equal(updates.length, 1)
  assert.ok(updates[0].filters.some(filter => filter[0] === 'eq' && filter[1] === 'id' && filter[2] === 'legacy-enrollment'))
})