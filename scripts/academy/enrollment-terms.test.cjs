/* eslint-disable @typescript-eslint/no-require-imports -- Built-in runner; pure TypeScript modules only. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')
const cache = new Map()
function load(name) {
  if (cache.has(name)) return cache.get(name)
  assert.ok(['academy-domain', 'academy-enrollment-terms'].includes(name))
  const file = path.join(root, 'lib', `${name}.ts`)
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
const { parseEnrollmentTerms, validateEnrollmentTermsHistory, prepareEnrollmentTermsChange } = load('academy-enrollment-terms')
const scope = { tenantId: 'synthetic-school', contextId: 'scenario-a', enrollmentId: 'enrollment-a' }
const terms = (patch = {}) => ({
  ...scope, version: 1, effectiveFrom: '2026-10-15', effectiveUntil: null,
  service: { id: 'private-piano', version: 1 }, plan: { id: 'monthly-lessons', version: 1 },
  paymentPlan: { kind: 'recurring_payments', paymentCadence: 'monthly', pricing: 'per_visit' },
  price: { currency: 'USD', amountMinor: 5000 }, recordedBy: 'synthetic-staff', reason: 'Agreed lesson terms',
  ...patch,
})
const next = patch => terms({ version: 2, effectiveFrom: '2026-11-01', ...patch })
const throwsCode = (fn, code) => assert.throws(fn, error => error.code === code)

test('initial terms change requires expected version zero and creates no live change', () => {
  const change = prepareEnrollmentTermsChange(scope, [], 0, terms())
  assert.equal(change.previous, null)
  assert.equal(change.closePreviousAt, null)
  assert.equal(change.next.version, 1)
  assert.equal('paid' in change.next, false)
})
test('open predecessor is closed in proposal without mutating its source snapshot', () => {
  const original = terms()
  const before = JSON.stringify(original)
  const change = prepareEnrollmentTermsChange(scope, [original], 1, next())
  assert.equal(change.closePreviousAt, '2026-11-01')
  assert.equal(change.previous.effectiveUntil, null)
  assert.equal(JSON.stringify(original), before)
  assert.notEqual(change.previous, original)
})
test('adjacent inclusive-start/exclusive-end terms are allowed', () => {
  const history = validateEnrollmentTermsHistory(scope, [terms({ effectiveUntil: '2026-11-01' }), next()])
  assert.equal(history.length, 2)
  assert.ok(Object.isFrozen(history))
})
test('gaps are allowed without implying enrollment pause or coverage', () => {
  const change = prepareEnrollmentTermsChange(scope, [terms({ effectiveUntil: '2026-10-20' })], 1, next())
  assert.equal(change.closePreviousAt, null)
})
test('overlapping bounded terms are rejected', () => {
  const previous = terms({ effectiveUntil: '2026-11-02' })
  throwsCode(() => validateEnrollmentTermsHistory(scope, [previous, next()]), 'terms_overlap')
  throwsCode(() => prepareEnrollmentTermsChange(scope, [previous], 1, next()), 'terms_overlap')
})
test('open predecessor cannot coexist with following terms in stored history', () => {
  throwsCode(() => validateEnrollmentTermsHistory(scope, [terms(), next()]), 'terms_overlap')
})
test('stale, negative and fractional expected versions fail', () => {
  for (const version of [0, 2, -1, 1.5, NaN]) {
    throwsCode(() => prepareEnrollmentTermsChange(scope, [terms()], version, next()), 'terms_version_conflict')
  }
})
test('new revision must increment version by one', () => {
  throwsCode(() => prepareEnrollmentTermsChange(scope, [terms()], 1, next({ version: 3 })), 'terms_next_version')
})
test('same-day and historical replacement require a separate correction workflow', () => {
  for (const effectiveFrom of ['2026-10-15', '2026-09-01']) {
    throwsCode(() => prepareEnrollmentTermsChange(scope, [terms()], 1, next({ effectiveFrom })), 'terms_change_not_append')
  }
})
for (const field of ['tenantId', 'contextId', 'enrollmentId']) {
  test(`history and proposal reject ${field} mismatch`, () => {
    throwsCode(() => validateEnrollmentTermsHistory(scope, [terms({ [field]: 'other' })]), 'terms_scope_mismatch')
    throwsCode(() => prepareEnrollmentTermsChange(scope, [terms()], 1, next({ [field]: 'other' })), 'terms_scope_mismatch')
  })
}
test('actual calendar dates validate leap years without Date rollover', () => {
  for (const effectiveFrom of ['2024-02-29', '2000-02-29', '2026-01-31']) {
    assert.equal(parseEnrollmentTerms(terms({ effectiveFrom })).effectiveFrom, effectiveFrom)
  }
  for (const effectiveFrom of ['2026-02-29', '1900-02-29', '2026-04-31', '0000-01-01', '2026-00-10', '2026-13-01', '2026-01-00', '2026-1-01', '2026-01-01T00:00:00Z']) {
    throwsCode(() => parseEnrollmentTerms(terms({ effectiveFrom })), 'invalid_terms_date')
  }
})
test('empty or reversed date ranges reject', () => {
  for (const effectiveUntil of ['2026-10-15', '2026-10-14']) {
    throwsCode(() => parseEnrollmentTerms(terms({ effectiveUntil })), 'invalid_terms_range')
  }
})
test('history version and date ordering are explicit rather than silently sorted', () => {
  throwsCode(() => validateEnrollmentTermsHistory(scope, [terms({ effectiveUntil: '2026-11-01' }), next({ version: 1 })]), 'terms_version_order')
  throwsCode(() => validateEnrollmentTermsHistory(scope, [terms({ effectiveUntil: '2026-11-01' }), next({ effectiveFrom: '2026-09-01' })]), 'terms_date_order')
})
test('money, reference, attribution and extra-field validation fail closed', () => {
  for (const patch of [
    { price: { currency: 'usd', amountMinor: 5000 } }, { price: { currency: 'USD', amountMinor: -1 } },
    { price: { currency: 'USD', amountMinor: 1.5 } }, { price: { currency: 'USD', amountMinor: Number.MAX_SAFE_INTEGER + 1 } },
    { service: { id: '', version: 1 } }, { plan: { id: 'monthly', version: 0 } },
    { recordedBy: '' }, { reason: '' }, { paid: true }, { effectiveUntil: undefined },
    { paymentPlan: { kind: 'recurring_payments', paymentCadence: 'once', pricing: 'per_visit' } },
  ]) assert.throws(() => parseEnrollmentTerms(terms(patch)))
})
test('snapshots are deeply copied and immutable, template edits cannot reprice them', () => {
  const input = terms()
  const parsed = parseEnrollmentTerms(input)
  input.price.amountMinor = 100
  input.plan.version = 2
  input.service.id = 'different'
  input.paymentPlan.pricing = 'flat'
  assert.equal(parsed.price.amountMinor, 5000)
  assert.equal(parsed.plan.version, 1)
  assert.equal(parsed.service.id, 'private-piano')
  assert.equal(parsed.paymentPlan.pricing, 'per_visit')
  assert.ok([parsed, parsed.price, parsed.plan, parsed.service, parsed.paymentPlan].every(Object.isFrozen))
})
test('prepared change and its scope are immutable', () => {
  const result = prepareEnrollmentTermsChange(scope, [terms()], 1, next())
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.scope))
})