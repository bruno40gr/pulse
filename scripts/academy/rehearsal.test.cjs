/* eslint-disable @typescript-eslint/no-require-imports -- Local synthetic Node test runner. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const path = require('node:path')
const { runRehearsal } = require('./rehearse.cjs')

test('combined fictional journey executes all nine asserted safety checks', () => {
  const report = runRehearsal()
  assert.equal(report.mode, 'synthetic-memory-only')
  assert.equal(report.checks.length, 9)
  assert.equal(new Set(report.checks).size, 9)
  assert.deepEqual(report.enrollments.map(row => row.versions.length), [2, 1])
  assert.equal(report.enrollments[0].versions[1].amountMinor, 5500)
  assert.equal(report.enrollments[1].versions[0].amountMinor, 5000)
})

test('each rehearsal rebuilds isolated deterministic fixture state', () => {
  const first = runRehearsal()
  const expected = JSON.stringify(first)
  first.enrollments[0].versions[0].amountMinor = 0
  first.checks.length = 0
  assert.equal(JSON.stringify(runRehearsal()), expected)
})

test('standalone CLI runs without application environment configuration', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'rehearse.cjs')], {
    env: {}, encoding: 'utf8', timeout: 15000,
  })
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stderr, '')
  assert.equal((result.stdout.match(/^PASS:/gm) ?? []).length, 9)
  assert.match(result.stdout, /No database, route, UI, authorization, persisted idempotency/)
})