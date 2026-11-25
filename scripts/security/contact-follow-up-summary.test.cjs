/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const { contactFollowUpSummary, compareContactFollowUps, matchesContactFollowUp } = createHarness().load('lib/contact-follow-up-summary.ts')
test('table summary selects earliest open date and message without mutating input', () => {
  const rows = [
    { due_at: '2026-12-02T12:00:00Z', message: 'Later', status: 'open' },
    { due_at: '2026-12-01T12:00:00Z', message: 'Earlier', status: 'open' },
    { due_at: '2026-11-01T12:00:00Z', message: 'Done', status: 'completed' },
  ]
  const summary = contactFollowUpSummary(rows)
  assert.equal(summary.follow_up_note, 'Earlier'); assert.equal(summary.follow_up_count, 2)
  assert.equal(rows[0].message, 'Later')
  assert.equal(contactFollowUpSummary([]).follow_up_at, null)
})
test('follow-up sorting is chronological and keeps missing dates last both ways', () => {
  for (const direction of ['asc', 'desc']) {
    assert.ok(compareContactFollowUps(null, '2026-12-01', direction) > 0)
    assert.ok(compareContactFollowUps('2026-12-01', null, direction) < 0)
  }
  assert.ok(compareContactFollowUps('2026-12-01', '2026-12-02') < 0)
})
test('follow-up filters compose with existing contact filters using local calendar dates', () => {
  const now = new Date(2026, 10, 24, 18)
  assert.equal(matchesContactFollowUp(new Date(2026, 10, 24, 9).toISOString(), 'today', now), true)
  assert.equal(matchesContactFollowUp(new Date(2026, 10, 23, 12).toISOString(), 'overdue', now), true)
  assert.equal(matchesContactFollowUp(null, 'none', now), true)
  assert.equal(matchesContactFollowUp(null, 'scheduled', now), false)
  const { matchesContactFilters } = createHarness().load('lib/contact-filters.ts')
  const contact = { first_name: 'Alex', last_name: 'Example', client_status: 'active', last_attended: null, follow_up_at: new Date(2026, 10, 24, 12).toISOString(), custom_fields: {} }
  assert.equal(matchesContactFilters(contact, { name: 'Alex', follow_up: 'today' }, now.getTime()), true)
  assert.equal(matchesContactFilters(contact, { name: 'Other', follow_up: 'today' }, now.getTime()), false)
})
test('batched summary reads enforce tenant, person and inquiry permissions and fail on errors', async () => {
  for (const includeInquiries of [false, true]) {
    const h = createHarness()
    h.setScenario({ fixtures: { follow_ups: [
      { id: '1', tenant_id: HEAD, person_id: 'person', lead_intake_id: null, status: 'open', due_at: '2026-12-01', message: 'General' },
      { id: '2', tenant_id: HEAD, person_id: 'person', lead_intake_id: 'lead', status: 'open', due_at: '2026-11-30', message: 'Inquiry' },
      { id: '3', tenant_id: DEMO, person_id: 'person', status: 'open', due_at: '2026-11-01', message: 'Foreign' },
    ] } })
    const rows = await h.load('lib/contact-follow-ups-server.ts').attachContactFollowUps(HEAD, [{ id: 'person' }], includeInquiries)
    assert.equal(rows[0].follow_up_count, includeInquiries ? 2 : 1)
    assert.equal(rows[0].follow_up_note, includeInquiries ? 'Inquiry' : 'General')
    assert.equal(h.getQueries().length, 1)
  }
  const h = createHarness(); h.setScenario({ errors: { follow_ups: { message: 'offline' } } })
  await assert.rejects(h.load('lib/contact-follow-ups-server.ts').attachContactFollowUps(HEAD, [{ id: 'person' }], false), /Could not load/)
})
test('summary reads paginate beyond the database row cap', async () => {
  const h = createHarness()
  let pages = 0
  h.setScenario({ queryResult: query => {
    if (query.table !== 'follow_ups') return null
    const range = query.filters.find(filter => filter[0] === 'range')
    pages++
    return { data: Array.from({ length: range[1] === 0 ? 1000 : 1 }, (_, index) => ({ id: `${range[1] + index}`, person_id: 'person', due_at: '2026-12-01', message: 'Reminder', status: 'open' })), error: null }
  } })
  const rows = await h.load('lib/contact-follow-ups-server.ts').attachContactFollowUps(HEAD, [{ id: 'person' }], true)
  assert.equal(pages, 2); assert.equal(rows[0].follow_up_count, 1001)
})