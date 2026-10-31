/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic regression tests. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { emailDateRange, currentEmailMonth, isLeadEmailContact } = createHarness().load('lib/conversation-email-range.ts')

test('email defaults to current calendar month and accepts inclusive explicit dates', () => {
  const now = new Date(2026, 9, 28)
  assert.equal(JSON.stringify(currentEmailMonth(now)), JSON.stringify({ from: '2026-10-01', to: '2026-10-31' }))
  const range = emailDateRange(null, null, now)
  assert.equal(range.start, Date.parse('2026-10-01T00:00:00Z'))
  assert.equal(range.end, Date.parse('2026-11-01T00:00:00Z'))
  assert.equal(emailDateRange('2026-09-15', '2026-09-15').end - emailDateRange('2026-09-15', '2026-09-15').start, 86400000)
  for (const [from, to] of [['2026-02-30', '2026-03-01'], ['2026-11-01', '2026-10-01'], ['bad', '2026-10-01'], ['2026-99-99', null]]) assert.throws(() => emailDateRange(from, to, now))
})

test('email audience includes leads and merged lead aliases, not unrelated contacts', () => {
  assert.equal(isLeadEmailContact({ profileType: 'lead' }), true)
  assert.equal(isLeadEmailContact({ profileType: 'contact', aliases: ['lead:crm-id'] }), true)
  assert.equal(isLeadEmailContact({ profileType: 'contact' }), false)
  assert.equal(isLeadEmailContact({ profileType: null }), false)
})