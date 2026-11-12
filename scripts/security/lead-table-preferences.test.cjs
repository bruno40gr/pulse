/* eslint-disable @typescript-eslint/no-require-imports -- Existing Node synthetic harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { defaultLeadTablePreferences, normalizeLeadTablePreferences, leadTablePreferenceKey } = createHarness().load('lib/lead-table-preferences.ts')
const plain = value => JSON.parse(JSON.stringify(value))

test('defaults preserve signal and email, hide source, and use comfortable spacing', () => {
  const defaults = defaultLeadTablePreferences()
  assert.ok(defaults.columns.includes('signal'))
  assert.ok(defaults.columns.includes('email'))
  assert.ok(!defaults.columns.includes('source'))
  assert.equal(defaults.density, 'comfortable')
})
test('stored preferences discard unknown and duplicate columns and always retain name', () => {
  assert.deepEqual(plain(normalizeLeadTablePreferences({ columns: ['email', 'email', 'unknown'], density: 'compact' })), { ...plain(defaultLeadTablePreferences()), columns: ['name', 'email'], density: 'compact' })
  assert.deepEqual(plain(normalizeLeadTablePreferences({ columns: [] }).columns), ['name'])
  for (const value of [null, false, 'bad', {}]) assert.deepEqual(normalizeLeadTablePreferences(value), defaultLeadTablePreferences())
})
test('preferences are isolated by workspace and membership', () => {
  assert.notEqual(leadTablePreferenceKey('a', 'x'), leadTablePreferenceKey('a', 'y'))
  assert.notEqual(leadTablePreferenceKey('a', 'x'), leadTablePreferenceKey('b', 'x'))
})

test('split reminder migrates legacy visible follow-up without undoing a later hide', () => {
  assert.ok(normalizeLeadTablePreferences({ columns: ['name', 'followUp'] }).columns.includes('followUpNote'))
  assert.ok(!normalizeLeadTablePreferences({ version: 2, columns: ['name', 'followUp'] }).columns.includes('followUpNote'))
  assert.ok(!normalizeLeadTablePreferences({ columns: ['name'] }).columns.includes('followUpNote'))
})

test('sort and page size restore safely, including legacy and malformed preferences', () => {
  const restored = normalizeLeadTablePreferences({ sort: { key: 'followUp', direction: 'asc' }, pageSize: 100 })
  assert.deepEqual(plain(restored.sort), { key: 'followUp', direction: 'asc' })
  assert.equal(restored.pageSize, 100)
  for (const sort of [null, false, 'bad', { key: 'unknown', direction: 'asc' }, { key: 'name', direction: 'bad' }]) {
    assert.deepEqual(plain(normalizeLeadTablePreferences({ sort, pageSize: -1 }).sort), { key: 'created', direction: 'desc' })
    assert.equal(normalizeLeadTablePreferences({ sort, pageSize: -1 }).pageSize, 50)
  }
})
