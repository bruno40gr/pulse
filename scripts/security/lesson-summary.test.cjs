/* eslint-disable @typescript-eslint/no-require-imports -- Offline domain and component contracts. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHarness } = require('./synthetic-harness.cjs')
const { lessonSummary } = createHarness().load('lib/lesson-summary.ts')
const read = file => fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8')

test('subscription identity includes format and duration without redundant plan wording', () => {
  assert.equal(lessonSummary({ instrument: 'Voice', plan: 'Monthly - 30 Min Private Voice' }), 'Voice • Private • 30 min')
  assert.equal(lessonSummary({ instrument: 'Piano', format: 'semi_private', duration: 45 }), 'Piano • Semi-private • 45 min')
  assert.equal(lessonSummary({ instrument: 'Band', format: 'Group', duration: 60 }), 'Band • Group • 60 min')
})

test('explicit format wins; unrelated service types fall back to known plan format', () => {
  assert.equal(lessonSummary({ instrument: 'Voice', format: 'Group', plan: '30 Min Private Voice' }), 'Voice • Group • 30 min')
  assert.equal(lessonSummary({ instrument: 'Voice', format: 'Monthly', plan: '30 Min Semi-Private Voice' }), 'Voice • Semi-private • 30 min')
  assert.equal(lessonSummary({ instrument: 'Voice', format: 'Unknown', duration: 30 }), 'Voice • 30 min')
  assert.equal(lessonSummary({}), 'Subscription')
})

test('identity and details split level from format and duration without guessing levels', () => {
  assert.equal(lessonSummary({ part: 'identity', instrument: 'Voice', level: 2 }), 'Voice • Level 2')
  assert.equal(lessonSummary({ part: 'details', format: 'Private', duration: 30 }), 'Private • 30 min')
  assert.equal(lessonSummary({ part: 'identity', instrument: 'Voice', plan: 'Monthly Level 3 Private Voice' }), 'Voice • Level 3')
  for (const level of [undefined, null, '', 0, -1, 'unknown']) {
    assert.equal(lessonSummary({ part: 'identity', instrument: 'Voice', level }), 'Voice')
  }
  assert.equal(lessonSummary({ part: 'identity', instrument: 'Voice', level: 'Level 2' }), 'Voice • Level 2')
  assert.equal(lessonSummary({ part: 'identity', instrument: 'Voice', plan: 'Monthly - 30 Min Private Voice' }), 'Voice')
})

test('subscription and scheduling surfaces reuse the same summary component', () => {
  for (const file of ['components/contacts/LiveContactPanel.tsx', 'beta-source/app/content-studio-prototype/students/AccountSubscriptions.tsx', 'beta-source/app/content-studio-prototype/students/UpcomingBookings.tsx', 'beta-source/app/content-studio-prototype/students/CalendarBookingLayout.tsx']) {
    assert.match(read(file), /<LessonSummary /)
  }
  assert.doesNotMatch(read('components/contacts/LiveContactPanel.tsx'), /detail=\{plan\}|window\.confirm/)
})

test('contact discard uses app modal and actual dirty state; family section is separated', () => {
  const panel = read('components/contacts/LiveContactPanel.tsx')
  assert.match(panel, /editing && editorDirty/)
  assert.match(panel, /<Modal isOpen=\{discardTarget !== null\}/)
  assert.match(panel, /onDirtyChange=\{setEditorDirty\}/)
  const editor = read('beta-source/app/content-studio-prototype/students/AccountEditor.tsx')
  assert.match(editor, /draft\[field\].*trim\(\).*contact\[field\].*trim\(\)/)
  assert.match(editor, /aria-label="Manage Family Group".*marginTop: spacing\.xl/)
})
