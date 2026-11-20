/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic fixtures. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { reviewSubscriptions } = require('./subscription-review.cjs')
const { compareIdentityCounts } = require('./subscription-review.cjs')
const fixture = () => ({ tenantId: 'school', people: [{ id: 'p', tenant_id: 'school', custom_fields: { external_id: 'source' } }], students: [{ id: 's', tenant_id: 'school', person_id: 'p' }], subscriptions: [
  { 'Client Id': 'source', 'Client Name': 'Student', Status: 'Active' },
  { 'Client Id': 'source', 'Client Name': 'Student', Status: 'Pending' },
  { 'Client Id': 'source', Status: 'Ended' },
] })
test('retains active and pending separately and excludes ended without mutating input', () => {
  const input = fixture(), original = structuredClone(input), result = reviewSubscriptions(input)
  assert.equal(result.summary.rows, 2)
  assert.equal(result.clients[0].resolution, 'unique_student_by_source_id')
  assert.deepEqual(result.clients[0].subscriptions.map(row => row.status), ['Active', 'Pending'])
  assert.deepEqual(input, original)
})
test('duplicate, absent and missing identities require review and never match by name', () => {
  const input = fixture()
  input.people.push({ id: 'p2', tenant_id: 'school', custom_fields: { external_id: 'source' } })
  input.subscriptions.push({ 'Client Id': 'unknown', 'Client Name': 'Student', Status: 'Active' }, { 'Client Name': 'Student', Status: 'Pending' })
  assert.deepEqual(reviewSubscriptions(input).clients.map(row => row.resolution), ['duplicate_source_id', 'no_person_by_source_id', 'missing_source_id'])
})
test('rejects cross-tenant snapshot data and ambiguous student records', () => {
  const input = fixture(); input.students.push({ id: 's2', tenant_id: 'school', person_id: 'p' })
  assert.equal(reviewSubscriptions(input).clients[0].resolution, 'multiple_student_records')
  input.students[0].tenant_id = 'other'
  assert.throws(() => reviewSubscriptions(input), /tenant/)
})
test('compares aggregate identity counts without inventing identities', () => {
  const input = fixture().subscriptions
  input.push({ 'Client Id': 'missing', 'Client Name': 'Another', Status: 'Pending' })
  const report = compareIdentityCounts(input, [{ external_id: 'source', people_count: 1, student_count: 1 }])
  assert.equal(report.clients, 2); assert.equal(report.rows, 3); assert.equal(report.counts.matched, 1); assert.equal(report.review[0].names[0], 'Another')
  assert.throws(() => compareIdentityCounts(input, [{ external_id: 'source', people_count: 1, student_count: 1 }, { external_id: 'source', people_count: 1, student_count: 1 }]))
})