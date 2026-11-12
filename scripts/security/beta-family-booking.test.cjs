/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic preview fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')

function fixture() {
  const h = createHarness()
  const sample = h.load('beta-source/lib/odeon-demo-workspace.ts').createDemoWorkspace()
  const scheduling = h.load('beta-source/lib/academy-makeup-preview.ts')
  const data = scheduling.expandPreviewCalendar(sample.data, '2027-02-03')
  return { data, state: sample.makeups, scheduling, references: h.load('beta-source/lib/family-booking-calendar.ts').familyBookingReferences }
}

test('booking context includes siblings but never another household', () => {
  const { data, state, references } = fixture()
  const rows = references(data, state, 'demo:student-9-2')
  assert.ok(rows.some(row => row.label.includes('Adam Ibrahim')))
  assert.ok(rows.some(row => row.label.includes('Sara Ibrahim')))
  const sara = rows.find(row => row.label.includes('Sara Ibrahim') && row.date === '2026-11-04')
  assert.equal(sara.time, '15:00')
  assert.equal(sara.lines[0], 'Sara')
  assert.equal(sara.proposed, false)
  assert.ok(rows.every(row => row.label.includes('Ibrahim') && row.blocksAvailability === false))
  assert.equal(references(data, state, 'unknown').length, 0)
})

test('booked makeups and original lesson are labelled, unused credits are not calendar events', () => {
  const { data, state, references } = fixture()
  const credit = state.items.find(item => item.studentId === 'demo:student-9-2')
  const booked = { ...credit, booking: { date: '2026-11-10', time: '16:00', teacher: credit.teacher, program: credit.program } }
  const original = references(data, state, credit.studentId)[0]
  const rows = references(data, { ...state, items: state.items.map(item => item.id === credit.id ? booked : item) }, credit.studentId, original.id.slice('family:'.length))
  assert.ok(rows.some(row => row.label.endsWith('Original lesson')))
  assert.ok(rows.some(row => row.label.includes('Sara Ibrahim') && row.label.endsWith('Makeup')))
  assert.equal(references(data, state, credit.studentId).some(row => row.id === `family:${credit.id}`), false)
})

test('a sibling overlap remains available, while selected-child overlap is rejected', () => {
  const { data, state, scheduling } = fixture()
  const credit = state.items.find(item => item.studentId === 'demo:student-9-2')
  const baseline = scheduling.makeupSlots(data, state, credit, '2026-11-10', credit.program, true)
  assert.ok(baseline.length)
  const slot = baseline[0]
  const sibling = data.students.find(item => item.id === 'demo:student-9-1').enrollments[0]
  const extra = { id: 'overlap-test', enrollmentId: sibling.id, date: slot.date, time: slot.time, teacher: 'Unrelated teacher', room: 'Different room', status: 'Scheduled' }
  const slots = scheduling.makeupSlots({ ...data, lessons: [...data.lessons, extra] }, state, credit, slot.date, credit.program, true)
  assert.ok(slots.some(item => item.time === slot.time && item.teacher === slot.teacher))
  const blocked = scheduling.makeupSlots({ ...data, lessons: [...data.lessons, { ...extra, enrollmentId: credit.enrollmentId }] }, state, credit, slot.date, credit.program, true)
  assert.equal(blocked.some(item => item.time === slot.time), false)
})