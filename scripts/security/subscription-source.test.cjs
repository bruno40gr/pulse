/* eslint-disable @typescript-eslint/no-require-imports -- Offline source export regressions. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { readSubscriptionSource } = createHarness().load('lib/subscription-source.ts')
const header = 'Id,Client Id,Primary Staff Id,Primary Staff Name,Service Name,Plan Name,Status\n'
const row = (id = '00000000-0000-0000-0000-000000000001', status = 'Active') => `${id},00000000-0000-0000-0000-000000000002,00000000-0000-0000-0000-000000000003,Teacher,Piano - Level 4 (30 min),Monthly Private Piano,${status}\n`
test('preserves source IDs, explicit levels and distinct subscriptions for the same student', () => {
  const rows = readSubscriptionSource(header + row() + row('00000000-0000-0000-0000-000000000004', 'Pending'))
  assert.equal(rows.length, 2)
  assert.equal(rows[0].level, 4)
  assert.equal(rows[0].duration, 30)
  assert.equal(rows[0].instrument, 'Piano')
  assert.equal(rows[1].status, 'pending')
})
test('rejects duplicate and missing identities; excludes ended rows without inventing defaults', () => {
  assert.throws(() => readSubscriptionSource(header + row() + row()), /duplicate/)
  assert.throws(() => readSubscriptionSource(header + row('')), /identity/)
  assert.equal(readSubscriptionSource(header + row(undefined, 'Ended')).length, 0)
  assert.equal(readSubscriptionSource('Client Name,Staff Name\nStudent,Teacher\n'), null)
})