/* eslint-disable @typescript-eslint/no-require-imports -- Offline administrative duty history. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { saveAdministrativeDuties: save } = createHarness().load('beta-source/lib/administrative-time-duties.ts')
const duty = (id, name, enabled = 'Yes') => ({ id, values: { name, enabled } })
test('list edits preserve IDs, trim names and archive removed duties without mutating history', () => {
  const previous = [duty('desk', 'Reception'), duty('sales', 'Sales')]
  const result = save(previous, [duty('desk', ' Front desk '), duty('opening', 'Opening')])
  assert.equal(result.find(item => item.id === 'desk').values.name, 'Front desk')
  assert.equal(result.find(item => item.id === 'sales').values.enabled, 'No')
  assert.equal(previous[0].values.name, 'Reception')
  assert.equal(previous[1].values.enabled, 'Yes')
  assert.equal(save(previous, []).filter(item => item.values.enabled === 'Yes').length, 0)
})
test('blank, repeated names and duplicate identities cannot be saved', () => {
  for (const rows of [[duty('a', ' ')], [duty('a', 'Desk'), duty('b', ' desk ')], [duty('a', 'Desk'), duty('a', 'Sales')]]) assert.throws(() => save([], rows))
})