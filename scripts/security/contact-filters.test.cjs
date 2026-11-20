/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic, no network. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { matchesContactFilters, DEFAULT_CONTACT_FILTERS } = createHarness().load('lib/contact-filters.ts')
const { CONTACT_CLIENT_TYPES } = createHarness().load('lib/contact-client-types.ts')
const { SERVICE_TYPE_OPTIONS } = createHarness().load('lib/lead-value.ts')
test('Contacts filters place client type immediately above funding and omit imported status choices', () => {
  const source = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../../app/dashboard/contacts/page.tsx'), 'utf8')
  const filters = source.slice(source.indexOf('<SlidePanel isOpen={showFilters}'))
  assert.ok(filters.indexOf('label="Lesson"') < filters.indexOf('>Client type</legend>'))
  assert.ok(filters.indexOf('label="Service" footer') < 0)
  assert.ok(filters.indexOf('>Client type</legend>') < filters.indexOf('label="Funding"'))
  assert.ok(!filters.includes('label="Status"'))
  assert.ok(!source.includes('const statusOptions ='))
})
test('client types reuse the lead intake service catalog plus lessons', () => {
  assert.deepEqual(Array.from(CONTACT_CLIENT_TYPES), ['Lessons', ...Array.from(SERVICE_TYPE_OPTIONS, option => option.label)])
  assert.ok(!CONTACT_CLIENT_TYPES.includes('Event attendee'))
})
test('earlier prototype labels match the intake catalog without rewriting data', () => {
  for (const [oldLabel, currentLabel] of [['Studio recording', 'Recording studio'], ['Rehearsal space', 'Rehearsal room'], ['Birthday party', 'Private events & parties']]) {
    assert.equal(matchesContactFilters({ custom_fields: { client_types: [oldLabel] } }, { client_types: currentLabel }), true)
  }
})
const now = Date.parse('2026-11-03T12:00:00Z')
const student = { id: 'kid', first_name: 'Ethan', last_name: 'Kim', is_student: true, client_status: 'active',
  is_minor: true, email: 'child@example.invalid', account_holder_name: 'Sam Kim', account_holder_email: 'sam@example.invalid',
  account_holder_phone: '2025550101', last_attended: '2026-11-01T12:00:00Z', funded: true,
  instructor: { person_id: 'teacher', name: 'Teacher' }, custom_fields: { program: 'Piano' } }
test('client type matches any selected relationship on one contact, combined with other conditions', () => {
  const contact = { ...student, custom_fields: { ...student.custom_fields, client_types: ['Lessons', 'Studio recording'] } }
  assert.equal(matchesContactFilters(contact, { client_types: 'Lessons' }), true)
  assert.equal(matchesContactFilters(contact, { client_types: 'Birthday party|Studio recording' }), true)
  assert.equal(matchesContactFilters(contact, { client_types: 'Rehearsal space' }), false)
  assert.equal(matchesContactFilters(contact, { client_types: 'Studio recording', program: 'Piano' }), true)
  assert.equal(matchesContactFilters(contact, { client_types: 'Studio recording', program: 'Drums' }), false)
  assert.equal(matchesContactFilters({ ...contact, is_student: false }, { client_types: 'Studio recording' }), true)
})
test('missing or malformed client types never match a selected type; clearing the filter includes them', () => {
  for (const client_types of [undefined, null, '', 'Studio recording', {}, []]) {
    const contact = { ...student, custom_fields: { client_types } }
    assert.equal(matchesContactFilters(contact, { client_types: 'Studio recording' }), false)
    assert.equal(matchesContactFilters(contact, { client_types: '' }), true)
  }
})
test('lesson client type matches recorded lesson enrollments without rewriting contact types', () => {
  for (const service_type of ['private', 'semi-private', 'group', 'band']) {
    const contact = { ...student, custom_fields: {}, profile_enrollments: [{ service_type }] }
    assert.equal(matchesContactFilters(contact, { client_types: 'Lessons' }), true)
    assert.equal(matchesContactFilters(contact, { client_types: 'Recording studio|Lessons' }), true)
    assert.equal(matchesContactFilters(contact, { client_types: 'Recording studio' }), false)
    assert.equal(matchesContactFilters({ ...contact, is_student: false }, { client_types: 'Lessons' }), false)
  }
  assert.equal(matchesContactFilters({ ...student, profile_enrollments: [{ service_type: 'rehearsal' }] }, { client_types: 'Lessons' }), false)
  assert.equal(matchesContactFilters({ ...student, profile_enrollments: [] }, { client_types: 'Lessons' }), false)
})
test('default filter includes only active recorded students', () => {
  assert.equal(matchesContactFilters(student, DEFAULT_CONTACT_FILTERS, now), true)
  assert.equal(matchesContactFilters({ ...student, is_student: false }, DEFAULT_CONTACT_FILTERS, now), false)
  assert.equal(matchesContactFilters({ ...student, client_status: 'inactive' }, DEFAULT_CONTACT_FILTERS, now), false)
  assert.equal(matchesContactFilters({ ...student, is_student: undefined, student_id: 's' }, DEFAULT_CONTACT_FILTERS, now), true)
  assert.equal(matchesContactFilters({ ...student, client_status: 'inactive' }, {}, now), true)
})
test('basic and advanced conditions aggregate using account-holder contact details', () => {
  const filters = { name: 'sam', email: 'SAM@', last_active: '7', instructor: 'teacher', funded: 'yes', program: 'Piano' }
  assert.equal(matchesContactFilters(student, filters, now), true)
  assert.equal(matchesContactFilters(student, { ...filters, program: 'Drums' }, now), false)
  assert.equal(matchesContactFilters(student, { email: 'child@' }, now), false)

})
test('last active explicitly uses recorded attendance and handles missing/invalid dates', () => {
  assert.equal(matchesContactFilters(student, { last_active: 'over_90' }, now), false)
  assert.equal(matchesContactFilters({ ...student, last_attended: '2026-01-01' }, { last_active: 'over_90' }, now), true)
  for (const last_attended of [null, 'invalid']) {
    assert.equal(matchesContactFilters({ ...student, last_attended }, { last_active: 'never' }, now), true)
    assert.equal(matchesContactFilters({ ...student, last_attended }, { last_active: '30' }, now), false)
  }
})
test('active-only includes imported Members and configured active statuses, but excludes Lost', () => {
  assert.equal(matchesContactFilters({ ...student, client_status: 'Member' }, DEFAULT_CONTACT_FILTERS), true)
  assert.equal(matchesContactFilters({ ...student, client_status: 'Enrolled', status_class: 'active' }, DEFAULT_CONTACT_FILTERS), true)
  assert.equal(matchesContactFilters({ ...student, client_status: 'Lost', status_class: 'inactive' }, DEFAULT_CONTACT_FILTERS), false)
  assert.equal(matchesContactFilters({ ...student, client_status: 'Lost' }, {}), true)
})

