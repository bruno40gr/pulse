/* eslint-disable @typescript-eslint/no-require-imports -- Fictional sample scheduling contracts. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHarness } = require('./synthetic-harness.cjs')
const h = createHarness()
const read = file => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8')

function fixture() {
  const setup = h.load('beta-source/lib/odeon-demo-setup.ts').createDemoSetup()
  const sample = h.load('beta-source/lib/odeon-demo-workspace.ts').createDemoWorkspace()
  const scheduling = h.load('beta-source/lib/academy-makeup-preview.ts')
  const { academyRescheduleAvailability } = h.load('beta-source/lib/academy-reschedule-availability.ts')
  const data = scheduling.expandPreviewCalendar(sample.data, '2027-02-03')
  const lesson = data.lessons.find(item => item.id === 'demo:enrollment-1:calendar:2026-11-16')
  const student = data.students.find(person => person.enrollments.some(enrollment => enrollment.id === 'demo:enrollment-1'))
  const enrollment = student.enrollments.find(item => item.id === 'demo:enrollment-1')
  const account = data.accounts.find(item => item.studentIds.includes(student.id))
  const makeup = { id: lesson.id, lessonId: lesson.id, studentId: student.id, enrollmentId: enrollment.id, date: lesson.date, duration: 30, program: enrollment.program, teacher: lesson.teacher, service: enrollment.service }
  const availabilityData = { ...data, lessons: data.lessons.filter(item => item.id !== lesson.id) }
  const resolve = academyRescheduleAvailability({ setup, groups: [], events: [] })
  return { setup, sample, scheduling, data, lesson, student, enrollment, account, makeup, availabilityData, resolve }
}

test('Contacts rescheduling offers the academy hours Calendar validates', () => {
  const { availabilityData, sample, makeup, resolve } = fixture()
  const slots = resolve(availabilityData, sample.makeups, makeup, '2026-11-12', 'Piano', true)
  assert.ok(slots.length)
  assert.equal([...new Set(slots.map(slot => slot.teacher))].join(','), 'Maya Chen')
  // School Setup has Maya teaching 13:00-19:00 on Thursdays in 30-minute lessons.
  assert.equal(slots.map(slot => slot.time).join(','), '13:00,13:30,14:00,14:30,15:00,16:30,17:00,17:30,18:00,18:30')
})

test('booked teacher time and unconfigured durations are never offered', () => {
  const { availabilityData, sample, makeup, resolve } = fixture()
  const slots = resolve(availabilityData, sample.makeups, makeup, '2026-11-12', 'Piano', true).map(slot => slot.time)
  // Maya teaches two Felix lessons 15:30-16:30 on this date.
  assert.ok(!slots.includes('15:30'))
  assert.ok(!slots.includes('16:00'))
  assert.equal(resolve(availabilityData, sample.makeups, { ...makeup, duration: 15 }, '2026-11-12', 'Piano', true).length, 0)
  assert.equal(resolve(availabilityData, sample.makeups, { ...makeup, program: 'Guitar' }, '2026-11-12', 'Piano', true).length, 0)
})

test('teacher time off and date overrides come from the same configured records as Calendar', () => {
  const { setup, availabilityData, sample, makeup } = fixture()
  const { academyRescheduleAvailability } = h.load('beta-source/lib/academy-reschedule-availability.ts')
  const off = structuredClone(setup)
  off.teachers.find(teacher => teacher.values.name === 'Maya Chen').values.timeOff = JSON.stringify([{ id: 'off', start: '2026-11-12', end: '2026-11-12', allDay: true, from: 0, to: 0, sickLeave: false }])
  assert.equal(academyRescheduleAvailability({ setup: off, groups: [], events: [] })(availabilityData, sample.makeups, makeup, '2026-11-12', 'Piano', true).length, 0)
  const override = structuredClone(setup)
  override.teachers.find(teacher => teacher.values.name === 'Maya Chen').values.availabilityOverrides = JSON.stringify([{ id: 'extra', date: '2026-11-13', blocks: [{ id: 'extra-block', day: 4, from: 540, to: 660 }] }])
  const slots = academyRescheduleAvailability({ setup: override, groups: [], events: [] })(availabilityData, sample.makeups, makeup, '2026-11-13', 'Piano', true).map(slot => slot.time)
  assert.equal(slots.join(','), '09:00,09:30,10:00,10:30')
})

test('any-teacher rescheduling only offers staff assigned to the service', () => {
  const { setup, availabilityData, sample, makeup, resolve } = fixture()
  const slots = resolve(availabilityData, sample.makeups, makeup, '2026-11-12', 'Piano', false)
  const qualified = new Set(setup.teachers.filter(teacher => JSON.parse(teacher.values.assignments).some(item => item.serviceId === 'piano' || item.serviceId === 'tiny')).map(teacher => teacher.values.name))
  assert.ok(slots.length)
  for (const slot of slots) assert.ok(qualified.has(slot.teacher), `${slot.teacher} does not teach piano`)
  assert.ok(slots.some(slot => slot.teacher !== 'Maya Chen'))
  assert.ok(!slots.some(slot => slot.teacher === 'Ava Bennett'))
})

test('configured 45-minute classes stay reschedulable without accepting unlisted lengths', () => {
  const { data, sample, resolve } = fixture()
  const student = data.students.find(person => person.enrollments.some(enrollment => enrollment.program === 'Tiny Keys'))
  const enrollment = student.enrollments.find(item => item.program === 'Tiny Keys')
  const lesson = data.lessons.find(item => item.enrollmentId === enrollment.id)
  const makeup = { id: lesson.id, lessonId: lesson.id, studentId: student.id, enrollmentId: enrollment.id, date: lesson.date, duration: enrollment.duration, program: 'Tiny Keys', teacher: lesson.teacher || enrollment.teacher, service: enrollment.service }
  const availabilityData = { ...data, lessons: data.lessons.filter(item => item.id !== lesson.id) }
  assert.equal(enrollment.duration, 45)
  assert.ok(resolve(availabilityData, sample.makeups, makeup, '2026-11-12', 'Tiny Keys', true).length, 'Configured 45-minute group classes can move')
  // Piano is configured for 30, 45 and 60 minutes; 15-minute extensions are not offered anywhere.
  assert.equal(resolve(availabilityData, sample.makeups, { ...makeup, duration: 15 }, '2026-11-12', 'Tiny Keys', true).length, 0)
})

test('moving a lesson validates against the same slots the reschedule screen shows', () => {
  const { scheduling, data, sample, account, lesson, makeup, availabilityData, resolve } = fixture()
  const slot = resolve(availabilityData, sample.makeups, makeup, '2026-11-12', 'Piano', true).find(item => item.time === '13:00')
  assert.ok(slot)
  const moved = scheduling.movePreviewLesson(data, sample.makeups, account.id, lesson.id, slot, resolve)
  const updated = moved.data.lessons.find(item => item.id === lesson.id)
  assert.equal(updated.date, '2026-11-12')
  assert.equal(updated.time, '13:00')
  assert.throws(() => scheduling.movePreviewLesson(data, sample.makeups, account.id, lesson.id, { date: '2026-11-12', time: '15:30', teacher: 'Maya Chen', program: 'Piano' }, resolve), /available lesson time/)
})

test('45-minute lessons are configured for Tiny Keys and Little Rockers only', () => {
  const { setup, data } = fixture()
  const durations = id => setup.services.find(service => service.id === id).values.durations
  assert.equal(durations('tiny'), '45')
  assert.equal(durations('rockers'), '45')
  assert.equal(durations('piano'), '30, 45, 60')
  const { bookingReason } = h.load('beta-source/lib/academy-calendar-booking.ts')
  const teacher = setup.teachers.find(item => item.id === 'demo:teacher-1')
  const reason = bookingReason({ data, setup, groups: [], occurrences: [] }, {
    id: 'probe', kind: 'lesson', title: 'Piano', date: '2026-11-12', time: '13:00', duration: 45,
    serviceId: 'piano', teacherId: teacher.id, roomId: setup.locations[0].rooms[0].id, studentIds: [data.students[0].id],
    groupId: '', repeat: 'once', until: '2026-11-12', publicOnly: false, status: 'Scheduled',
  })
  assert.equal(reason, null, 'Piano lists 45 minutes in the sample configuration')
})

test('a completed band enrollment appears once on the academy calendar', () => {
  const { data } = fixture()
  const student = data.students[0]
  const account = data.accounts.find(item => item.studentIds.includes(student.id))
  const { projectBetaBandMembership } = h.load('beta-source/lib/beta-workflow-projection.ts')
  const { betaCalendarOccurrences } = h.load('beta-source/lib/beta-academy-calendar.ts')
  const { expandPreviewCalendar } = h.load('beta-source/lib/academy-makeup-preview.ts')
  const next = projectBetaBandMembership(data, { enrollmentId: 'beta:band:test', studentId: student.id, payerId: account.holderId, paymentMethod: 'Demo card', amountMinor: 9000, paid: true, bandName: 'The Testers', teacher: 'Maya Chen', start: '2026-11-05', seriesId: 'band-test', time: '16:00', duration: 60 })
  const expanded = expandPreviewCalendar(next, '2026-11-20')
  // A band created through the workflow stores no seriesId; its own id is the linked series.
  const group = { id: 'band-test', typeId: 'type', name: 'The Testers', leader: 'Maya Chen', capacity: 8, trialMax: 1, memberIds: [student.id], schedule: 'Thursday 4pm', resources: [], eventIds: [], message: '', dailySchedule: { days: ['Thursday'], from: '16:00', to: '17:00' } }
  const occurrences = betaCalendarOccurrences(expanded, [group], [], ['2026-11-12'])
  const sessions = occurrences.filter(item => item.enrollmentId === 'beta:band:test')
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].start, '16:00')
  assert.equal(sessions[0].end, '17:00')
  assert.equal(sessions[0].studentIds.length, 1)
  assert.equal(sessions[0].studentIds[0], student.id)
  assert.equal(occurrences.filter(item => item.groupId === 'band-test' && !item.enrollmentId).length, 0, 'The band is not rendered twice')
})

test('Beta onboarding opens the academy records already configured for the sample school', () => {
  const setup = read('beta-source/app/content-studio-prototype/school-setup/SchoolSetup.tsx')
  assert.match(setup, /useState<SetupExperience>\(embedded \|\| configuredData \? 'configured' : 'new'\)/)
  assert.match(setup, /setExperience\(embedded \|\| configuredData \|\| params\.get\('experience'\) === 'configured' \? 'configured' : 'new'\)/)
})

test('teacher day, contacts and calendar rescheduling share one availability source', () => {
  const teacherDay = read('beta-source/app/odeon-demo/TeacherExperience.tsx')
  // Availability is published by the school office; a teacher never edits it here.
  assert.match(teacherDay, /<TeacherSchedule values=\{teacher\.values\} onChange=\{updateTeacher\} readOnly \/>/)
  assert.doesNotMatch(teacherDay, /title="Current teaching hours"/)
  for (const file of ['MoveLesson', 'MakeupWorkspace', 'FamilyReschedule', 'StudentWorkspaceV2', 'ParentPortal']) {
    const source = read(`beta-source/app/content-studio-prototype/students/${file}.tsx`)
    assert.match(source, /useRescheduleAvailability/, `${file} must resolve slots from the configured academy`)
  }
  const workspace = read('beta-source/app/odeon-demo/DemoWorkspace.tsx')
  assert.match(workspace, /rescheduleAvailability: academyRescheduleAvailability\(\{ setup, groups: queue\.academy\.groups, events: queue\.state\.events \}\)/)
})

test('a teacher account is locked to its own staff record', () => {
  const me = read('app/api/account/me/route.ts')
  assert.match(me, /personId: result\.context\.personId/, 'The session exposes the signed-in person')
  const teacherDay = read('beta-source/app/odeon-demo/TeacherExperience.tsx')
  assert.match(teacherDay, /item\.values\.personId === me\.personId/, 'Teacher records map through the person id')
  assert.match(teacherDay, /not connected to a teaching profile/, 'An unlinked account never sees another teacher')
})

