/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')

test('name matches are suggestions, preserve ambiguity, and never treat a holder as a student', () => {
  const { reconcileBandCandidates } = createHarness().load('lib/band-reconciliation.ts')
  const result = reconcileBandCandidates([
    { id: 'c1', name: 'Alex Test', sourceName: 'Alex Test' },
    { id: 'c2', name: 'José Example', sourceName: 'Jose Example' },
    { id: 'c3', name: 'No Match', sourceName: 'No Match' },
  ], [
    { id: 'p1', first_name: 'Alex', last_name: 'Test' },
    { id: 'p2', first_name: 'Alex', last_name: 'Test' },
    { id: 'p3', first_name: 'José', last_name: 'Example' },
  ], [
    { id: 'o1', program_label: 'Band', payload: { student_name: 'Alex Test' } },
    { id: 'o2', program_label: 'Piano', payload: { student_name: 'Alex Test' } },
    { id: 'o3', program_label: 'Band', payload: { parent_name: 'Jose Example' } },
  ])
  assert.deepEqual([...result[0].personIds], ['p1', 'p2'])
  assert.deepEqual([...result[0].opportunityIds], ['o1', 'o2'])
  assert.deepEqual([...result[1].personIds], ['p3'])
  assert.deepEqual([...result[1].opportunityIds], [])
  assert.deepEqual([...result[2].personIds], [])
  assert.ok(result.every(item => item.requiresReview && item.matchType === 'name_only'))
})