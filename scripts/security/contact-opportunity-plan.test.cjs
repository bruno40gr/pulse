/* eslint-disable @typescript-eslint/no-require-imports -- Offline synthetic tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./synthetic-harness.cjs')
const { planStudentOpportunities } = createHarness().load('lib/contact-opportunity-plan.ts')
const base = () => ({ tenantId: 'school', personIds: ['p1', 'p2'], serviceKey: 'Band', students: [
  { id: 'p1', tenant_id: 'school', first_name: 'Alex', last_name: 'Example', student_id: 's1' },
  { id: 'p2', tenant_id: 'school', first_name: 'Alex', last_name: 'Example', student_id: 's2' },
], existing: [] })
test('identical names remain distinct existing students, without creating anything', () => {
  const input = base(), copy = structuredClone(input), rows = planStudentOpportunities(input)
  assert.deepEqual(Array.from(rows, row => row.decision), ['eligible', 'eligible'])
  assert.deepEqual(input, copy)
})
test('open opportunities are flagged for review rather than duplicated or silently reused', () => {
  const input = base(); input.existing = [{ id: 'o', tenant_id: 'school', student_person_id: 'p1', service_key: 'band', status: 'contacted' }]
  const rows = planStudentOpportunities(input)
  assert.equal(rows[0].decision, 'review_existing'); assert.deepEqual(Array.from(rows[0].opportunityIds), ['o']); assert.equal(rows[1].decision, 'eligible')
  input.existing[0].status = 'lost'; assert.equal(planStudentOpportunities(input)[0].decision, 'eligible')
})
test('invalid, duplicate or cross-tenant identities fail safely', () => {
  const input = base(); input.students[0].student_id = null
  assert.equal(planStudentOpportunities(input)[0].decision, 'invalid_student')
  input.personIds.push('p1'); assert.throws(() => planStudentOpportunities(input))
  input.personIds.pop(); input.students[1].tenant_id = 'other'; assert.throws(() => planStudentOpportunities(input))
})