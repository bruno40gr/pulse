/* eslint-disable @typescript-eslint/no-require-imports -- Offline scheduling regression tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const h = createHarness()
const { teacherQualificationReason } = h.load('beta-source/lib/academy-teacher-qualification.ts')
const { bookingReason, teacherHours } = h.load('beta-source/lib/academy-calendar-booking.ts')

test('qualification is per service and includes every level through its maximum', () => {
  const values = { assignments: JSON.stringify([{ serviceId: 'piano', maxLevel: 2 }, { serviceId: 'guitar', maxLevel: 3 }]) }
  assert.equal(teacherQualificationReason(values, 'piano', 2), null)
  assert.match(teacherQualificationReason(values, 'piano', 3), /not qualified/)
  assert.equal(teacherQualificationReason(values, 'guitar', 3), null)
  assert.match(teacherQualificationReason(values, 'drums', 1), /does not teach/)
  assert.match(teacherQualificationReason(values, 'piano', 0), /valid teaching level/)
})

test('legacy and malformed assignments never imply unlimited qualifications', () => {
  assert.equal(teacherQualificationReason({ service: 'piano', levelIds: '["level1","level2"]' }, 'piano', 2), null)
  assert.match(teacherQualificationReason({ assignments: '[{"serviceId":"piano"}]' }, 'piano', 2), /not qualified/)
  for (const assignments of ['null', '{}', 'bad json']) {
    assert.match(teacherQualificationReason({ assignments }, 'piano'), /School Setup/)
  }
})

function fixture() {
  const setup = h.load('beta-source/lib/odeon-demo-setup.ts').createDemoSetup()
  const { data } = h.load('beta-source/lib/odeon-demo-workspace.ts').createDemoWorkspace()
  const teacher = setup.teachers.find(item => item.id === 'demo:teacher-1')
  teacher.values.assignments = '[{"serviceId":"piano","maxLevel":1}]'
  const student = data.students[0]
  const booking = { id: 'probe', kind: 'lesson', title: 'Piano', date: '2026-11-12', time: '13:00', duration: 30, serviceId: 'piano', teacherId: teacher.id, roomId: setup.locations[0].rooms[0].id, studentIds: [student.id], groupId: '', repeat: 'once', until: '2026-11-12', publicOnly: false, status: 'Scheduled' }
  return { context: { data, setup, groups: [], occurrences: [] }, teacher, student, booking }
}

test('calendar checks explicit level and preserves existing enrollment level for moves', () => {
  const { context, student, booking } = fixture()
  assert.equal(bookingReason(context, booking), null)
  assert.match(bookingReason(context, { ...booking, level: 2 }), /not qualified/)
  student.enrollments.push({ id: 'advanced', studentId: student.id, level: 3 })
  assert.match(bookingReason(context, { ...booking, enrollmentId: 'advanced', level: 1 }), /not qualified/)
  assert.match(bookingReason(context, { ...booking, enrollmentId: 'missing' }), /existing enrollment/)
})

test('dated Wednesday override replaces weekly hours and time off subtracts from it', () => {
  const { context, teacher } = fixture()
  teacher.values.availability = '[{"id":"weekly","day":2,"from":1080,"to":1260}]'
  teacher.values.availabilityWeeks = '[]'
  teacher.values.availabilityOverrides = '[{"date":"2026-11-25","blocks":[{"id":"replacement","day":2,"from":1110,"to":1260}]}]'
  assert.equal(teacherHours(context.setup, teacher.id, '2026-11-25')[0].from, 1110)
  assert.equal(teacherHours(context.setup, teacher.id, '2026-11-18')[0].from, 1080)
  teacher.values.timeOff = '[{"id":"off","start":"2026-11-25","end":"2026-11-25","allDay":false,"from":1200,"to":1260}]'
  assert.equal(teacherHours(context.setup, teacher.id, '2026-11-25')[0].to, 1200)
})

test('enrollment confirmation preserves the qualified level in the saved subscription', () => {
  const { context, teacher, student, booking } = fixture()
  const { completeCalendarEnrollment, calendarEnrollmentLesson } = h.load('beta-source/lib/academy-calendar-booking.ts')
  const { newStaffEnrollment, newLesson } = h.load('beta-source/lib/academy-staff-enrollment.ts')
  teacher.values.assignments = '[{"serviceId":"piano","maxLevel":3}]'
  const lesson = { ...newLesson('advanced'), ...calendarEnrollmentLesson(context, { ...booking, level: 3 }), level: 3 }
  const person = { ...student, activeTeacher: false }
  const account = context.data.accounts.find(item => item.studentIds.includes(student.id))
  const manager = { id: account.holderId, firstName: 'Guardian', lastName: 'Test', email: '', phone: '', activeTeacher: false }
  const draft = { ...newStaffEnrollment(), student: person, contact: manager, manager, payer: 'manager', payment: 'later', lessons: [lesson] }
  const result = completeCalendarEnrollment(context, draft, 'level-regression')
  const saved = result.students.find(item => item.id === student.id).enrollments.find(item => item.id === 'level-regression:lesson:0:0')
  assert.equal(saved.level, 3)
  teacher.values.assignments = '[{"serviceId":"piano","maxLevel":2}]'
  assert.throws(() => completeCalendarEnrollment(context, draft, 'rejected'), /not qualified/)
})