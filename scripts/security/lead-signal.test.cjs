/* eslint-disable @typescript-eslint/no-require-imports -- Existing Node synthetic harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { getLeadSignal, businessDaysSince } = createHarness().load('lib/lead-signal.ts')
const now = new Date(2026, 9, 16, 12) // Friday; local dates avoid timezone-sensitive tests.
const date = day => new Date(2026, 9, day, 10).toISOString()
const lead = (patch = {}) => ({ status: 'contacted', created_at: date(1), updated_at: date(15), ...patch })

test('Contacted and New leads do not freeze after one day', () => {
  for (const status of ['contacted', 'new']) assert.equal(getLeadSignal(lead({ status }), now).emoji, '🔥🔥')
})
test('activity cools gradually over business days, not creation age', () => {
  assert.equal(getLeadSignal(lead({ updated_at: date(13) }), now).emoji, '🔥🔥')
  assert.equal(getLeadSignal(lead({ updated_at: date(12) }), now).emoji, '🔥🧊')
  assert.equal(getLeadSignal(lead({ updated_at: date(7) }), now).emoji, '🔥🧊')
  assert.equal(getLeadSignal(lead({ updated_at: date(6) }), now).emoji, '🧊🧊')
  assert.equal(getLeadSignal(lead({ updated_at: date(1), last_activity_at: date(15) }), now).emoji, '🔥🔥')
})
test('weekends do not prematurely cool a Friday lead', () => {
  const friday = date(9)
  assert.equal(businessDaysSince(friday, new Date(2026, 9, 11, 12)), 0)
  assert.equal(businessDaysSince(friday, new Date(2026, 9, 12, 12)), 1)
  assert.equal(getLeadSignal(lead({ created_at: friday, updated_at: friday }), new Date(2026, 9, 12, 12)).emoji, '🔥🔥')
})
test('recent replies heat leads but old replies and progress do not stay hot forever', () => {
  const old = lead({ updated_at: date(1) })
  assert.equal(getLeadSignal({ ...old, last_inbound_at: date(15) }, now).emoji, '🔥🔥')
  assert.equal(getLeadSignal({ ...old, last_inbound_at: date(1) }, now).emoji, '🧊🧊')
  assert.equal(getLeadSignal({ ...old, last_status_change: { previous_status: 'new', next_status: 'contacted', created_at: date(15) } }, now).emoji, '🔥🔥')
})
test('Booked, Enrolling and closed statuses retain their stage-specific indicators', () => {
  for (const [status, emoji] of [['booked', '🔥🔥'], ['processing', '⏳'], ['won', '🏆'], ['lost', '💀'], ['spam', '🗑️'], ['ghosted_us', '👻']]) {
    assert.equal(getLeadSignal(lead({ status, updated_at: date(1) }), now).emoji, emoji)
  }
})
test('scheduled follow-ups keep stale opportunities active; overdue ones do not hide inactivity', () => {
  const old = lead({ updated_at: date(1) })
  assert.equal(getLeadSignal({ ...old, follow_up_at: date(20) }, now).emoji, '🔥🧊')
  assert.equal(getLeadSignal({ ...old, payload: { follow_up_at: date(20) } }, now).emoji, '🔥🧊')
  assert.equal(getLeadSignal({ ...old, follow_up_at: date(16) }, now).emoji, '🔥🧊')
  assert.equal(getLeadSignal({ ...old, follow_up_at: date(15) }, now).emoji, '🧊🧊')
})
test('invalid and future timestamps fail safely instead of defaulting to ice', () => {
  assert.equal(getLeadSignal(lead({ created_at: 'invalid', updated_at: 'invalid' }), now).emoji, '🔥🧊')
  assert.equal(getLeadSignal(lead({ created_at: date(20), updated_at: date(20) }), now).emoji, '🔥🧊')
  assert.equal(getLeadSignal(lead({ updated_at: date(1), last_inbound_at: 'invalid' }), now).emoji, '🧊🧊')
})