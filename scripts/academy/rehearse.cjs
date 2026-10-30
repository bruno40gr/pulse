/* eslint-disable @typescript-eslint/no-require-imports -- Local synthetic command using existing TypeScript VM harness pattern. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

// Only these pure modules can be loaded. No application clients, environment,
// network functions or provider SDKs are supplied to their VM contexts.
function loadHelpers() {
  const cache = new Map()
  function load(name) {
    assert.ok(['academy-domain', 'academy-import-preview', 'academy-enrollment-terms'].includes(name))
    if (cache.has(name)) return cache.get(name)
    const file = path.resolve(__dirname, '../../lib', `${name}.ts`)
    const exported = {}
    cache.set(name, exported)
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
    }).outputText
    vm.runInNewContext(code, { exports: exported, require: id => {
      assert.equal(id, './academy-domain')
      return load('academy-domain')
    } }, { filename: file, timeout: 1000 })
    return exported
  }
  return { ...load('academy-domain'), ...load('academy-import-preview'), ...load('academy-enrollment-terms') }
}

/** Fixed fictional rehearsal, not an importer, transaction implementation or
 * storage API. All fixture state is rebuilt each run and discarded on return.
 */
function runRehearsal() {
  const { selectEnrollment, previewSubscriptionImport, parseEnrollmentTerms,
    prepareEnrollmentTermsChange, validateEnrollmentTermsHistory } = loadHelpers()
  const scope = { tenantId: 'fictional-school', contextId: 'fictional-scenario', studentId: 'fictional-student' }
  const importScope = { tenantId: scope.tenantId, contextId: scope.contextId, sourceSystem: 'fictional-export' }
  const enrollments = ['fictional-piano', 'fictional-voice'].map(id => ({ ...scope, id }))
  const studentMappings = [{ ...importScope, sourceStudentId: 'source-student', studentId: scope.studentId }]
  const mappings = enrollments.map((row, index) => ({
    ...importScope, studentId: scope.studentId, enrollmentId: row.id, sourceSubscriptionId: `source-subscription-${index + 1}`,
  }))
  const sourceRows = mappings.map(row => ({ sourceStudentId: 'source-student', sourceSubscriptionId: row.sourceSubscriptionId }))
  const histories = new Map(enrollments.map(row => [row.id, [parseEnrollmentTerms({
    tenantId: scope.tenantId, contextId: scope.contextId, enrollmentId: row.id,
    version: 1, effectiveFrom: '2026-10-01', effectiveUntil: null,
    service: { id: `${row.id}-service`, version: 1 }, plan: { id: 'fictional-monthly', version: 1 },
    paymentPlan: { kind: 'recurring_payments', paymentCadence: 'monthly', pricing: 'per_visit' },
    price: { currency: 'USD', amountMinor: 5000 }, recordedBy: 'fictional-staff', reason: 'Synthetic initial terms',
  })]]))
  const checks = []
  const check = (name, action) => { action(); checks.push(name) }
  const rejects = (action, code) => assert.throws(action, error => (error.code ?? error.message) === code)
  const preview = rows => previewSubscriptionImport(importScope, studentMappings, mappings, rows)
  const before = JSON.stringify([...histories])

  check('Two source subscriptions match separate enrollments for one student', () => {
    const result = preview(sourceRows)
    assert.equal(result.counts.matched, 2)
    assert.equal(new Set(result.rows.map(row => row.enrollmentId)).size, 2)
  })
  check('Repeating the identity preview is deterministic, not a persisted import', () => {
    assert.equal(JSON.stringify(preview(sourceRows)), JSON.stringify(preview(sourceRows)))
  })
  check('A third subscription is only a creation candidate', () => {
    const result = preview([...sourceRows, { sourceStudentId: 'source-student', sourceSubscriptionId: 'source-subscription-3' }])
    assert.equal(result.counts.creationCandidates, 1)
    assert.equal('enrollmentId' in result.rows[2], false)
    assert.equal(enrollments.length, 2)
  })
  check('Duplicate source subscriptions are quarantined across the whole supplied run', () => {
    const result = preview([sourceRows[0], sourceRows[1], sourceRows[0]])
    assert.equal(result.counts.quarantined, 2)
    assert.equal(result.rows[0].issue, 'duplicate_subscription')
    assert.equal(result.rows[2].issue, 'duplicate_subscription')
  })
  check('Ambiguous lesson edits fail before any fixture change', () => {
    rejects(() => selectEnrollment(scope, enrollments), 'enrollment_selection_required')
    assert.equal(JSON.stringify([...histories]), before)
  })

  const selected = selectEnrollment(scope, enrollments, 'fictional-piano')
  const termsScope = { tenantId: selected.tenantId, contextId: selected.contextId, enrollmentId: selected.id }
  const previous = histories.get(selected.id)[0]
  const proposed = { ...previous, version: 2, effectiveFrom: '2026-11-01',
    price: { currency: 'USD', amountMinor: 5500 }, reason: 'Synthetic reviewed price change' }
  const change = prepareEnrollmentTermsChange(termsScope, histories.get(selected.id), 1, proposed)
  const untouched = JSON.stringify(histories.get('fictional-voice'))

  check('A price-change proposal alone does not change either enrollment', () => {
    assert.equal(JSON.stringify([...histories]), before)
    assert.equal(change.closePreviousAt, '2026-11-01')
  })
  // Illustrative in-memory projection only. This is not a transaction, database
  // concurrency check, acceptance authorization or general-purpose commit API.
  const projected = validateEnrollmentTermsHistory(termsScope, [
    { ...change.previous, effectiveUntil: change.closePreviousAt }, change.next,
  ])
  histories.set(selected.id, projected)
  check('Projected piano history preserves the old rate and leaves voice unchanged', () => {
    assert.equal(projected[0].price.amountMinor, 5000)
    assert.equal(projected[0].effectiveUntil, '2026-11-01')
    assert.equal(projected[1].price.amountMinor, 5500)
    assert.equal(JSON.stringify(histories.get('fictional-voice')), untouched)
    assert.equal(previous.effectiveUntil, null)
  })
  check('A stale proposal is rejected against the projected revision', () => {
    const snapshot = JSON.stringify([...histories])
    rejects(() => prepareEnrollmentTermsChange(termsScope, projected, 1, proposed), 'terms_version_conflict')
    assert.equal(JSON.stringify([...histories]), snapshot)
  })
  check('A mismatched context is rejected without changing fixture state', () => {
    rejects(() => selectEnrollment({ ...scope, contextId: 'other-fictional-scenario' }, enrollments, selected.id), 'enrollment_scope_mismatch')
    rejects(() => validateEnrollmentTermsHistory({ ...termsScope, contextId: 'other-fictional-scenario' }, projected), 'terms_scope_mismatch')
  })

  return {
    mode: 'synthetic-memory-only', checks,
    enrollments: [...histories].map(([id, history]) => ({ id, versions: history.map(row => ({
      version: row.version, effectiveFrom: row.effectiveFrom, effectiveUntil: row.effectiveUntil,
      currency: row.price.currency, amountMinor: row.price.amountMinor,
    })) })),
    limitations: 'No database, route, UI, authorization, persisted idempotency, concurrency, provider or billing acceptance is established.',
  }
}

if (require.main === module) {
  const report = runRehearsal()
  console.log('Fictional lesson-enrollment rehearsal — no live data or billing')
  for (const check of report.checks) console.log(`PASS: ${check}`)
  console.log(JSON.stringify(report.enrollments, null, 2))
  console.log(report.limitations)
}

module.exports = { runRehearsal }