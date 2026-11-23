/* eslint-disable @typescript-eslint/no-require-imports -- Offline server scheduling contracts. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD } = require('./synthetic-harness.cjs')
const h = createHarness()
const { academySchedulingError: validate } = h.load('lib/academy-scheduling-validation.ts')
const { teachingPolicyReason, readSchedulingPolicy } = h.load('beta-source/lib/academy-scheduling-policy.ts')
const { bookingReason, saveCalendarBooking } = h.load('beta-source/lib/academy-calendar-booking.ts')
const date = '2026-11-23'
function fixture() {
  return {
    snapshot: { data: { students: [], accounts: [], lessons: [], calendarBookings: [] }, makeups: { items: [], absences: [] } },
    setup: {
      teachers: [{ id: 'staff', values: { name: 'Test Staff', canPerformAdmin: 'yes', assignments: '[{"serviceId":"piano","maxLevel":2}]', locationIds: '["school"]', availability: '[{"id":"hours","day":0,"from":540,"to":1260}]' } }],
      services: [{ id: 'piano', values: { name: 'Piano', durations: '30,60', formats: '["private"]' } }],
      locations: [{ id: 'school', values: { name: 'School' }, rooms: [{ id: 'room', name: 'Piano room', capacity: '1', serviceIds: ['piano'] }] }],
      policies: [], adminResponsibilities: [{ id: 'desk', values: { name: 'Front desk', enabled: 'Yes' } }],
    },
  }
}
function admin(overrides = {}) {
  return { id: 'admin', kind: 'admin', title: 'Admin · Front desk', date, time: '10:00', duration: 30, teacherId: 'staff', roomId: '', locationId: 'school', responsibilityId: 'desk', responsibilityName: 'Front desk', studentIds: [], groupId: '', serviceId: '', repeat: 'once', until: date, publicOnly: false, status: 'Scheduled', ...overrides }
}
function lesson(state, overrides = {}) {
  const enrollment = { id: 'enrollment', studentId: 'student', program: 'Piano', service: 'Private', teacher: 'Test Staff', teacherId: 'staff', serviceId: 'piano', start: date, frequency: 'One-off', status: 'active', level: 2, duration: 30, time: '11:00', ...overrides }
  state.snapshot.data.students.push({ id: 'student', firstName: 'Test', lastName: 'Student', enrollments: [enrollment] })
  state.snapshot.data.lessons.push({ id: 'lesson', enrollmentId: enrollment.id, date, time: enrollment.time, room: 'Piano room', status: 'Scheduled' })
  return state
}
test('valid server-owned lesson and Admin occupancy pass with no automatic room reservation', () => {
  const state = lesson(fixture())
  state.snapshot.data.calendarBookings.push(admin())
  assert.equal(validate(state, null, date), null)
  assert.equal(saveCalendarBooking({ data: state.snapshot.data, setup: state.setup, groups: [], occurrences: [] }, admin({ id: 'other', time: '12:00' })).calendarBookings.at(-1).responsibilityName, 'Front desk')
})
test('admin-only staff can work without gaining teaching qualification', () => {
  const state = fixture()
  state.setup.teachers[0].values.assignments = '[]'
  state.snapshot.data.calendarBookings.push(admin())
  assert.equal(validate(state, null, date), null)
  lesson(state)
  assert.match(validate(state, null, date), /does not teach/)
  const { setupAreas, validateSetup } = h.load('beta-source/app/content-studio-prototype/school-setup/setup-content.ts')
  const values = { name: 'Admin Only', canPerformAdmin: 'yes', assignments: '[]', service: '', location: 'school', days: 'Monday', from: '09:00', to: '17:00' }
  assert.equal(validateSetup(setupAreas.find(area => area.id === 'teachers'), values), null)
})
test('server rejects unqualified levels, unavailable dates and time off', () => {
  const state = lesson(fixture(), { level: 3 })
  assert.match(validate(state, null, date), /not qualified/)
  state.snapshot.data.students[0].enrollments[0].level = 2
  state.setup.teachers[0].values.timeOff = JSON.stringify([{ id: 'off', start: date, end: date, allDay: true }])
  assert.match(validate(state, null, date), /unavailable/)
  state.setup.teachers[0].values.timeOff = '[]'
  state.setup.teachers[0].values.availabilityOverrides = JSON.stringify([{ date, blocks: [] }])
  assert.match(validate(state, null, date), /unavailable/)
})
test('server rejects teacher overlap despite forged client display names', () => {
  const state = lesson(fixture())
  state.snapshot.data.calendarBookings.push(admin({ time: '11:00', teacherName: 'Someone Else' }))
  assert.match(validate(state, null, date), /already.*booking|already assigned/)
})
test('server rejects room, capacity, location and service incompatibility', () => {
  for (const mutate of [
    state => { state.setup.locations[0].rooms[0].serviceIds = [] },
    state => { state.setup.locations[0].rooms[0].capacity = '0' },
    state => { state.setup.teachers[0].values.locationIds = '["elsewhere"]' },
  ]) {
    const state = lesson(fixture()); mutate(state)
    assert.ok(validate(state, null, date))
  }
})
test('missing, archived and deleted responsibilities fail closed for new work', () => {
  for (const responsibilities of [[], [{ id: 'desk', values: { name: 'Front desk', enabled: 'No' } }]]) {
    const state = fixture(); state.setup.adminResponsibilities = responsibilities
    state.snapshot.data.calendarBookings.push(admin())
    assert.match(validate(state, null, date), /responsibility/)
  }
})
test('archiving and renaming preserves existing responsibility labels', () => {
  const previous = fixture(); previous.snapshot.data.calendarBookings.push(admin())
  const state = structuredClone(previous)
  state.setup.adminResponsibilities[0].values = { name: 'Reception', enabled: 'No' }
  assert.equal(validate(state, previous, date), null)
  state.snapshot.data.calendarBookings[0].responsibilityName = 'Reception'
  assert.match(validate(state, previous, date), /original Admin responsibility/)
})
test('new Front desk top-level category and Admin public participants are rejected', () => {
  const state = fixture(); state.snapshot.data.calendarBookings.push(admin({ kind: 'front-desk' }))
  assert.match(validate(state, null, date), /Use Admin/)
  state.snapshot.data.calendarBookings = [admin({ participantIds: ['student'] })]
  assert.ok(validate(state, null, date))
  state.snapshot.data.calendarBookings = [admin({ publicOnly: true })]
  assert.match(validate(state, null, date), /cannot contain/)
})
test('Admin never substitutes for protected rest after four hours teaching', () => {
  const teaching = Array.from({ length: 8 }, (_, i) => ({ time: `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`, duration: 30 }))
  const policy = readSchedulingPolicy()
  assert.equal(teachingPolicyReason(teaching, '13:30', 30, policy), null)
  assert.match(teachingPolicyReason(teaching, '13:30', 30, policy, [{ time: '13:00', duration: 30 }]), /slot must stay free/)
  assert.equal(teachingPolicyReason(teaching, '14:00', 30, policy, [{ time: '13:00', duration: 30 }]), null)
})
test('adding Admin to a previously protected break is rejected in either save order', () => {
  const state = fixture(); state.snapshot.data.calendarBookings.push(admin({ time: '13:00' }))
  const occurrences = Array.from({ length: 8 }, (_, i) => ({ id: `teaching-${i}`, kind: 'lesson', date, start: `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`, end: `${String(9 + Math.floor((i + 1) / 2)).padStart(2, '0')}:${(i + 1) % 2 ? '30' : '00'}`, teacherId: 'staff', teacherName: 'Test Staff', studentIds: [], status: 'Scheduled' }))
  occurrences.push({ ...occurrences[0], id: 'after', start: '13:30', end: '14:00' })
  const context = { data: state.snapshot.data, setup: state.setup, groups: [], occurrences }
  assert.match(bookingReason(context, state.snapshot.data.calendarBookings[0]), /slot must stay free/)
  assert.equal(bookingReason({ ...context, occurrences: [] }, admin({ time: '13:00' })), null, 'No invented admin-only teaching-break rule')
})
test('every recurring Admin occurrence checks date-specific time off', () => {
  const state = fixture()
  state.snapshot.data.calendarBookings.push(admin({ repeat: 'weekly', until: '2026-12-07' }))
  state.setup.teachers[0].values.timeOff = '[{"id":"off","start":"2026-11-30","end":"2026-11-30","allDay":true}]'
  assert.match(validate(state, null, date), /2026-11-30.*unavailable/)
})
test('malformed JSON, duplicate IDs, invalid dates and recurrence bounds fail closed', () => {
  for (const mutate of [
    state => { state.setup.teachers[0].values.assignments = 'null' },
    state => { state.setup.teachers.push(structuredClone(state.setup.teachers[0])) },
    state => { state.snapshot.data.calendarBookings.push(admin({ date: '2026-02-30' })) },
    state => { state.snapshot.data.calendarBookings.push(admin({ repeat: 'weekly', until: '2030-01-01' })) },
    state => { state.snapshot.data.calendarBookings.push(admin({ time: '10:15' })) },
  ]) { const state = fixture(); mutate(state); assert.ok(validate(state, null, date)) }
})
test('existing enrollment level cannot be lowered to evade qualification checks', () => {
  const previous = lesson(fixture(), { level: 3 })
  const state = structuredClone(previous); state.snapshot.data.students[0].enrollments[0].level = 1
  assert.match(validate(state, previous, date), /silently lower/)
})
test('API rejects invalid scheduling before RPC and requires matching tenant revision', async () => {
  const harness = createHarness(), route = harness.load('app/api/academy/workspace/route.ts')
  const permissions = ['staff.read', 'staff.manage']
  const fixtures = { tenant_memberships: [{ id: 'member', tenant_id: HEAD, person_id: 'person', auth_user_id: 'auth', role_id: 'role', status: 'active' }], roles: [{ id: 'role', tenant_id: HEAD, key: 'admin' }], role_permissions: permissions.map((_, i) => ({ role_id: 'role', permission_id: String(i) })), permissions: permissions.map((key, i) => ({ id: String(i), key })), tenants: [{ id: HEAD }], academy_workspaces: [{ tenant_id: HEAD, revision: 3, state: fixture() }] }
  const request = (state, revision = 3) => new Request(`http://synthetic.invalid/api/academy/workspace?tenant=${HEAD}`, { method: 'PUT', body: JSON.stringify({ state, revision }) })
  const state = fixture(); state.setup.adminResponsibilities[0].values.name = ''
  harness.setScenario({ authUser: { id: 'auth' }, fixtures })
  assert.equal((await route.PUT(request(state))).status, 422)
  assert.ok(!harness.getQueries().some(query => query.table === 'save_academy_workspace'))
  harness.setScenario({ authUser: { id: 'auth' }, fixtures })
  assert.equal((await route.PUT(request(fixture(), 2))).status, 409)
  harness.setScenario({ authUser: { id: 'auth' }, fixtures, rpcResults: { save_academy_workspace: { conflict: true } } })
  assert.equal((await route.PUT(request(fixture()))).status, 409, 'Race after validation is still rejected by RPC')
})
test('single-occurrence and future replacements preserve history without duplicate occupancy', () => {
  const { replaceCalendarAssignment, bookingOnDate } = h.load('beta-source/lib/academy-calendar-booking.ts')
  for (const scope of ['occurrence', 'future']) {
    const state = fixture()
    const source = admin({ repeat: 'weekly', until: '2026-12-14' })
    state.snapshot.data.calendarBookings.push(source)
    const context = { data: state.snapshot.data, setup: state.setup, groups: [], occurrences: [] }
    const result = replaceCalendarAssignment(context, source.id, admin({ id: 'replacement', time: '10:30' }), scope, '2026-11-30')
    const old = result.calendarBookings.find(item => item.id === source.id)
    assert.equal(bookingOnDate(old, date), true)
    assert.equal(bookingOnDate(old, '2026-11-30'), false)
    assert.equal(bookingOnDate(old, '2026-12-07'), scope === 'occurrence')
    const next = result.calendarBookings.find(item => item.id === 'replacement')
    assert.equal(bookingOnDate(next, '2026-11-30'), true)
    assert.equal(bookingOnDate(next, '2026-12-07'), scope === 'future')
    assert.equal(validate({ ...state, snapshot: { ...state.snapshot, data: result } }, state, date), null)
    assert.equal(source.until, '2026-12-14', 'Never mutates source object')
  }
})
test('configured resource blocks participate in server occupancy and malformed blocks fail closed', () => {
  const state = lesson(fixture())
  state.setup.resourceBlocks = [{ id: 'block', values: { booking: JSON.stringify(admin({ id: 'block', kind: 'block', time: '11:00', responsibilityId: undefined, responsibilityName: undefined })) } }]
  assert.match(validate(state, null, date), /blocked|already has a booking/)
  state.setup.resourceBlocks[0].values.booking = 'broken'
  assert.match(validate(state, null, date), /resource blocks/)
})
test('shared lesson participants consume capacity once as a session, not once per record', () => {
  const state = lesson(fixture())
  state.snapshot.data.lessons[0].occurrenceId = 'session'
  state.snapshot.data.students.push({ id: 'peer', firstName: 'Peer', lastName: 'Test', enrollments: [{ ...state.snapshot.data.students[0].enrollments[0], id: 'peer-enrollment', studentId: 'peer' }] })
  state.snapshot.data.lessons.push({ ...state.snapshot.data.lessons[0], id: 'peer-lesson', enrollmentId: 'peer-enrollment' })
  assert.match(validate(state, null, date), /capacity/)
  state.setup.locations[0].rooms[0].capacity = '2'
  assert.equal(validate(state, null, date), null)
})
test('completed or attended status cannot bypass future assignment validation', () => {
  const state = lesson(fixture(), { level: 3 })
  state.snapshot.data.lessons[0].status = 'Completed'
  assert.match(validate(state, null, date), /not qualified/)
})
test('responsibility deletion is rejected even after assignments are cancelled', () => {
  const previous = fixture(), next = fixture()
  next.setup.adminResponsibilities = []
  assert.match(validate(next, previous, date), /Archive Admin responsibilities/)
})