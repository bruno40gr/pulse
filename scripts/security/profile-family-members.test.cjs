/* eslint-disable @typescript-eslint/no-require-imports -- Offline family presentation checks. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const members = () => {
  const build = createHarness().load('lib/profile-family-members.ts').profileFamilyMembers
  return (...args) => JSON.parse(JSON.stringify(build(...args)))
}
const person = (id, patch = {}) => ({ id, tenant_id: HEAD, first_name: id, is_student: true, account_id: 'family', ...patch })
const holders = [{ person_id: 'holder', name: 'holder', account_id: 'family' }, { person_id: 'second', name: 'second', account_id: 'family' }]

test('holder panels exclude self, include both roles once, and put holders first', () => {
  const rows = members()([person('child'), person('holder', { is_student: false }), person('second')], holders, HEAD, 'holder')
  assert.deepEqual(rows.map(row => [row.name, row.holder, row.student]), [['second', true, true], ['child', false, true]])
})
test('student panels link siblings directly and never include the current student', () => {
  const rows = members()([person('child'), person('sibling'), person('holder', { is_student: false })], holders.slice(0, 1), HEAD, 'child')
  assert.deepEqual(rows.map(row => row.person.id), ['holder', 'sibling'])
})
test('self-managed students have no redundant family rows', () => {
  assert.deepEqual(members()([person('self')], [{ person_id: 'self', name: 'self' }], HEAD, 'self'), [])
})
test('legacy account shells exclude the header holder and retain navigable account-only holders', () => {
  const rows = members()([person('child')], [{ name: 'Header', account_id: 'linked', is_primary: true }, { name: 'Another', account_id: 'other' }], HEAD, undefined, 'family')
  assert.deepEqual(rows.map(row => row.name), ['Another', 'child'])
  assert.equal(rows[0].accountId, 'other')
})
test('explicit display identities resolve; foreign people and names never establish links', () => {
  const rows = members()([person('child'), person('foreign', { tenant_id: DEMO }), person('holder', { is_student: false })],
    [{ display_person_id: 'holder', name: 'holder' }, { person_id: 'foreign', name: 'foreign' }], HEAD, 'child')
  assert.deepEqual(rows.map(row => row.person.id), ['holder'])
})
test('account views retain a second holder on the same account', () => {
  const rows = members()([person('child'), person('holder', { is_student: false }), person('second', { is_student: false })], holders, HEAD, undefined, 'family')
  assert.deepEqual(rows.map(row => row.name), ['second', 'child'])
})