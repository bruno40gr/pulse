/* eslint-disable @typescript-eslint/no-require-imports -- Offline local preview boundary. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
test('local review bypass is opt-in, development-only, loopback-only, sample-only and never an API bypass', () => {
  const h = createHarness()
  h.setScenario({ env: { NODE_ENV: 'development', LOCAL_SCHEDULING_REVIEW: '1' } })
  const { isLocalSchedulingReview: allowed } = h.load('lib/local-scheduling-review.ts')
  assert.equal(allowed('http://127.0.0.1:3242/odeon-demo?screen=calendar', '127.0.0.1:3242'), true)
  for (const path of ['/api/academy/workspace', '/dashboard', '/odeon-demo?tenant=', '/odeon-demo?tenant=real']) assert.equal(allowed(`http://127.0.0.1:3242${path}`, '127.0.0.1:3242'), false)
  assert.equal(allowed('https://example.com/odeon-demo', 'example.com'), false)
  for (const env of [{ NODE_ENV: 'production', LOCAL_SCHEDULING_REVIEW: '1' }, { NODE_ENV: 'development' }]) {
    const isolated = createHarness()
    isolated.setScenario({ env })
    assert.equal(isolated.load('lib/local-scheduling-review.ts').isLocalSchedulingReview('http://127.0.0.1:3242/odeon-demo', '127.0.0.1:3242'), false)
  }
})