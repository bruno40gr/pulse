/* eslint-disable @typescript-eslint/no-require-imports -- Existing synthetic test harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const harness = createHarness()
const { formatCommunicationTimestamp, communicationCalendarDay } = harness.load('lib/communication-time.ts')
const { formatContactTiming } = harness.load('lib/contact-timing.ts')

test('reported UTC timestamp displays the preceding Pacific date and explicit zone', () => {
  assert.equal(formatCommunicationTimestamp('2026-10-31T02:35:10Z'), '10/30/2026, 7:35:10 PM PDT')
})
test('winter timestamps follow PST rather than a hardcoded daylight offset', () => {
  assert.equal(formatCommunicationTimestamp('2026-12-01T02:35:10Z'), '11/30/2026, 6:35:10 PM PST')
})
test('fall-back duplicate wall times have distinct daylight and standard zone labels', () => {
  assert.equal(formatCommunicationTimestamp('2026-11-01T08:30:00Z'), '11/1/2026, 1:30:00 AM PDT')
  assert.equal(formatCommunicationTimestamp('2026-11-01T09:30:00Z'), '11/1/2026, 1:30:00 AM PST')
})
test('relative communications dates use Pacific midnight, not server midnight', () => {
  assert.equal(formatContactTiming('2026-10-31T02:35:10Z', new Date('2026-10-31T03:35:10Z')), '1 hour ago')
  assert.equal(formatContactTiming('2026-10-31T02:35:10Z', new Date('2026-10-31T08:00:00Z')), 'Yesterday')
  assert.equal(communicationCalendarDay(new Date('2026-03-09T07:01:00Z')) - communicationCalendarDay(new Date('2026-03-08T07:59:00Z')), 2)
})
test('invalid timestamps fail safely', () => {
  assert.equal(formatCommunicationTimestamp('invalid'), 'Date unavailable')
})