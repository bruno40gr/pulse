/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic, no network. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { canonicalServiceType, canonicalServiceTypes, serviceTypeMatches } = createHarness().load('lib/service-types.ts')

test('a level and a schedule are stripped before matching', () => {
  assert.equal(canonicalServiceType('Piano - Level 1 (30 min)'), 'Piano')
  assert.equal(canonicalServiceType('Piano - Level 1 (30 min) - Semi-Private'), 'Piano')
  assert.equal(canonicalServiceType('Drums - Level 2 (60 min)'), 'Drums')
  assert.equal(canonicalServiceType('Bass - Level 1 (30 min)'), 'Bass')
  assert.equal(canonicalServiceType('Ukulele - Level 2 (30 min)'), 'Ukulele')
  assert.equal(canonicalServiceType('Tiny Keys - Level 2 (Group) - SAT 9:30 AM'), 'Piano')
  assert.equal(canonicalServiceType('Tiny Keys - Level 1 - Wednesday @ 5:00 PM'), 'Piano')
  assert.equal(canonicalServiceType('Kids n Keys - Level 2 (Group) - Makeup'), 'Piano')
})

test('voice, saxophone and program labels reach the catalog', () => {
  assert.equal(canonicalServiceType('Voice & Vocals'), 'Voice')
  assert.equal(canonicalServiceType('Alto Saxophone - Level 1 (30 min)'), 'Saxophone')
  assert.equal(canonicalServiceType('Foundations of Guitar - Level 1 (30 min)'), 'Guitar')
  assert.equal(canonicalServiceType('Guitar - Level 1 - Adam & Max'), 'Guitar')
})

test('labels with no service value are dropped instead of offered', () => {
  for (const label of ['band', 'group', 'private', 'semi-private', 'Anomaly Syndrome', 'La Paz', 'Road Rage', 'SunKast', 'The Deeper Cuts', 'Rock City - SAT 9:30 AM']) {
    assert.equal(canonicalServiceType(label), null, label)
  }
  assert.equal(canonicalServiceType('Songwriting - Ben & Landon'), 'Other')
  assert.equal(canonicalServiceType(''), null)
  assert.equal(canonicalServiceType(null), null)
})

test('a filter value still matches the raw Opus label', () => {
  assert.ok(serviceTypeMatches('Piano - Level 3 (30 min)', 'Piano'))
  assert.ok(!serviceTypeMatches('Guitar - Level 1 (30 min)', 'Piano'))
  assert.equal(canonicalServiceTypes(['Piano - Level 1 (30 min)', 'SunKast', 'Piano - Level 2 (30 min)', 'group', null]).join(), 'Piano')
})
