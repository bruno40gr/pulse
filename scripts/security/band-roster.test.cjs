/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { assembleBandRoster, bandNameFor, isInstrumentTrack } = createHarness().load('lib/band-roster.ts')
const row = (patch) => ({ band_name: null, session_name: null, member_id: null, member_name: null, member_status: 'member', member_is_staff: false, coach_id: null, coach_name: null, ...patch })
test('an instrument track never becomes a band name', () => {
  for (const track of ['Drums 101', 'Voice 101', 'Guitar 101', 'Bass 101']) assert.equal(isInstrumentTrack(track), true)
  for (const band of ['SunKast', 'La Paz', 'Anomaly Syndrome', 'Vertigogo']) assert.equal(isInstrumentTrack(band), false)
})
test('members on an instrument track are grouped onto their real band', () => {
  const bands = assembleBandRoster([
    row({ band_name: 'Drums 101', session_name: 'SunKast', member_id: 'p1', member_name: 'Harper Cole' }),
    row({ band_name: 'Voice 101', session_name: 'SunKast', member_id: 'p2', member_name: 'Breannah Gonzalez' }),
    row({ band_name: 'SunKast', session_name: 'SunKast', member_id: 'p3', member_name: 'Brooks Henderson' }),
    row({ band_name: 'Guitar 101', session_name: 'Anomaly Syndrome', member_id: 'p4', member_name: 'Christian Infantino' }),
  ])
  assert.deepEqual(Array.from(bands, band => band.name), ['Anomaly Syndrome', 'SunKast'])
  const sunKast = bands.find(band => band.name === 'SunKast')
  assert.deepEqual(Array.from(sunKast.members, member => member.name), ['Breannah Gonzalez', 'Brooks Henderson', 'Harper Cole'])
})
test('a coach appears as an instructor member even without an enrollment', () => {
  const bands = assembleBandRoster([
    row({ band_name: 'SunKast', session_name: 'SunKast', member_id: 'p3', member_name: 'Brooks Henderson', coach_id: 'c1', coach_name: 'Bruno Wong' }),
    row({ band_name: 'La Paz', session_name: 'La Paz', member_id: 'p5', member_name: 'Mae Strider', member_is_staff: true, coach_id: 'c2', coach_name: 'Josh Brent' }),
  ])
  const sunKast = bands.find(band => band.name === 'SunKast')
  assert.deepEqual(Array.from(sunKast.members, member => [member.name, member.role]), [['Brooks Henderson', 'member'], ['Bruno Wong', 'instructor']])
  const laPaz = bands.find(band => band.name === 'La Paz')
  assert.deepEqual(Array.from(laPaz.members, member => [member.name, member.role, member.is_staff]), [['Josh Brent', 'instructor', true], ['Mae Strider', 'member', true]])
})
test('a member who also coaches is listed once, as a member', () => {
  const bands = assembleBandRoster([row({ band_name: 'La Paz', session_name: 'La Paz', member_id: 'p6', member_name: 'Vito Trinchese', member_is_staff: true, coach_id: 'p6', coach_name: 'Vito Trinchese' })])
  assert.deepEqual(Array.from(bands[0].members, member => [member.name, member.role]), [['Vito Trinchese', 'member']])
})
test('rows with no identifiable band are dropped rather than invented', () => {
  const bands = assembleBandRoster([
    row({ band_name: 'Bass 101', session_name: 'Voice - Level 1 (30 min)', member_id: 'p7', member_name: 'Rhett Walde', coach_id: 'c1', coach_name: 'Bruno Wong' }),
    row({ band_name: null, session_name: null, member_id: 'p8', member_name: 'No Band' }),
  ])
  assert.equal(bands.length, 0)
  assert.equal(bandNameFor(row({ band_name: 'Bass 101', session_name: 'Voice - Level 1 (30 min)' }), new Set(['SunKast'])), null)
})
