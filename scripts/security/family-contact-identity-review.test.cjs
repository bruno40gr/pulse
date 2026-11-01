/* eslint-disable @typescript-eslint/no-require-imports -- Node synthetic fixtures. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { reviewContactIdentities } = require('./family-contact-identity-review.cjs')
const fixture = () => ({ tenantId: 'school', preview: { metadata: { tenantId: 'school' }, contacts: [{ sourcePersonId: 'source', names: ['Jane Doe'] }] }, people: [], clients: [{ Id: 'source', 'Full Name': 'Jane Doe', Email: 'jane@example.invalid', 'Phone 1': '(202) 555-0101' }] })
test('unkeyed overlaps are review only, never an automatic merge', () => {
  const data = fixture(); data.people = [{ id: 'person', tenant_id: 'school', first_name: 'Jane', last_name: 'Doe', phone: '+12025550101' }]
  const row = reviewContactIdentities(data).contacts[0]
  assert.equal(row.disposition, 'review_existing_people_without_source_id')
  assert.deepEqual(row.candidates[0].evidence, ['same_normalized_name', 'same_phone'])
  assert.equal(row.automaticMerge, false)
  assert.equal(row.creationAuthorized, false)
})
test('shared email with a different source ID remains a distinct identity', () => {
  const data = fixture(); data.people = [{ id: 'person', tenant_id: 'school', email: 'jane@example.invalid', custom_fields: { external_id: 'different' } }]
  const row = reviewContactIdentities(data).contacts[0]
  assert.equal(row.disposition, 'creation_candidate_no_unkeyed_overlap_found')
  assert.equal(row.candidates[0].interpretation, 'distinct_source_identity_shared_details_not_a_merge')
})
test('exact source identity is reused and duplicates block', () => {
  const data = fixture(); data.people = [{ id: 'person', tenant_id: 'school', custom_fields: { external_id: 'source' } }]
  assert.equal(reviewContactIdentities(data).contacts[0].exactPersonId, 'person')
  data.people.push({ ...data.people[0], id: 'duplicate' })
  assert.equal(reviewContactIdentities(data).contacts[0].disposition, 'blocked_identity_conflict')
})
test('foreign scope and duplicate preview identities fail closed', () => {
  const data = fixture(); data.people = [{ tenant_id: 'foreign' }]
  assert.throws(() => reviewContactIdentities(data), /scope/)
  data.people = []; data.preview.contacts.push(data.preview.contacts[0])
  assert.throws(() => reviewContactIdentities(data), /Duplicate/)
})