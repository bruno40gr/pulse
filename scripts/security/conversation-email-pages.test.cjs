/* eslint-disable @typescript-eslint/no-require-imports -- Offline pagination regression tests. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { loadConversationEmailPages } = createHarness().load('lib/conversation-email-pages.ts')

test('loads every page automatically even when first five pages have no matching lead emails', async () => {
  const cursors = [], messages = []
  await loadConversationEmailPages(async cursor => {
    cursors.push(cursor)
    const page = cursor ? Number(cursor) : 0
    return { threads: page === 5 ? ['matching lead email'] : [], nextCursor: page < 5 ? String(page + 1) : null }
  }, page => messages.push(...page), () => false)
  assert.deepEqual(cursors, [null, '1', '2', '3', '4', '5'])
  assert.deepEqual(messages, ['matching lead email'])
})

test('date changes cancel stale results and repeated provider cursors fail visibly', async () => {
  let cancelled = false, updates = 0
  await loadConversationEmailPages(async () => { cancelled = true; return { threads: ['stale'], nextCursor: 'next' } }, () => updates++, () => cancelled)
  assert.equal(updates, 0)
  await assert.rejects(loadConversationEmailPages(async () => ({ threads: [], nextCursor: 'same' }), () => {}, () => false), /did not advance/)
})

test('provider failures retain delivered pages and surface an error rather than false completion', async () => {
  const messages = []
  await assert.rejects(loadConversationEmailPages(async cursor => {
    if (cursor) throw new Error('Provider busy')
    return { threads: ['first email'], nextCursor: 'next' }
  }, page => messages.push(...page), () => false), /Provider busy/)
  assert.deepEqual(messages, ['first email'])
})