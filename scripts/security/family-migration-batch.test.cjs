/* eslint-disable @typescript-eslint/no-require-imports -- Node synthetic fixtures. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { planFamilyBatch } = require('./family-migration-batch.cjs')
const fixture = () => ({
  preview: { metadata: { tenantId: 'school' }, contacts: [{ sourcePersonId: 'parent' }], students: [{
    studentId: 'student', personId: 'child', accountId: 'account', sourceClientId: 'source-child', status: 'proposed', proposedManagerSourceIds: ['parent'], proposedRouting: 'account_holder', routingReason: 'explicit_source_manager_links',
  }] },
  identityReview: { metadata: { tenantId: 'school' }, contacts: [{ sourcePersonId: 'parent', disposition: 'reuse_exact_source_identity', exactPersonId: 'adult' }] },
  snapshot: { tenantId: 'school', people: [{ id: 'adult', tenant_id: 'school', custom_fields: { external_id: 'parent' } }, { id: 'child', tenant_id: 'school', custom_fields: { external_id: 'source-child' } }],
    students: [{ id: 'student', tenant_id: 'school', person_id: 'child', account_id: 'account' }], accounts: [{ id: 'account', tenant_id: 'school' }] },
})
test('batch is deterministic and replays without duplicate operations', () => {
  const data = fixture(), result = planFamilyBatch(data)
  assert.equal(result.operations.length, 2)
  assert.equal(result.batchFingerprint, planFamilyBatch(data).batchFingerprint)
  assert.equal(planFamilyBatch({ ...data, applied: result.operations }).operations.length, 0)
  assert.equal(result.operations.find(row => row.kind === 'student_contact_plan').proposal.activateMessaging, false)
})
test('conflicting ledger or changed identity refuses the batch', () => {
  const data = fixture(), result = planFamilyBatch(data)
  assert.throws(() => planFamilyBatch({ ...data, applied: [{ ...result.operations[0], fingerprint: 'different' }] }), /differs/)
  data.snapshot.students[0].account_id = 'other'
  assert.throws(() => planFamilyBatch(data), /changed/)
})
test('manual contact review defers affected student links without a merge', () => {
  const data = fixture(); data.identityReview.contacts[0].disposition = 'review_existing_people_without_source_id'
  const result = planFamilyBatch(data)
  assert.equal(result.operations.length, 0)
  assert.equal(result.deferred.length, 2)
})
test('foreign tenants and changed manager identities are rejected', () => {
  const data = fixture(); data.snapshot.people[0].tenant_id = 'foreign'
  assert.throws(() => planFamilyBatch(data), /Foreign/)
  data.snapshot.people[0].tenant_id = 'school'; data.snapshot.people[0].custom_fields.external_id = 'changed'
  assert.throws(() => planFamilyBatch(data), /changed/)
})
test('unmatched source identity stages a candidate rather than granting contact access', () => {
  const data = fixture(); data.snapshot.people.shift()
  data.identityReview.contacts[0].disposition = 'creation_candidate_no_unkeyed_overlap_found'
  const op = planFamilyBatch(data).operations.find(row => row.kind === 'identity_resolution')
  assert.equal(op.proposal.action, 'stage_contact_creation_candidate')
})
test('owner relationship decisions are recorded only against resolved managers', () => {
  const data = fixture()
  data.relationshipDecisions = [{ tenantId: 'school', studentId: 'student', personId: 'adult', relationship: 'sibling', action: 'set_holder_relationship', approvedBy: 'owner', reason: 'Owner confirmed a sibling relationship.' }]
  const plan = planFamilyBatch(data).operations.find(row => row.kind === 'student_contact_plan')
  assert.deepEqual(plan.proposal.holderRelationships, [{ personId: 'adult', relationship: 'sibling', reason: 'Owner confirmed a sibling relationship.' }])
  assert.equal(plan.proposal.relationshipSource, 'owner_confirmed')
  assert.equal(planFamilyBatch(fixture()).operations.find(row => row.kind === 'student_contact_plan').proposal.relationshipSource, 'not_asserted')
})
test('relationship decisions reject unknown relationships, foreign scope and unknown people', () => {
  const data = fixture()
  const decision = { tenantId: 'school', studentId: 'student', personId: 'adult', relationship: 'cousin', action: 'set_holder_relationship', approvedBy: 'owner', reason: 'Unsupported.' }
  data.relationshipDecisions = [decision]
  assert.throws(() => planFamilyBatch(data), /Invalid owner relationship/)
  data.relationshipDecisions = [{ ...decision, relationship: 'sibling', personId: 'stranger' }]
  assert.throws(() => planFamilyBatch(data), /not a resolved manager/)
  data.relationshipDecisions = [{ ...decision, relationship: 'sibling', tenantId: 'foreign' }]
  assert.throws(() => planFamilyBatch(data), /Invalid owner relationship/)
})
test('recipient policy status is recorded per student plan without enabling sending', () => {
  const data = fixture()
  data.recipientPolicy = { tenantId: 'school', decisions: [{ studentId: 'student', status: 'owner_decision_required' }] }
  const result = planFamilyBatch(data)
  const plan = result.operations.find(row => row.kind === 'student_contact_plan')
  assert.equal(plan.proposal.recipientPolicyStatus, 'owner_decision_required')
  assert.equal(result.recipientPolicyStatuses.owner_decision_required, 1)
  assert.equal(plan.proposal.activateMessaging, false)
  const unclassified = planFamilyBatch(fixture())
  assert.equal(unclassified.operations.find(row => row.kind === 'student_contact_plan').proposal.recipientPolicyStatus, 'unclassified')
})
test('recipient policy from another tenant or with duplicate students is refused', () => {
  const data = fixture()
  data.recipientPolicy = { tenantId: 'foreign', decisions: [] }
  assert.throws(() => planFamilyBatch(data), /Recipient policy/)
  data.recipientPolicy = { tenantId: 'school', decisions: [{ studentId: 'student', status: 'a' }, { studentId: 'student', status: 'b' }] }
  assert.throws(() => planFamilyBatch(data), /Duplicate recipient policy/)
})
const ownerFixture = () => {
  const data = fixture()
  data.snapshot.people[0].custom_fields = {}
  data.identityReview.contacts[0] = { sourcePersonId: 'parent', disposition: 'review_existing_people_without_source_id', candidates: [{ personId: 'adult', existingSourceId: null }] }
  data.identityDecisions = [{ tenantId: 'school', sourcePersonId: 'parent', personId: 'adult', action: 'reuse_existing_preserve_details', approvedBy: 'owner', reason: 'Explicit owner identity confirmation' }]
  return data
}
test('explicit owner decision reuses a reviewed person without overwriting details or roles', () => {
  const data = ownerFixture(), before = JSON.stringify(data)
  const result = planFamilyBatch(data)
  const op = result.operations.find(row => row.kind === 'identity_resolution')
  assert.equal(op.proposal.personId, 'adult')
  assert.equal(op.proposal.action, 'reuse_existing_person')
  assert.equal(op.proposal.preserveExistingDetails, true)
  assert.equal(op.proposal.preserveExistingRoles, true)
  assert.equal(result.deferred.length, 0)
  assert.equal(JSON.stringify(data), before)
  assert.equal(planFamilyBatch({ ...data, applied: result.operations }).operations.length, 0)
})
test('owner decisions reject changed targets, foreign scope and duplicate targets', () => {
  const data = ownerFixture()
  data.snapshot.people[0].custom_fields.external_id = 'other-source'
  assert.throws(() => planFamilyBatch(data), /target changed/)
  data.snapshot.people[0].custom_fields = {}
  data.identityDecisions[0].tenantId = 'foreign'
  assert.throws(() => planFamilyBatch(data), /Invalid owner/)
  data.identityDecisions[0].tenantId = 'school'
  data.identityDecisions.push({ ...data.identityDecisions[0], sourcePersonId: 'another-source' })
  assert.throws(() => planFamilyBatch(data), /Invalid owner/)
})