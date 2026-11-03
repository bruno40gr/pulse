/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic review fixtures only. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { initialReviewNotes, promoteReviewNote, matchesReviewFilter, readReviewNotes, reviewDateOffset } = createHarness().load('lib/notes-follow-ups-prototype.ts')
const now = new Date('2026-11-03T12:00:00')

test('purposeful conversion retains one identity, color and original context', () => {
  const original = initialReviewNotes(now)[0]
  assert.equal(original.followUp, null)
  const converted = promoteReviewNote(original, { title: ' Call about Tuesday ', personId: 'lead-michelle', ownerId: 'admin', dueDate: '2026-11-03' })
  for (const field of ['id', 'color', 'body', 'title']) assert.equal(converted[field], original[field])
  assert.equal(converted.followUp.title, 'Call about Tuesday')
  assert.equal(original.followUp, null)
  assert.equal(converted.completedAt, null)
})

test('daily filters exclude non-actionable notes and completed actions', () => {
  const notes = initialReviewNotes(now)
  const ids = filter => notes.filter(note => matchesReviewFilter(note, filter, '2026-11-03')).map(note => note.id).join(',')
  assert.equal(ids('today'), 'task-time,task-first')
  assert.equal(ids('notes'), 'sticky-call,sticky-desk')
  assert.equal(ids('completed'), 'task-done')
  assert.equal(ids('upcoming'), 'task-funding')
  assert.equal(notes.filter(note => matchesReviewFilter(note, 'all', '2026-11-03')).length, 5)
})

test('conversion requires explicit action, valid owner, date and related fixture', () => {
  const note = initialReviewNotes(now)[0]
  const valid = { title: 'Call', personId: null, ownerId: 'admin', dueDate: '2026-11-03' }
  for (const invalid of [{ title: ' ' }, { ownerId: 'foreign' }, { dueDate: '' }, { dueDate: '2026-02-30' }, { personId: 'foreign' }]) assert.throws(() => promoteReviewNote(note, { ...valid, ...invalid }))
  assert.equal(promoteReviewNote(note, valid).followUp.personId, null)
})

test('browser storage validates fixture data and dates offset across months', () => {
  const notes = initialReviewNotes(now)
  assert.equal(readReviewNotes(notes), notes)
  for (const value of [null, {}, [null], [{ id: 'invalid' }], [{ ...notes[0], followUp: undefined }], [{ ...notes[0], followUp: { ownerId: 'foreign' } }]]) assert.equal(readReviewNotes(value), null)
  assert.equal(reviewDateOffset(-1, new Date('2026-11-01T12:00:00')), '2026-10-31')
})

test('editing a completed task keeps it completed and preserves sticky metadata', () => {
  const note = { ...initialReviewNotes(now)[5], pinned: true, replies: ['Confirmed'], isPrivate: true }
  const edited = promoteReviewNote(note, { ...note.followUp, dueDate: '2026-11-10' })
  assert.equal(edited.completedAt, note.completedAt)
  assert.equal(edited.pinned, true)
  assert.equal(edited.replies, note.replies)
  assert.equal(edited.isPrivate, true)
  assert.equal(readReviewNotes([edited])?.length, 1)
})