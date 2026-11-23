/* eslint-disable @typescript-eslint/no-require-imports -- Offline staff ownership and availability contracts. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const h = createHarness()
const { editStaffAvailability: edit } = h.load('beta-source/lib/staff-availability-edit.ts')
const { teacherWeekAvailability: hours } = h.load('beta-source/app/content-studio-prototype/school-setup/setup-content.ts')
const { staffRecordForPerson: link, staffWorkProfileError: validate, staffTeachingLevels } = h.load('beta-source/lib/staff-work-profile.ts')
const { createDemoSetup } = h.load('beta-source/lib/odeon-demo-setup.ts')
const { createDemoWorkspace } = h.load('beta-source/lib/odeon-demo-workspace.ts')
const block = (id, from) => ({ id, day: 0, from, to: 1260 })
test('one-week availability restores the previous hours and preserves later boundaries', () => {
  const base = [block('base', 540)], changed = [block('changed', 720)], later = [block('later', 600)]
  const values = { availabilityWeeks: JSON.stringify([{ week: '2026-12-07', blocks: later }]) }
  const result = edit(values, base, '2026-11-23', changed, 'week')
  const weeks = JSON.parse(result.availabilityWeeks)
  assert.deepEqual(hours(base, weeks, '2026-11-16'), base)
  assert.deepEqual(hours(base, weeks, '2026-11-23'), changed)
  assert.deepEqual(hours(base, weeks, '2026-11-30'), base)
  assert.deepEqual(hours(base, weeks, '2026-12-07'), later)
  const existing = edit({ availabilityWeeks: JSON.stringify([{ week: '2026-11-30', blocks: later }]) }, base, '2026-11-23', changed, 'week')
  assert.deepEqual(hours(base, JSON.parse(existing.availabilityWeeks), '2026-11-30'), later)
})
test('future availability uses the selected date week and preserves unrelated exceptions', () => {
  const base = [block('base', 540)], changed = [block('changed', 720)]
  const exception = { date: '2026-11-25', blocks: [] }
  const values = { availabilityOverrides: JSON.stringify([exception]), availabilityWeeks: JSON.stringify([{ week: '2026-12-07', blocks: base }]) }
  const result = edit(values, base, '2026-11-24', changed, 'future')
  assert.deepEqual(JSON.parse(result.availabilityOverrides), [exception])
  const weeks = JSON.parse(result.availabilityWeeks)
  assert.deepEqual(hours(base, weeks, '2026-11-30'), changed)
  assert.deepEqual(hours(base, weeks, '2026-12-07'), base)
})
test('live staff links require exactly one explicit person ID, not a name or coincidental record ID', () => {
  const records = [{ id: 'person', values: { name: 'Person' } }, { id: 'teacher', values: { personId: 'person' } }]
  assert.equal(link(records, 'person').id, 'teacher')
  assert.equal(link(records, 'other'), undefined)
  assert.equal(link([records[0]], 'person'), undefined)
  assert.equal(link([...records, { id: 'duplicate', values: { personId: 'person' } }], 'person'), undefined)
})
test('staff edit keeps IDs and qualification levels, rejects time off over existing teaching', () => {
  const setup = createDemoSetup(), data = createDemoWorkspace().data, record = setup.teachers[0]
  const context = { data, setup, groups: [], occurrences: [] }
  assert.equal(validate(context, record, '2026-11-04'), null)
  const original = JSON.stringify(record)
  const changed = { ...record, values: { ...record.values, timeOff: '[{"id":"off","start":"2026-11-04","end":"2027-11-04","allDay":true}]' } }
  assert.match(validate(context, changed, '2026-11-04'), /affected assignments.*unavailable/)
  assert.equal(JSON.stringify(record), original)
  assert.equal(staffTeachingLevels(setup).level3, 'Level 3')
  setup.teachers[0].values.assignments = '[{"serviceId":"piano","maxLevel":5}]'
  assert.equal(staffTeachingLevels(setup).level5, 'Level 5')
})