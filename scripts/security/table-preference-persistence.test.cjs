/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic, no network. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const source = file => readFileSync(resolve(__dirname, '../../', file), 'utf8')
const { createHarness } = require('./synthetic-harness.cjs')
const { CONTACT_TABLE_SCHEMA } = createHarness().load('lib/contact-table-preferences.ts')
const { normalizeTablePreferences } = createHarness().load('lib/table-preferences.ts')

test('contacts schema stores the sort it accepts', () => {
  assert.ok(CONTACT_TABLE_SCHEMA.sortKeys.includes('name'))
  const restored = normalizeTablePreferences({ columns: [...CONTACT_TABLE_SCHEMA.columnIds], density: 'compact', sort: { key: 'followUpNote', direction: 'desc' }, pageSize: 100 }, CONTACT_TABLE_SCHEMA)
  assert.deepEqual({ ...restored.sort }, { key: 'followUpNote', direction: 'desc' })
  assert.equal(restored.pageSize, 100)
  assert.equal(normalizeTablePreferences({ sort: { key: 'not-a-column', direction: 'desc' } }, CONTACT_TABLE_SCHEMA).sort.key, 'name')
})

test('every table with display controls writes its sort back to preferences', () => {
  const contacts = source('app/dashboard/contacts/page.tsx')
  assert.match(contacts, /onSortChange={nextSort => \{ setContactSort\(nextSort\); tablePreferences\.updatePreferences\(\{ \.\.\.tablePreferences\.preferences, sort: nextSort \}\) \}\}/)
  assert.match(contacts, /onPageSizeChange={size => \{[^}]*updatePreferences\(\{ \.\.\.tablePreferences\.preferences, pageSize: size \}\)/)
  const leads = source('components/leads/LeadsView.tsx')
  assert.match(leads, /updatePreferences\(\{ \.\.\.tablePreferences\.preferences, sort: nextSort \}\)/)
  assert.match(source('components/ui/TableDisplayControls.tsx'), /if \(!storageKey \|\| !changed\.current\) return/)
})

test('the notes hide-done view is remembered per account', () => {
  const notes = source('components/notes/DashboardNotes.tsx')
  assert.match(notes, /const saveView = \(patch: \{ showDone\?: boolean; filter\?: string \}\) => \{/)
  assert.match(notes, /pulse_notes_view_v1:/)
  assert.match(notes, /if \(typeof parsed\?\.showDone === 'boolean'\) setShowDone\(parsed\.showDone\)/)
  assert.match(notes, /if \(typeof parsed\?\.filter === 'string'[^\n]*setFilter/)
  assert.match(notes, /setShowDone\(next\); saveView\(\{ showDone: next \}\)/)
})
