/* eslint-disable @typescript-eslint/no-require-imports -- Built-in runner; synthetic inputs only. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const file = path.resolve(__dirname, '../../lib/academy-import-preview.ts')
const exported = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText, { exports: exported }, { filename: file, timeout: 1000 })
const { previewSubscriptionImport } = exported
const scope = { tenantId: 'synthetic-school', contextId: 'baseline-a', sourceSystem: 'synthetic-export' }
const students = [
  { ...scope, sourceStudentId: 'learner-1', studentId: 'student-a' },
  { ...scope, sourceStudentId: 'learner-2', studentId: 'student-b' },
]
const subscriptions = [{ ...scope, sourceSubscriptionId: 'subscription-1', enrollmentId: 'enrollment-a', studentId: 'student-a' }]
const row = (subscription = 'subscription-1', student = 'learner-1') => ({ sourceStudentId: student, sourceSubscriptionId: subscription })
const preview = rows => previewSubscriptionImport(scope, students, subscriptions, rows)

test('existing subscription matches stable target on repeated preview without mutation', () => {
  const rows = [row()]
  const before = JSON.stringify({ scope, students, subscriptions, rows })
  const first = preview(rows)
  assert.equal(first.rows[0].disposition, 'matched')
  assert.equal(first.rows[0].enrollmentId, 'enrollment-a')
  assert.equal(JSON.stringify(first), JSON.stringify(preview(rows)))
  assert.equal(JSON.stringify({ scope, students, subscriptions, rows }), before)
})
test('second subscription for same student is a separate creation candidate, never an overwrite', () => {
  const result = preview([row(), row('subscription-2')])
  assert.equal(result.rows[0].enrollmentId, 'enrollment-a')
  assert.equal(result.rows[1].disposition, 'creation_candidate')
  assert.equal(result.rows[1].studentId, 'student-a')
  assert.equal('enrollmentId' in result.rows[1], false)
})
test('missing IDs, numeric IDs, whitespace and contact-only evidence quarantine', () => {
  for (const value of [null, [], {}, { sourceStudentId: 'learner-1' }, row('', 'learner-1'),
    row('subscription-1', 1), row(' subscription-1'), { ...row(), email: 'synthetic@example.invalid' },
  ]) assert.equal(preview([value]).rows[0].issue, 'invalid_source_row')
})
test('unknown student does not create an identity from source data', () => {
  assert.equal(preview([row('new', 'unmapped')]).rows[0].issue, 'unknown_student')
})
test('subscription cannot silently move to another student', () => {
  assert.equal(preview([row('subscription-1', 'learner-2')]).rows[0].issue, 'subscription_student_conflict')
})
test('all duplicate subscriptions quarantine regardless of order or matching student', () => {
  for (const rows of [[row(), row()], [row(), row('subscription-1', 'learner-2')]]) {
    for (const ordered of [rows, [...rows].reverse()]) {
      assert.ok(preview(ordered).rows.every(item => item.issue === 'duplicate_subscription'))
    }
  }
})
test('malformed row sharing a subscription ID prevents accepting its valid counterpart', () => {
  const result = preview([row(), { sourceSubscriptionId: 'subscription-1' }])
  assert.equal(result.rows[0].issue, 'duplicate_subscription')
  assert.equal(result.rows[1].issue, 'invalid_source_row')
})
for (const field of ['tenantId', 'contextId', 'sourceSystem']) {
  test(`foreign ${field} in either mapping inventory aborts preview`, () => {
    assert.throws(() => previewSubscriptionImport(scope, [{ ...students[0], [field]: 'other' }], [], []), /mapping_scope_mismatch/)
    assert.throws(() => previewSubscriptionImport(scope, students, [{ ...subscriptions[0], [field]: 'other' }], []), /mapping_scope_mismatch/)
  })
}
test('missing explicit scope fails even with empty rows', () => {
  for (const field of ['tenantId', 'contextId', 'sourceSystem']) {
    assert.throws(() => previewSubscriptionImport({ ...scope, [field]: '' }, [], [], []), /invalid_import_scope/)
  }
})
test('duplicate or conflicting mapping keys abort rather than last-write-wins', () => {
  for (const studentId of ['student-a', 'student-b']) {
    assert.throws(() => previewSubscriptionImport(scope, [...students, { ...students[0], studentId }], [], []), /duplicate_student_mapping/)
    assert.throws(() => previewSubscriptionImport(scope, students, [...subscriptions, { ...subscriptions[0], studentId }], []), /duplicate_subscription_mapping/)
  }
})
test('two source references cannot assign one canonical enrollment to different students', () => {
  assert.throws(() => previewSubscriptionImport(scope, students, [...subscriptions,
    { ...subscriptions[0], sourceSubscriptionId: 'alias', studentId: 'student-b' },
  ], []), /conflicting_enrollment_owner/)
})
test('opaque source IDs are case-sensitive and not delimiter-concatenated', () => {
  const result = preview([row('Subscription-1'), row('subscription:2'), row('subscription|2')])
  assert.ok(result.rows.every(item => item.disposition === 'creation_candidate'))
})
test('empty or incomplete exports do not infer deletions or unchanged terms', () => {
  const result = preview([])
  assert.equal(result.rows.length, 0)
  assert.equal(result.counts.total, 0)
  assert.equal('deletions' in result, false)
  assert.equal('unchanged' in result.counts, false)
})
test('counts reconcile every input position and returned structures are immutable copies', () => {
  const result = preview([row(), row('new'), row('unknown', 'missing'), null])
  assert.equal(result.counts.total, 4)
  assert.equal(result.counts.matched, 1)
  assert.equal(result.counts.creationCandidates, 1)
  assert.equal(result.counts.quarantined, 2)
  assert.equal(result.rows.map(item => item.rowNumber).join(','), '1,2,3,4')
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.rows) && Object.isFrozen(result.counts))
  assert.ok(Object.isFrozen(result.scope) && result.rows.every(Object.isFrozen))
  assert.notEqual(result.scope, scope)
})