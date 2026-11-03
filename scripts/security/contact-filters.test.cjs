/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic, no network. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { matchesContactFilters, DEFAULT_CONTACT_FILTERS } = createHarness().load('lib/contact-filters.ts')
const now = Date.parse('2026-11-03T12:00:00Z')
const student = { id: 'kid', first_name: 'Ethan', last_name: 'Kim', is_student: true, client_status: 'active',
  is_minor: true, email: 'child@example.invalid', account_holder_name: 'Sam Kim', account_holder_email: 'sam@example.invalid',
  account_holder_phone: '2025550101', last_attended: '2026-11-01T12:00:00Z', funded: true,
  instructor: { person_id: 'teacher', name: 'Teacher' }, custom_fields: { program: 'Piano' } }
test('default filter includes only active recorded students', () => {
  assert.equal(matchesContactFilters(student, DEFAULT_CONTACT_FILTERS, now), true)
  assert.equal(matchesContactFilters({ ...student, is_student: false }, DEFAULT_CONTACT_FILTERS, now), false)
  assert.equal(matchesContactFilters({ ...student, client_status: 'inactive' }, DEFAULT_CONTACT_FILTERS, now), false)
  assert.equal(matchesContactFilters({ ...student, is_student: undefined, student_id: 's' }, DEFAULT_CONTACT_FILTERS, now), true)
  assert.equal(matchesContactFilters({ ...student, client_status: 'inactive' }, {}, now), true)
})
test('basic and advanced conditions aggregate using account-holder contact details', () => {
  const filters = { name: 'sam', email: 'SAM@', last_active: '7', instructor: 'teacher', funded: 'yes', program: 'Piano', phone_availability: 'present' }
  assert.equal(matchesContactFilters(student, filters, now), true)
  assert.equal(matchesContactFilters(student, { ...filters, program: 'Drums' }, now), false)
  assert.equal(matchesContactFilters(student, { email: 'child@' }, now), false)
  assert.equal(matchesContactFilters(student, { email_availability: 'missing' }, now), false)
  assert.equal(matchesContactFilters({ ...student, account_holder_email: null }, { email_availability: 'missing' }, now), true)
})
test('last active explicitly uses recorded attendance and handles missing/invalid dates', () => {
  assert.equal(matchesContactFilters(student, { last_active: 'over_90' }, now), false)
  assert.equal(matchesContactFilters({ ...student, last_attended: '2026-01-01' }, { last_active: 'over_90' }, now), true)
  for (const last_attended of [null, 'invalid']) {
    assert.equal(matchesContactFilters({ ...student, last_attended }, { last_active: 'never' }, now), true)
    assert.equal(matchesContactFilters({ ...student, last_attended }, { last_active: '30' }, now), false)
  }
})