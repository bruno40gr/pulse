/* eslint-disable @typescript-eslint/no-require-imports -- Node staging fixture tests. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { AUTHORS, readableNotes, eventId } = require('./lead-comment-fixtures.cjs')
const { createHarness, HEAD } = require('../security/synthetic-harness.cjs')

test('every seeded lead-comment author resolves to a staff portrait', () => {
  const { getStaffAvatarUrl } = createHarness().load('lib/staff-avatars.ts')
  for (const name of AUTHORS) assert.ok(getStaffAvatarUrl(HEAD, name))
})
test('contact note fixtures preserve completion and identity while replacing unreadable text', () => {
  const original = { id: 'note', completed_at: '2026-10-01', text: 'XXXX', actor_name: 'XX' }
  const [result] = readableNotes([original])
  assert.equal(result.id, original.id)
  assert.equal(result.completed_at, original.completed_at)
  assert.ok(AUTHORS.includes(result.actor_name))
  assert.ok(!result.text.includes('XXXX'))
  assert.equal(original.text, 'XXXX')
})
test('per-lead fixture IDs are valid, stable and distinct so reruns cannot duplicate comments', () => {
  assert.match(eventId('a'), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(eventId('a'), eventId('a'))
  assert.notEqual(eventId('a'), eventId('b'))
})