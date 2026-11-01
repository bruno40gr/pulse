/* eslint-disable @typescript-eslint/no-require-imports -- Node synthetic tests. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { reconcileFamilies } = require('./family-export-reconciliation.cjs')
const fixture = () => ({ tenantId: 'school',
  people: [{ id: 'child', tenant_id: 'school', first_name: 'Child', custom_fields: { external_id: 'C' } }],
  students: [{ id: 'student', tenant_id: 'school', person_id: 'child', account_id: 'family', client_status: 'member' }],
  accounts: [{ id: 'family', tenant_id: 'school', name: 'Family' }], enrollments: [],
  clients: [{ Id: 'C', 'Full Name': 'Child', 'AccountManager 1 id': 'P', 'AccountManager 1 name': 'Parent', 'AccountManager 2 id': 'Q', 'AccountManager 2 name': 'Other' }, { Id: 'P' }, { Id: 'Q' }],
  attendance: [], subscriptions: [] })
test('matches exact source IDs and retains both managers without inventing live identities', () => {
  const report = reconcileFamilies(fixture())
  assert.equal(report.summary.memberOrActive.uniqueExactSourceIdMatches, 1)
  assert.deepEqual(report.students[0].sourceManagerIds, ['P', 'Q'])
  assert.equal(report.students[0].clientEvidence.managers[0].resolution, 'no_live_person_by_source_id')
})
test('does not fall back to names, infer primary, or attach payers as managers', () => {
  const data = fixture()
  data.people[0].custom_fields.external_id = 'unknown'
  data.subscriptions = [{ Id: 'sub', 'Client Id': 'unknown', 'Payer Id': 'payer' }]
  const row = reconcileFamilies(data).students[0]
  assert.equal(row.identityMatch, 'unresolved')
  assert.deepEqual(row.sourceManagerIds, [])
  assert.equal(row.payerEvidence[0].liveEnrollmentMatch, 'unresolved_no_verified_subscription_crosswalk')
})
test('rejects foreign-tenant rows', () => {
  const data = fixture(); data.accounts[0].tenant_id = 'foreign'
  assert.throws(() => reconcileFamilies(data), /tenant/)
})
test('duplicate IDs block confident matches; case-sensitive IDs are not merged', () => {
  const data = fixture(); data.clients.push({ Id: 'C' })
  assert.equal(reconcileFamilies(data).students[0].identityMatch, 'unresolved')
  data.clients.pop(); data.people.push({ id: 'other', tenant_id: 'school', custom_fields: { external_id: 'C' } })
  assert.equal(reconcileFamilies(data).students[0].identityMatch, 'unresolved')
  data.people[1].custom_fields.external_id = 'c'
  assert.equal(reconcileFamilies(data).students[0].identityMatch, 'unique_exact_source_id')
})
test('different sibling manager sets flag the family rather than grant every manager access', () => {
  const data = fixture()
  data.people.push({ id: 'sibling', tenant_id: 'school', custom_fields: { external_id: 'S' } })
  data.students.push({ id: 'student2', tenant_id: 'school', person_id: 'sibling', account_id: 'family', client_status: 'member' })
  data.clients.push({ Id: 'S', 'AccountManager 1 id': 'P' })
  const report = reconcileFamilies(data)
  assert.equal(report.summary.accountsWithVaryingManagerSets, 1)
  assert.equal(report.families[0].requiresReview, true)
})
test('retains cross-export changes, missing IDs and self-manager cases for review', () => {
  const data = fixture()
  data.clients[0]['AccountManager 1 id'] = 'C'
  data.clients[0]['AccountManager 2 id'] = ''
  data.attendance.push({ 'Client Id': 'C', 'AccountManager 1 id': 'P' })
  const flags = reconcileFamilies(data).students[0].flags
  for (const flag of ['self_manager_reference', 'manager_name_without_source_id', 'manager_sets_differ_between_exports']) assert.ok(flags.includes(flag))
})
test('attendance names without IDs are incomplete evidence, not a contradictory manager set', () => {
  const data = fixture()
  data.attendance.push({ 'Client Id': 'C', 'AccountManager 1 name': 'Parent' })
  const flags = reconcileFamilies(data).students[0].flags
  assert.ok(flags.includes('attendance_manager_ids_unavailable'))
  assert.ok(!flags.includes('manager_sets_differ_between_exports'))
})