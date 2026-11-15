/* eslint-disable @typescript-eslint/no-require-imports -- Fictional academy integrity checks. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('../security/synthetic-harness.cjs')
const h = createHarness()
const { createOdeonDemo, demoServices, demoMinutes } = h.load('beta-source/lib/odeon-demo.ts')
const { createDemoWorkspace } = h.load('beta-source/lib/odeon-demo-workspace.ts')
const { createDemoSetup } = h.load('beta-source/lib/odeon-demo-setup.ts')
const { upgradeDemoDensity } = h.load('beta-source/lib/odeon-demo-upgrade.ts')
const schedule = h.load('beta-source/lib/beta-academy-schedule.ts')
const data = createOdeonDemo()

test('connected fictional academy has aggregate-scale students, subscriptions and staff', () => {
  assert.equal(data.students.length, 167)
  assert.equal(data.enrollments.length, 190)
  assert.equal(data.teachers.length, 15)
  assert.equal(data.families.length, 115)
  for (const key of ['students', 'families', 'enrollments', 'sessions', 'lessons', 'invoices', 'teachers']) assert.equal(new Set(data[key].map(item => item.id)).size, data[key].length, `${key} IDs are unique`)
  assert.ok(data.invoices.every(invoice => invoice.lines.length && invoice.lines.every(line => data.enrollments.some(enrollment => enrollment.id === line.enrollmentId))))
})

test('mixed services fill weekdays, late afternoons/evenings and Saturday', () => {
  for (const day of [1, 2, 3, 4, 5]) {
    const sessions = data.sessions.filter(item => item.day === day)
    assert.ok(sessions.length >= 15)
    assert.ok(new Set(sessions.map(item => item.serviceId)).size >= 5)
  }
  assert.ok(data.sessions.some(item => item.time >= '20:00'))
  assert.ok(data.sessions.some(item => item.day === 6 && item.time < '12:00'))
})

test('seed respects teacher eligibility, room occupancy, capacity and student conflicts', () => {
  const duration = session => demoServices.find(item => item.id === session.serviceId).minutes
  for (const session of data.sessions) {
    const teacher = data.teachers.find(item => item.id === session.teacherId)
    assert.ok(teacher.days.includes(session.day) && teacher.serviceIds.includes(session.serviceId))
    assert.ok(data.enrollments.filter(item => item.sessionId === session.id).length <= session.capacity)
    for (const other of data.sessions) {
      if (other.id === session.id || other.day !== session.day || demoMinutes(other.time) >= demoMinutes(session.time) + duration(session) || demoMinutes(session.time) >= demoMinutes(other.time) + duration(other)) continue
      assert.notEqual(other.teacherId, session.teacherId, 'Teacher double booking')
      assert.notEqual(other.room, session.room, 'Room double booking')
      const members = new Set(data.enrollments.filter(item => item.sessionId === session.id).map(item => item.studentId))
      assert.ok(!data.enrollments.some(item => item.sessionId === other.id && members.has(item.studentId)), 'Student double booking')
    }
  }
})

test('versioned append preserves tester edits, deletions and makes repeated upgrades a no-op', () => {
  const fresh = createDemoWorkspace(), setup = createDemoSetup()
  const old = { ...fresh, data: { ...fresh.data, datasetVersion: undefined, students: fresh.data.students.filter(item => !item.id.startsWith('demo:dense-')), accounts: fresh.data.accounts.filter(item => !item.id.startsWith('demo:dense-')), lessons: fresh.data.lessons.filter(item => !item.enrollmentId.startsWith('demo:dense-')), invoices: fresh.data.invoices.filter(item => !item.id.includes('dense-')) } }
  old.data.students[0] = { ...old.data.students[0], firstName: 'Tester edit' }
  old.data.students = old.data.students.filter(item => item.id !== 'demo:student-2-1')
  const next = upgradeDemoDensity(old, { ...setup, teachers: setup.teachers.slice(0, 10) }, fresh, setup)
  assert.equal(next.snapshot.data.students[0].firstName, 'Tester edit')
  assert.ok(!next.snapshot.data.students.some(item => item.id === 'demo:student-2-1'))
  assert.equal(next.snapshot.data.students.length, 166)
  assert.equal(next.setup.teachers.length, 15)
  assert.equal(upgradeDemoDensity(next.snapshot, next.setup, fresh, setup).snapshot, next.snapshot)
})

test('availability rejects cross-teacher student clashes and never returns an occupied fallback room', () => {
  const teacher = schedule.betaAcademyTeachers(createDemoSetup())[0]
  const load = [{ teacher: 'Another teacher', studentId: 'student', date: '2026-11-02', time: '15:00', duration: 30, room: 'Only room' }]
  assert.equal(schedule.betaTeacherAvailable(teacher, { instrument: 'Piano', duration: 30 }, '2026-11-02', '15:00', load, 'student'), false)
  assert.equal(schedule.betaRoomFor([{ id: 'room', name: 'Only room', location: '' }], undefined, '2026-11-02', '15:00', 30, load), '')
})

test('teaching load respects substitution and cancelled session occupancy', () => {
  const sample = createDemoWorkspace().data
  const lesson = sample.lessons[0]
  const load = schedule.betaTeachingLoad(sample.students, [{ ...lesson, teacher: 'Substitute' }, { ...lesson, id: 'cancelled', status: 'Cancelled' }])
  assert.equal(load.length, 1)
  assert.equal(load[0].teacher, 'Substitute')
  assert.equal(load[0].teacherId, undefined)
})

test('band workflow groups reference existing series and never duplicate calendar occupancy', () => {
  const sample = createDemoWorkspace().data
  const groups = h.load('beta-source/lib/academy-demo-groups.ts').demoBandGroups(sample)
  const calendar = h.load('beta-source/lib/beta-academy-calendar.ts')
  assert.equal(groups.length, 3)
  assert.ok(groups.every(group => group.memberIds.length >= 4 && group.seriesId))
  const expanded = h.load('beta-source/lib/academy-makeup-preview.ts').expandPreviewCalendar(sample, '2026-11-08')
  const dates = calendar.betaWeekDates('2026-11-04')
  assert.equal(calendar.betaCalendarOccurrences(expanded, groups, [], dates).length, calendar.betaCalendarOccurrences(expanded, [], [], dates).length)
})