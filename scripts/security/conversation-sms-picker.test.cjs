/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic recipient identities only. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { smsPickerGroups, smsPickerMatches, uniqueSmsPickerSelection } = createHarness().load('lib/conversation-sms-picker.ts')
const people = ['Emma', 'Alex', 'Casey'].map((student, index) => ({
  id: `child-${index}`, name: 'Morgan Example', phone: index === 1 ? '(202) 555-0102' : '+12025550102',
  email: 'morgan@example.invalid', student: `${student} Example`,
}))
test('one family destination contains every student and matches parent or any student', () => {
  const groups = smsPickerGroups(people)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].members.length, 3)
  for (const query of ['Morgan', 'EMMA', '  alex  ', 'Casey Example']) {
    assert.equal(groups.filter(group => group.members.some(person => smsPickerMatches(person, query))).length, 1)
  }
  assert.equal(groups[0].name, 'Morgan Example')
})
test('selection counts destinations once while preserving the chosen student ID', () => {
  assert.deepEqual(Array.from(uniqueSmsPickerSelection(people, ['child-2'])), ['child-2'])
  assert.equal(uniqueSmsPickerSelection(people, people.map(person => person.id)).length, 1)
  assert.equal(uniqueSmsPickerSelection(people, []).length, 0)
})
test('same names with different phones and contacts with missing numbers are not merged', () => {
  const groups = smsPickerGroups([...people,
    { ...people[0], id: 'different', phone: '+12025550103' },
    { ...people[0], id: 'missing-one', phone: '' },
    { ...people[0], id: 'missing-two', phone: '' },
  ])
  assert.equal(groups.length, 4)
})