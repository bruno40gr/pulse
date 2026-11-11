/* eslint-disable @typescript-eslint/no-require-imports -- Existing synthetic test harness. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const load = () => createHarness().load('lib/navigation-prototype.ts')

test('four work areas have unique pages and round-trip through deep links', () => {
  const { workAreas, destinationHash, parseDestination } = load()
  assert.equal(workAreas.length, 4)
  for (const area of workAreas) {
    assert.equal(new Set(area.pages).size, area.pages.length)
    for (const page of area.pages) {
      const destination = { area: area.id, page }
      const parsed = parseDestination(destinationHash(destination))
      assert.equal(parsed.area, area.id)
      assert.equal(parsed.page, page)
    }
  }
})

test('invalid destinations and malformed escaping safely fall back', () => {
  const { parseDestination } = load()
  for (const hash of ['', '#unknown/Leads', '#website/Leads', '#school/%E0%A4%A']) {
    assert.equal(parseDestination(hash).area, 'operations')
    assert.equal(parseDestination(hash).page, 'Overview')
  }
})

test('settings stay global and search distinguishes duplicate overview labels', () => {
  const { searchDestinations, parseDestination, destinationHash } = load()
  const results = searchDestinations('overview')
  assert.equal(results.length, 2)
  assert.equal(searchDestinations('pricing')[0].area, 'school')
  assert.equal(searchDestinations('website').length, 6)
  assert.equal(searchDestinations('zz-no-match').length, 0)
  const settings = { area: 'settings', page: 'Team & permissions' }
  assert.equal(parseDestination(destinationHash(settings)).page, settings.page)
})