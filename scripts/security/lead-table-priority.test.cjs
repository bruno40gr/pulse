/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { compareLeadAction, isTerminalLead, leadTablePhone } = createHarness().load('lib/lead-table-priority.ts')
const now = new Date('2026-10-28T12:00:00')
const row = (id, status, follow_up_at = null, payload = {}) => ({ id, status, follow_up_at, payload, created_at: '2026-10-01T00:00:00Z' })
test('action order puts due active inquiries first and terminal history last', () => {
  const rows = [row('won', 'won', '2026-10-01T12:00:00'), row('new', 'new'), row('booked', 'booked'), row('contacted', 'contacted'), row('today', 'new', '2026-10-28T12:00:00'), row('overdue', 'new', null, { follow_up_at: '2026-10-27T12:00:00' })]
  assert.equal(rows.sort((a, b) => compareLeadAction(a, b, 'lesson_inquiry', now)).map(r => r.id).join(','), 'overdue,today,contacted,booked,new,won')
})
test('Win-backs use their displayed lifecycle, not the underlying lost status', () => {
  assert.equal(isTerminalLead(row('active', 'lost', null, { winback: { status: 'contacted' } }), 'winback'), false)
  assert.equal(isTerminalLead(row('closed', 'new', null, { winback: { status: 'closed' } }), 'winback'), true)
  assert.equal(isTerminalLead(row('returned', 'new', null, { winback: { status: 're_enrolled' } }), 'winback'), true)
})
test('table phones normalize US country code without modifying international values or extensions', () => {
  assert.equal(leadTablePhone('+1 (916) 230-0511'), '(916) 230-0511')
  assert.equal(leadTablePhone('9167988323'), '(916) 798-8323')
  assert.equal(leadTablePhone('+1 916 230 0511 ext 12'), '(916) 230-0511 ext. 12')
  assert.equal(leadTablePhone('+44 20 1234 5678'), '+44 20 1234 5678')
  assert.equal(leadTablePhone(null), '')
})