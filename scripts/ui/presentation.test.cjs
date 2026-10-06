/* eslint-disable @typescript-eslint/no-require-imports -- Use the existing Node test runner and synthetic harness; no live services. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, DEMO, HEAD } = require('../security/synthetic-harness.cjs')

const helpers = createHarness()
const { sortNotes } = helpers.load('lib/note-order.ts')
const { formatPresentationDate, formatFullTimestamp } = helpers.load('lib/presentation-date.ts')
const localTimestamp = (year, month, day, hour = 13, minute = 2) => new Date(year, month - 1, day, hour, minute).toISOString()

test('pinned and unpinned notes each sort newest-created first without mutation', () => {
  const notes = [
    { id: 'un-old', pinned: false, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-06T00:00:00Z' },
    { id: 'pin-old', pinned: true, created_at: '2026-09-01T00:00:00Z' },
    { id: 'un-new', pinned: false, created_at: '2026-10-05T00:00:00Z' },
    { id: 'pin-new', pinned: true, created_at: '2026-09-02T00:00:00Z' },
  ]
  assert.deepEqual(Array.from(sortNotes(notes), note => note.id), ['pin-new', 'pin-old', 'un-new', 'un-old'])
  assert.equal(notes[0].id, 'un-old')
  assert.deepEqual(Array.from(sortNotes(notes.map(note => ({ ...note, updated_at: '2027-01-01T00:00:00Z' }))), note => note.id), ['pin-new', 'pin-old', 'un-new', 'un-old'])
})

test('creation-time ties are deterministic', () => {
  const notes = ['b', 'a'].map(id => ({ id, pinned: false, created_at: '2026-10-01T00:00:00Z' }))
  assert.deepEqual(Array.from(sortNotes(notes), note => note.id), ['a', 'b'])
})

test('today, yesterday, two calendar days ago, and older dates', () => {
  const now = new Date(2026, 9, 6, 14)
  assert.equal(formatPresentationDate(localTimestamp(2026, 10, 6), now), '1:02pm')
  assert.equal(formatPresentationDate(localTimestamp(2026, 10, 5), now), 'Yesterday')
  assert.equal(formatPresentationDate(localTimestamp(2026, 10, 4), now), '2 days ago')
  assert.equal(formatPresentationDate(localTimestamp(2026, 10, 3), now), 'Oct 3, 2026')
  assert.ok(formatFullTimestamp(localTimestamp(2026, 10, 6)).includes('2026'))
})

test('midnight and year boundaries use calendar days, not elapsed hours', () => {
  const now = new Date(2026, 0, 1, 0, 1)
  assert.equal(formatPresentationDate(localTimestamp(2025, 12, 31, 23, 59), now), 'Yesterday')
  assert.equal(formatPresentationDate(localTimestamp(2025, 12, 30, 23, 59), now), '2 days ago')
  assert.equal(formatPresentationDate(localTimestamp(2026, 1, 1, 0, 0), now), '12:00am')
})

test('daylight-saving changes do not shift calendar-day labels', () => {
  assert.equal(formatPresentationDate(localTimestamp(2026, 3, 7, 23, 59), new Date(2026, 2, 9, 0, 1)), '2 days ago')
  assert.equal(formatPresentationDate(localTimestamp(2026, 11, 1, 0, 1), new Date(2026, 10, 2, 23, 59)), 'Yesterday')
})

test('date-only values never acquire an invented time or UTC date shift', () => {
  const now = new Date(2026, 9, 6, 14)
  assert.equal(formatPresentationDate('2026-10-06', now), 'Oct 6, 2026')
  assert.equal(formatPresentationDate('2026-10-05', now), 'Yesterday')
  assert.equal(formatPresentationDate('not-a-date', now), '')
})

function setupInbox(messages) {
  const harness = createHarness()
  harness.setScenario({
    actor: { instructorId: 'teacher', personId: 'staff', displayName: 'Synthetic Staff', access: { kind: 'demo', tenantId: DEMO } },
    fixtures: { messages },
  })
  return { harness, route: harness.load('app/api/inbox/route.ts') }
}

function message(id, direction, status, created_at, phone = '+12025550111', tenant_id = DEMO) {
  return { id, tenant_id, direction, status, created_at, body: id, from_phone: direction === 'inbound' ? phone : '+12025550122', to_phone: direction === 'outbound' ? phone : '+12025550122' }
}

test('latest-message direction is independent of fixture order and unread state', async () => {
  for (const direction of ['outbound', 'inbound']) {
    const { harness, route } = setupInbox([
      message('old', 'inbound', 'received', '2026-10-01T00:00:00Z'),
      message('latest', direction, direction === 'inbound' ? 'read' : 'delivered', '2026-10-06T00:00:00Z'),
      message('middle', 'outbound', 'sent', '2026-10-03T00:00:00Z'),
    ])
    const response = await route.GET(new Request(`http://synthetic.invalid/api/inbox?tenant=${DEMO}`))
    assert.equal(response.status, 200)
    const [thread] = await response.json()
    assert.equal(thread.last_message_direction, direction)
    assert.equal(thread.last_message_body, 'latest')
    assert.equal(thread.unread_count, 1)
    assert.equal(harness.getWrites().length, 0)
  }
})

test('counts represent unread inbound messages, not conversations, and exclude other tenants', async () => {
  const { harness, route } = setupInbox([
    message('one', 'inbound', 'received', '2026-10-01T00:00:00Z'),
    message('two', 'inbound', 'received', '2026-10-02T00:00:00Z', '(202) 555-0111'),
    message('read', 'inbound', 'read', '2026-10-03T00:00:00Z'),
    message('sent', 'outbound', 'delivered', '2026-10-04T00:00:00Z'),
    message('three', 'inbound', 'received', '2026-10-05T00:00:00Z', '+12025550133'),
    message('other-tenant', 'inbound', 'received', '2026-10-06T00:00:00Z', '+12025550133', HEAD),
  ])
  const threads = await (await route.GET(new Request(`http://synthetic.invalid/api/inbox?tenant=${DEMO}`))).json()
  assert.equal(threads.length, 2)
  assert.equal(threads.find(thread => thread.other_phone === '+12025550111').unread_count, 2)
  const total = await (await route.GET(new Request(`http://synthetic.invalid/api/inbox?tenant=${DEMO}&count_only=1`))).json()
  assert.equal(total.count, 3)
  assert.equal(threads.reduce((sum, thread) => sum + thread.unread_count, 0), total.count)
  assert.equal(harness.getWrites().length, 0)
  assert.ok(harness.getQueries().filter(query => query.table === 'messages').every(query => query.filters.some(([op, key, value]) => op === 'eq' && key === 'tenant_id' && value === DEMO)))
})

test('read-only inbox counts retain tenant authorization', async () => {
  const { harness, route } = setupInbox([])
  const response = await route.GET(new Request(`http://synthetic.invalid/api/inbox?tenant=${HEAD}&count_only=1`))
  assert.equal(response.status, 403)
  assert.equal(harness.getQueries().some(query => query.table === 'messages'), false)
})