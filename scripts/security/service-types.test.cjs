/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic, no network. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { parseLessonService, lessonServiceFor, lessonServiceOptions, lessonServicesForContact } = createHarness().load('lib/service-types.ts')

const fields = (value, serviceType) => {
  const parsed = parseLessonService(value, serviceType)
  return parsed ? [parsed.lesson, parsed.format, parsed.level].filter(Boolean).join('|') : null
}

test('one label decomposes into lesson, service and level', () => {
  assert.equal(fields('Piano - Level 1 (30 min)'), 'Piano|Level 1')
  assert.equal(fields('Piano - Level 1 (30 min) - Semi-Private'), 'Piano|semi|Level 1')
  assert.equal(fields('Drums - Level 2 (60 min)'), 'Drums|Level 2')
  assert.equal(fields('Ukulele - Level 2 (30 min)'), 'Ukulele|Level 2')
  assert.equal(fields('Trombone - Level 1 (30 min)'), 'Other|Level 1')
})

test('group classes stay named programs rather than becoming an instrument', () => {
  assert.equal(fields('Tiny Keys - Level 2 (Group) - SAT 9:30 AM'), 'Tiny Keys|group|Level 2')
  assert.equal(fields('Kids n Keys - Level 2 (Group) - Makeup'), 'Tiny Keys|group|Level 2')
  assert.equal(fields('Rock City - SAT 9:30 AM'), 'Little Rockers|group')
  assert.equal(fields('Songwriting - Ben & Landon'), 'Songwriting|group')
  assert.equal(fields('Band'), 'group')
})

test('a band name is a Band group because its enrolment says band', () => {
  for (const name of ['Anomaly Syndrome', 'La Paz', 'SunKast']) {
    assert.equal(fields(name), null, name)
    const service = lessonServiceFor({ service_type: 'band', session_name: name })
    assert.equal(`${service.lesson}|${service.format}`, 'Band|group', name)
  }
})

test('delivery-only labels keep their service and drop the lesson', () => {
  assert.equal(fields('private'), 'private')
  assert.equal(fields('semi-private'), 'semi')
  assert.equal(parseLessonService(''), null)
  assert.equal(parseLessonService(null), null)
})

test('filters are offered from the dimensions the data actually contains', () => {
  const options = lessonServiceOptions(lessonServicesForContact({
    custom_fields: { service_type: 'Piano - Level 1 (30 min)' },
    profile_enrollments: [{ service_type: 'band', session_name: 'La Paz' }, { service_type: 'Guitar - Level 2 (30 min)' }],
  }))
  assert.equal(options.lessons.join(), 'Band,Guitar,Piano')
  assert.equal(options.levels.join(), 'Level 1,Level 2')
  assert.equal(options.formats.map(option => option.label).join(), 'Private,Semi-private,Group')
})
