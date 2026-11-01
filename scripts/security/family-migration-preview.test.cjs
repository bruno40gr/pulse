/* eslint-disable @typescript-eslint/no-require-imports -- Node synthetic tests. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { previewFamilyMigration } = require('./family-migration-preview.cjs')
const fixture = () => ({ metadata: { tenantId: 'school' }, families: [], students: [{
  liveStudentId: 'student', livePersonId: 'person', liveAccountId: 'family', sourceClientId: 'source',
  memberOrActive: true, identityMatch: 'unique_exact_source_id', flags: [],
  sourceManagerIds: [], clientEvidence: { issues: [], managers: [] },
}] })
test('orphan assumption changes proposed routing, not verified age, roles or family', () => {
  const result = previewFamilyMigration(fixture())
  assert.equal(result.students[0].proposedRouting, 'student')
  assert.equal(result.students[0].modifyMinorFlag, false)
  assert.equal(result.students[0].preserveInstructorRoles, true)
  assert.equal(result.students[0].preserveAccount, true)
  assert.equal(result.students[0].recipientPolicyNeedsUpdate, true)
})
test('missing client record or manager ID does not qualify for orphan routing', () => {
  for (const kind of ['missing_record', 'missing_manager_id']) {
    const input = fixture()
    if (kind === 'missing_record') input.students[0].flags.push('missing_source_client_record')
    else input.students[0].clientEvidence.issues.push('manager_name_without_source_id')
    assert.equal(previewFamilyMigration(input).students[0].proposedRouting, null)
  }
})
test('manager/student/instructor overlap reuses exact identity without primary or billing inference', () => {
  const input = fixture()
  input.students[0].sourceManagerIds = ['manager']
  input.students[0].clientEvidence.managers = [{ sourceId: 'manager', sourceName: 'Adult', names: [], livePersonIds: ['existing'], resolution: 'one_live_person_by_source_id' }]
  const result = previewFamilyMigration(input)
  assert.equal(result.contacts[0].action, 'reuse_person_add_holder_role')
  assert.equal(result.contacts[0].preserveExistingRoles, true)
  assert.equal(result.contacts[0].primary, null)
  assert.equal(result.students[0].proposedRouting, 'account_holder')
  assert.deepEqual(result.students[0].billingChanges, [])
})
test('self-manager is not an extra recipient', () => {
  const input = fixture(); input.students[0].sourceManagerIds = ['source']
  assert.deepEqual(previewFamilyMigration(input).students[0].proposedManagerSourceIds, [])
})
test('same named managers with different source IDs remain different people', () => {
  const input = fixture()
  input.students[0].clientEvidence.managers = ['one', 'two'].map(sourceId => ({ sourceId, sourceName: 'Same Name', names: [], livePersonIds: [], resolution: 'no_live_person_by_source_id' }))
  assert.equal(previewFamilyMigration(input).contacts.length, 2)
})
test('requires tenant-scoped input', () => {
  assert.throws(() => previewFamilyMigration({}), /tenant/)
})