test('one service/class filter matches the canonical service behind an imported label', () => {
  for (const key of ['service_type', 'session_name', 'appointment_class_name']) {
    assert.equal(matchesContactFilters({ ...student, custom_fields: { [key]: 'Private Piano' } }, { service_class: 'Piano' }), true)
  }
  assert.equal(matchesContactFilters({ ...student, custom_fields: { service_type: 'Piano - Level 1 (30 min)' } }, { service_class: 'Piano' }), true)
  assert.equal(matchesContactFilters(student, { service_class: 'Piano' }), false)
  assert.equal(matchesContactFilters({ ...student, custom_fields: { instrument: 'Piano' } }, { program: 'Piano' }), true)
})
test('filter options can match a secondary enrollment rather than only the first', () => {
  const contact = { ...student, profile_enrollments: [
    { instrument: 'Piano', service_type: 'private', instructor_person_id: 'teacher' },
    { instrument: 'Guitar', service_type: 'Guitar - Level 1 (30 min)', session_name: 'Guitar - Level 1 - Adam & Max', appointment_class_name: 'Little Rockers', instructor_person_id: 'other' },
  ] }
  for (const filters of [{ program: 'Guitar' }, { service_class: 'Guitar' }, { instructor: 'other' }]) assert.equal(matchesContactFilters(contact, filters), true)
  assert.equal(matchesContactFilters(contact, { instructor: 'missing' }), false)
})
test('labels that carry no service value stop matching as filters', () => {
  const contact = { ...student, custom_fields: { service_type: 'band' }, profile_enrollments: [{ service_type: 'band', session_name: 'Band A', appointment_class_name: 'Ensemble' }] }
  for (const value of ['band', 'Band A', 'Ensemble']) assert.equal(matchesContactFilters(contact, { service_class: value }), false)
})
test('lesson, service and level are three independent filters', () => {
  const contact = { ...student, profile_enrollments: [
    { service_type: 'band', session_name: 'La Paz' },
    { service_type: 'Piano - Level 2 (30 min) - Semi-Private' },
  ] }
  assert.equal(matchesContactFilters(contact, { lesson: 'Piano' }), true)
  assert.equal(matchesContactFilters(contact, { lesson: 'Band' }), true)
  assert.equal(matchesContactFilters(contact, { lesson: 'Drums' }), false)
  assert.equal(matchesContactFilters(contact, { service_format: 'semi' }), true)
  assert.equal(matchesContactFilters(contact, { service_format: 'private' }), false)
  assert.equal(matchesContactFilters(contact, { level: 'Level 2' }), true)
  assert.equal(matchesContactFilters(contact, { level: 'Level 3' }), false)
  assert.equal(matchesContactFilters(contact, { lesson: 'Piano', service_format: 'semi', level: 'Level 2' }), true)
  const bandOnly = { ...student, profile_enrollments: [{ service_type: 'band', session_name: 'La Paz' }] }
  assert.equal(matchesContactFilters(bandOnly, { lesson: 'Band', service_format: 'group', level: 'Level 2' }), false)
})
