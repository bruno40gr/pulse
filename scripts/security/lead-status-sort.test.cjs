/* eslint-disable @typescript-eslint/no-require-imports -- Existing synthetic test harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { compareLeadStatus, getStatusSortOrder } = createHarness().load('lib/lead-status-sort.ts')
const row = (status, created_at = '2026-10-01T00:00:00Z') => ({ status, created_at })

test('status sort follows Won to Ghosted rather than alphabetical order and toggles reverse', () => {
  const rows = ['new', 'spam', 'won', 'booked', 'ghosted_us', 'lost', 'processing', 'contacted'].map(status => row(status))
  assert.equal(rows.sort((a, b) => compareLeadStatus(a, b, 'lesson_inquiry', 'asc')).map(r => r.status).join(','),
    'won,processing,booked,contacted,new,lost,spam,ghosted_us')
  assert.equal(rows.sort((a, b) => compareLeadStatus(a, b, 'service_inquiry', 'desc')).map(r => r.status).join(','),
    'ghosted_us,spam,lost,new,contacted,booked,processing,won')
})

test('same-status rows remain newest first and unknown statuses remain last', () => {
  for (const direction of ['asc', 'desc']) {
    assert.ok(compareLeadStatus(row('won', '2026-10-02T00:00:00Z'), row('won'), 'lesson_inquiry', direction) < 0)
    assert.ok(compareLeadStatus(row('unknown'), row('won'), 'lesson_inquiry', direction) > 0)
  }
})

test('Winback sorts the displayed payload status, not the underlying lead status', () => {
  const left = { ...row('lost'), payload: { winback: { status: 're_enrolled' } } }
  const right = { ...row('won'), payload: { winback: { status: 'to_contact' } } }
  assert.ok(compareLeadStatus(left, right, 'winback', 'asc') < 0)
  assert.ok(compareLeadStatus(left, right, 'winback', 'desc') > 0)
})

test('application and Winback filters use their own lifecycle orders', () => {
  assert.equal(getStatusSortOrder('job_application').join(','), 'hired,offer_sent,audition_completed,audition_scheduled,contacted,new,rejected,withdrew,ghosted')
  assert.equal(getStatusSortOrder('winback').join(','), 're_enrolled,interested,contacted,to_contact,closed')
})