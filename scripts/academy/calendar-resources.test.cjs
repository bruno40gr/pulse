/* eslint-disable @typescript-eslint/no-require-imports -- Offline calendar projection verification. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('../security/synthetic-harness.cjs')
const h = createHarness()
const { calendarResources, calendarResourceIds, calendarServiceName } = h.load('beta-source/lib/academy-calendar-resources.ts')
const { placeCalendarBlocks } = h.load('beta-source/lib/academy-calendar-layout.ts')
const { betaLessonOccurrences } = h.load('beta-source/lib/beta-academy-calendar.ts')
const setup = {
  services: [{ id: 'piano', values: { name: 'Piano' } }, { id: 'guitar', values: { name: 'Guitar' } }, { id: 'voice', values: { name: 'Voice & Vocals' } }],
  teachers: [{ id: 't1', values: { name: 'Teacher One' } }, { id: 't2', values: { name: 'Teacher Two' } }],
  locations: [{ id: 'school', values: { name: 'School' }, rooms: [{ id: 'r1', name: 'Room One' }] }],
}
const block = { id: 'one', kind: 'lesson', program: 'Piano', serviceType: 'Private', teacherId: 't1', teacherName: 'Teacher One', room: 'Room One' }
const plain = value => JSON.parse(JSON.stringify(value))

test('all configured services remain available with no bookings', () => {
  assert.deepEqual(plain(calendarResources('service', setup, [])).map(item => item.name), ['Piano', 'Guitar', 'Voice & Vocals'])
})
test('private and semi-private Piano share a service column', () => {
  for (const serviceType of ['Private', 'Semi-private']) assert.deepEqual(plain(calendarResourceIds({ ...block, serviceType }, 'service', setup)), ['Piano'])
  assert.equal(calendarServiceName({ ...block, program: 'Voice' }, setup), 'Voice & Vocals')
})
test('one multi-resource booking projects into each resource without changing its ID', () => {
  const shared = { ...block, teacherIds: ['t1', 't2', 't1'], rooms: ['Room One', 'Room Two'] }
  assert.deepEqual(plain(calendarResourceIds(shared, 'teacher', setup)), ['t1', 't2'])
  assert.deepEqual(plain(calendarResourceIds(shared, 'room', setup)), ['Room One', 'Room Two'])
  assert.equal(shared.id, 'one')
})
test('unassigned and configured empty resources are retained', () => {
  assert.deepEqual(plain(calendarResourceIds({ ...block, room: '' }, 'room', setup)), ['Unassigned'])
  assert.equal(calendarResources('teacher', setup, []).length, 3)
  assert.equal(calendarResources('room', setup, []).length, 2)
})
test('simultaneous independent bookings have separate lanes; adjacent bookings reuse lanes', () => {
  const layout = placeCalendarBlocks([{ time: '14:00', duration: 30, booked: true }, { time: '14:00', duration: 30, booked: true }, { time: '14:30', duration: 30, booked: true }])
  assert.deepEqual(plain(layout.blocks).map(item => item.lane), [0, 1, 0])
})
test('an occurrence moved to a different teacher does not keep the subscription teacher ID', () => {
  const data = { students: [{ id: 's', firstName: 'A', lastName: 'B', enrollments: [{ id: 'e', teacherId: 't1', teacher: 'Teacher One', duration: 30, program: 'Piano', service: 'Private' }] }], lessons: [{ id: 'l', enrollmentId: 'e', date: '2026-11-05', time: '14:00', teacher: 'Teacher Two' }] }
  assert.equal(betaLessonOccurrences(data)[0].teacherId, undefined)
  assert.deepEqual(plain(calendarResourceIds(betaLessonOccurrences(data)[0], 'teacher', setup)), ['t2'])
})