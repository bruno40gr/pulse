/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { isCurrentEnrollment } = createHarness().load('lib/current-enrollment.ts')
test('an ended enrollment never reads as a current subscription', () => {
  assert.equal(isCurrentEnrollment({ custom_fields: { status: 'ended' } }), false)
  assert.equal(isCurrentEnrollment({ custom_fields: { status: 'ENDED' } }), false)
  assert.equal(isCurrentEnrollment({ custom_fields: { status: 'active' } }), true)
  assert.equal(isCurrentEnrollment({ custom_fields: {} }), true)
  assert.equal(isCurrentEnrollment({}), true)
  assert.equal(isCurrentEnrollment(null), true)
})
