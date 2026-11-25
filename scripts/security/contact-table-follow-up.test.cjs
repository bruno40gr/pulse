/* eslint-disable @typescript-eslint/no-require-imports -- Offline table contracts. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { createHarness } = require('./synthetic-harness.cjs')
const h = createHarness()
const { compareContactFollowUps, compareContactFollowUpNotes } = h.load('lib/contact-follow-up-summary.ts')
const { CONTACT_TABLE_SCHEMA } = h.load('lib/contact-table-preferences.ts')
const { normalizeTablePreferences } = h.load('lib/table-preferences.ts')
test('date and note sorts are independent and missing values stay last in both directions', () => {
  for (const direction of ['asc', 'desc']) {
    for (const empty of [null, undefined, '', '   ']) {
      assert.ok(compareContactFollowUpNotes(empty, 'Call', direction) > 0)
      assert.ok(compareContactFollowUpNotes('Call', empty, direction) < 0)
    }
    assert.ok(compareContactFollowUps(null, '2026-12-01', direction) > 0)
    assert.equal(compareContactFollowUpNotes('Call', 'call', direction), 0)
  }
  assert.ok(compareContactFollowUpNotes('Alpha', 'Zulu') < 0)
  assert.ok(compareContactFollowUpNotes('Alpha', 'Zulu', 'desc') > 0)
  assert.ok(compareContactFollowUps('2026-12-01', '2026-12-02') < 0)
})
test('preferences retire status, preserve density/page size, and migrate date viewers to include notes', () => {
  const prefs = normalizeTablePreferences({ columns: ['name', 'status', 'followUp'], sort: { key: 'status', direction: 'desc' }, density: 'compact', pageSize: 100 }, CONTACT_TABLE_SCHEMA)
  assert.deepEqual([...prefs.columns], ['name', 'followUp', 'followUpNote'])
  assert.equal(prefs.sort.key, 'name'); assert.equal(prefs.density, 'compact'); assert.equal(prefs.pageSize, 100)
  assert.equal(normalizeTablePreferences({ sort: { key: 'followUpNote', direction: 'desc' } }, CONTACT_TABLE_SCHEMA).sort.key, 'followUpNote')
  assert.equal(normalizeTablePreferences({ columns: ['name', 'phone'] }, CONTACT_TABLE_SCHEMA).columns.includes('followUpNote'), false)
})
test('Contacts badges are name relationships, not a status column; date/note columns are independently sortable', () => {
  const source = readFileSync(resolve(__dirname, '../../app/dashboard/contacts/page.tsx'), 'utf8')
  assert.doesNotMatch(source, /id: 'status',\s*header: 'Status'/)
  assert.match(source, /renderPersonRole=\{contact => <><ContactRelationshipBadges/)
  assert.match(source, /id: 'followUpNote', header: 'Follow-up note'.*sortable: true, sortKey: 'followUpNote'/)
  assert.match(source, /id: 'followUp', header: 'Follow-up date'.*sortable: true, sortKey: 'followUp'/)
})