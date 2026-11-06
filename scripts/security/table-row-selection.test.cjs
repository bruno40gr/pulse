/* eslint-disable @typescript-eslint/no-require-imports -- Pure shared selection policy. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { tableRowSelection } = createHarness().load('lib/table-row-selection.ts')
const ids = ['a', 'b', 'c']
const select = (selected, id, modifiers = {}, anchor = -1) => Array.from(tableRowSelection(new Set(selected), ids, id, anchor, modifiers)).sort()
test('plain row gestures toggle without replacing other selections', () => {
  assert.deepEqual(select(['a'], 'b'), ['a', 'b'])
  assert.deepEqual(select(['a', 'b'], 'b'), ['a'])
})
test('control/command add and alt removes without toggling back', () => {
  for (const modifiers of [{ ctrlKey: true }, { metaKey: true }]) {
    assert.deepEqual(select(['a'], 'b', modifiers), ['a', 'b'])
    assert.deepEqual(select(['a'], 'a', modifiers), ['a'])
  }
  assert.deepEqual(select(['a', 'b'], 'b', { altKey: true }), ['a'])
  assert.deepEqual(select(['a'], 'b', { altKey: true }), ['a'])
})
test('shift adds a range and alt-shift removes it in either direction', () => {
  assert.deepEqual(select([], 'c', { shiftKey: true }, 0), ids)
  assert.deepEqual(select([], 'a', { shiftKey: true }, 2), ids)
  assert.deepEqual(select(ids, 'c', { shiftKey: true, altKey: true }, 1), ['a'])
})