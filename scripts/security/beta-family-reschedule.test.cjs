/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic sample scheduling. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')

function fixture() {
  const h = createHarness()
  const sample = h.load('beta-source/lib/odeon-demo-workspace.ts').createDemoWorkspace()
  const scheduling = h.load('beta-source/lib/academy-makeup-preview.ts')
  const data = scheduling.expandPreviewCalendar(sample.data, '2027-02-03')
  const items = scheduling.previewCalendarLessons(data, sample.makeups.items, { ...h.load('beta-source/lib/academy-student-preview.ts').workspaceInitial, studentId: '' }).filter(item => ['demo:student-9-1', 'demo:student-9-2'].includes(item.student.id))
  const planner = h.load('beta-source/lib/family-reschedule.ts')
  function slot(item, date = '2026-11-12') { return scheduling.makeupSlots({ ...data, lessons: data.lessons.filter(value => value.id !== item.id) }, sample.makeups, { ...item, studentId: item.student.id, lessonId: item.id, service: item.enrollment.service }, date, item.program, true)[0] }
  return { data, state: sample.makeups, planner, slot, adam: items.find(item => item.student.firstName === 'Adam'), sara: items.find(item => item.student.firstName === 'Sara') }
}

test('one proposed move leaves selected-but-unchanged sibling untouched', () => {
  const { data, state, planner, slot, adam, sara } = fixture()
  const before = JSON.stringify({ data, state })
  const next = planner.commitFamilyMoves(data, state, 'demo:family-9', { [adam.id]: slot(adam) })
  assert.deepEqual(next.data.lessons.find(item => item.id === sara.id), data.lessons.find(item => item.id === sara.id))
  assert.notEqual(next.data.lessons.find(item => item.id === adam.id).date, adam.date)
  assert.equal(JSON.stringify({ data, state }), before)
})

test('both proposed moves are validated and saved without changing subscriptions', () => {
  const { data, state, planner, slot, adam, sara } = fixture()
  const next = planner.commitFamilyMoves(data, state, 'demo:family-9', { [adam.id]: slot(adam), [sara.id]: slot(sara, '2026-11-13') })
  assert.equal(next.data.lessons.find(item => item.id === adam.id).date, '2026-11-12')
  assert.equal(next.data.lessons.find(item => item.id === sara.id).date, '2026-11-13')
  assert.deepEqual(next.data.students, data.students)
})

test('a failed move rejects the batch without mutating original state', () => {
  const { data, state, planner, slot, adam, sara } = fixture()
  const before = JSON.stringify({ data, state })
  assert.throws(() => planner.commitFamilyMoves(data, state, 'demo:family-9', { [adam.id]: slot(adam), [sara.id]: { date: '2026-11-12', time: '03:00', teacher: sara.teacher, program: sara.program } }), /available/)
  assert.equal(JSON.stringify({ data, state }), before)
  assert.throws(() => planner.commitFamilyMoves(data, state, 'demo:family-1', { [adam.id]: slot(adam) }), /unavailable/)
})

test('unchanged sibling bookings remain occupied in the projected draft', () => {
  const { data, state, planner, slot, adam, sara } = fixture()
  const projected = planner.projectFamilyMoves(data, state, { [adam.id]: slot(adam) })
  assert.deepEqual(projected.data.lessons.find(item => item.id === sara.id), data.lessons.find(item => item.id === sara.id))
  assert.deepEqual(planner.projectFamilyMoves(data, state, {}).data.lessons, data.lessons)
})

test('three occurrences across three weeks commit together without changing the recurring subscription', () => {
  const { data, state, planner, slot, adam } = fixture()
  const originals = ['2026-11-03', '2026-11-10', '2026-11-17']
  const destinations = ['2026-11-04', '2026-11-09', '2026-11-16']
  const moves = Object.fromEntries(originals.map((date, index) => {
    const item = { ...adam, id: `demo:enrollment-10:calendar:${date}`, date }
    return [item.id, slot(item, destinations[index])]
  }))
  assert.ok(Object.values(moves).every(Boolean))
  const before = JSON.stringify({ data, state })
  const next = planner.commitFamilyMoves(data, state, 'demo:family-9', moves)
  originals.forEach((date, index) => assert.equal(next.data.lessons.find(item => item.id === `demo:enrollment-10:calendar:${date}`).date, destinations[index]))
  assert.deepEqual(next.data.students, data.students)
  assert.equal(JSON.stringify({ data, state }), before)
  assert.throws(() => planner.commitFamilyMoves(data, state, 'demo:family-9', { ...moves, [Object.keys(moves)[2]]: { ...Object.values(moves)[2], time: '03:00' } }), /available/)
  assert.equal(JSON.stringify({ data, state }), before, 'Failure leaves all three original bookings untouched')
})