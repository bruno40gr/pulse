/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { currentBandEnrollments } = createHarness().load('lib/band-enrollments.ts')
const old = { id: 'old', student_id: 's1', service_type: 'band', instrument: 'Drums', session_name: 'SunKast', instructor_person_id: 'coach', status: 'ended', custom_fields: { status: 'ended', band_name: 'SunKast', band_instrument: 'Drums', superseded_by_subscription_snapshot: 'review-v1' } }
const active = { id: 'active', student_id: 's1', service_type: 'group', instrument: 'Band', session_name: null, instructor_person_id: null, status: 'active', custom_fields: { status: 'active', reconciliation_run: 'review-v1', appointment_class_name: 'Band (60 min)' } }
test('recovers reviewed ensemble and instrument on the active replacement, not the retired subscription', () => {
  const [row] = currentBandEnrollments([old, active])
  assert.equal(row.id, 'active')
  assert.equal(row.custom_fields.band_name, 'SunKast')
  assert.equal(row.custom_fields.band_instrument, 'Drums')
  assert.equal(row.instructor_person_id, 'coach')
  assert.equal(row.status, 'active')
  assert.equal(active.custom_fields.band_name, undefined)
})
test('does not revive ended, removed, unmatched, different-person, or ambiguous memberships', () => {
  for (const rows of [[old], [old, { ...active, status: 'ended' }],
    [{ ...old, custom_fields: { ...old.custom_fields, ended_source: 'removed from band' } }, active],
    [old, { ...active, student_id: 'other' }],
    [old, { ...active, custom_fields: { reconciliation_run: 'different' } }],
    [old, active, { ...active, id: 'second' }],
    [old, { ...old, id: 'other-band', session_name: 'La Paz', custom_fields: { ...old.custom_fields, band_name: 'La Paz' } }, active]]) {
    assert.equal(currentBandEnrollments(rows).length, 0)
  }
})
test('preserves saved multi-instruments and deliberately empty instrument selections', () => {
  for (const instruments of [['Drums', 'Voice'], []]) {
    const [row] = currentBandEnrollments([old, { ...active, custom_fields: { ...active.custom_fields, band_instruments: instruments } }])
    assert.deepEqual(Array.from(row.custom_fields.band_instruments), instruments)
  }
})
test('top-level ended status excludes a band even when custom status says active', () => {
  assert.equal(currentBandEnrollments([{ ...old, custom_fields: { status: 'active', band_name: 'SunKast' } }]).length, 0)
})
test('recovers multiple ensembles together without confusing private lessons or instrument tracks with bands', () => {
  const names = ['AJ Athena Band', 'Anomaly Syndrome', 'La Paz', 'ManiaC', 'SunKast', 'Young Thursday Band']
  const rows = names.flatMap((name, index) => [
    { ...old, id: `old-${index}`, student_id: `s${index}`, session_name: name === 'ManiaC' ? 'Songwriting - Ben & Landon' : 'Voice - Level 4 (30 min)', custom_fields: { ...old.custom_fields, band_name: name } },
    { ...active, id: `active-${index}`, student_id: `s${index}` },
    { ...active, id: `private-${index}`, student_id: `s${index}`, service_type: 'private', instrument: 'Voice' },
  ])
  assert.deepEqual(Array.from(currentBandEnrollments(rows), row => row.custom_fields.band_name), names)
  assert.equal(currentBandEnrollments([{ ...old, custom_fields: { ...old.custom_fields, band_name: 'Bass 101' }, session_name: 'Voice - Level 1 (30 min)' }, active]).length, 0)
})