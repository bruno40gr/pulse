/* eslint-disable @typescript-eslint/no-require-imports -- Node's built-in runner; no framework or network. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const file = path.resolve(__dirname, '../../lib/academy-domain.ts')
const exportsObject = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText, { exports: exportsObject }, { filename: file, timeout: 1000 })
const { selectEnrollment, parsePaymentPlan, parseSavedOffer, snapshotOfferForEnrollment } = exportsObject
const scope = { tenantId: 'synthetic-school', contextId: 'scenario-a', studentId: 'learner-a' }
const enrollment = id => ({ ...scope, id })
const target = { tenantId: scope.tenantId, contextId: scope.contextId, enrollmentId: 'enrollment-a' }
const offer = () => ({
  id: 'summer', tenantId: scope.tenantId, name: 'Summer Offer Special', version: 1, archived: false,
  adjustment: { kind: 'percent_off', basisPoints: 4000 }, scope: { kind: 'billing_periods', count: 1 },
})
const throwsCode = (fn, code) => assert.throws(fn, error => error.code === code)

test('single eligible enrollment supports explicit legacy selection without input mutation', () => {
  const input = enrollment('a')
  const selected = selectEnrollment(scope, [input])
  assert.equal(selected.id, 'a')
  assert.notEqual(selected, input)
  assert.ok(Object.isFrozen(selected))
})
test('two enrollments require selection regardless of input ordering', () => {
  for (const ids of [['a', 'b'], ['b', 'a']]) {
    throwsCode(() => selectEnrollment(scope, ids.map(enrollment)), 'enrollment_selection_required')
    assert.equal(selectEnrollment(scope, ids.map(enrollment), 'b').id, 'b')
  }
})
test('missing enrollment and explicit unknown ID do not fall back', () => {
  throwsCode(() => selectEnrollment(scope, []), 'enrollment_not_found')
  throwsCode(() => selectEnrollment(scope, [enrollment('a')], 'unknown'), 'enrollment_not_found')
  throwsCode(() => selectEnrollment(scope, [enrollment('a')], ''), 'invalid_text')
})
for (const field of ['tenantId', 'contextId', 'studentId']) {
  test(`enrollment ${field} mismatch is rejected even when requested row matches`, () => {
    throwsCode(() => selectEnrollment(scope, [enrollment('a'), { ...enrollment('b'), [field]: 'other' }], 'a'), 'enrollment_scope_mismatch')
  })
}
test('missing scope and duplicate enrollment identities fail closed', () => {
  throwsCode(() => selectEnrollment({ ...scope, contextId: '' }, [enrollment('a')]), 'invalid_text')
  throwsCode(() => selectEnrollment(scope, [enrollment('a'), enrollment('a')]), 'invalid_enrollment_identity')
})

for (const plan of [
  { kind: 'single_visit', paymentCadence: 'once', pricing: 'flat', visits: 1 },
  { kind: 'visit_pack', paymentCadence: 'once', pricing: 'flat', visits: 5 },
  { kind: 'recurring_payments', paymentCadence: 'monthly', pricing: 'per_visit' },
  { kind: 'recurring_payments', paymentCadence: 'weekly', pricing: 'flat' },
  { kind: 'prepaid_recurring', paymentCadence: 'once', pricing: 'per_visit', visits: 24 },
  { kind: 'prepaid_recurring', paymentCadence: 'once', pricing: 'flat', visits: 24 },
]) {
  test(`plan terms: ${plan.kind}/${plan.paymentCadence}/${plan.pricing}`, () => {
    const parsed = parsePaymentPlan(plan)
    assert.equal(JSON.stringify(parsed), JSON.stringify(plan))
    assert.ok(Object.isFrozen(parsed))
  })
}
test('invalid or contradictory plan terms reject rather than silently discard fields', () => {
  const base = { kind: 'single_visit', paymentCadence: 'once', pricing: 'flat', visits: 1 }
  for (const bad of [null, [], {}, { ...base, visits: 2 }, { ...base, visits: 0 },
    { ...base, visits: 1.5 }, { ...base, paymentCadence: 'monthly' },
    { ...base, kind: 'mystery' }, { ...base, collectionEnabled: true },
    { kind: 'recurring_payments', paymentCadence: 'monthly', pricing: 'per_visit', visits: 4 },
  ]) assert.throws(() => parsePaymentPlan(bad))
})

for (const adjustment of [
  { kind: 'fixed_price', currency: 'USD', amountMinor: 0 },
  { kind: 'fixed_price', currency: 'USD', amountMinor: 500 },
  { kind: 'amount_off', currency: 'USD', amountMinor: 500 },
  { kind: 'percent_off', basisPoints: 10000 },
]) {
  test(`saved offer supports ${JSON.stringify(adjustment)} without conflating modes`, () => {
    const parsed = parseSavedOffer({ ...offer(), adjustment })
    assert.equal(JSON.stringify(parsed.adjustment), JSON.stringify(adjustment))
  })
}
test('invalid offer values, mixed modes and malformed scope reject', () => {
  for (const adjustment of [
    { kind: 'percent_off', basisPoints: 10001 }, { kind: 'percent_off', basisPoints: -1 },
    { kind: 'percent_off', basisPoints: 0.5 }, { kind: 'percent_off', basisPoints: 4000, amountMinor: 500 },
    { kind: 'amount_off', currency: 'USD', amountMinor: -1 },
    { kind: 'fixed_price', currency: 'usd', amountMinor: 500 },
    { kind: 'fixed_price', currency: 'USD', amountMinor: Number.MAX_SAFE_INTEGER + 1 },
    { kind: 'fixed_price', currency: 'USD', amountMinor: '500' },
  ]) assert.throws(() => parseSavedOffer({ ...offer(), adjustment }))
  for (const scope of [{ kind: 'visits', count: 0 }, { kind: 'forever', count: 1 }, { kind: 'visits', count: 1, hidden: true }]) {
    assert.throws(() => parseSavedOffer({ ...offer(), scope }))
  }
  for (const patch of [{ name: '' }, { tenantId: '' }, { version: 0 }, { archived: 'false' }, { autoCollect: true }]) {
    assert.throws(() => parseSavedOffer({ ...offer(), ...patch }))
  }
})
test('one saved named offer supplies distinct immutable enrollment snapshots', () => {
  const input = offer()
  const first = snapshotOfferForEnrollment(input, target, 1)
  const second = snapshotOfferForEnrollment(input, { ...target, enrollmentId: 'enrollment-b' }, 1)
  assert.equal(first.offerId, second.offerId)
  assert.notEqual(first.enrollmentId, second.enrollmentId)
  input.name = 'Black Friday'
  input.version = 2
  input.archived = true
  input.adjustment.basisPoints = 2000
  input.scope.count = 2
  assert.equal(first.offerName, 'Summer Offer Special')
  assert.equal(first.offerVersion, 1)
  assert.equal(first.adjustment.basisPoints, 4000)
  assert.equal(first.scope.count, 1)
  assert.ok(Object.isFrozen(first) && Object.isFrozen(first.adjustment) && Object.isFrozen(first.scope))
})
test('offer snapshot requires same tenant, explicit context, current version and non-archived definition', () => {
  throwsCode(() => snapshotOfferForEnrollment(offer(), { ...target, tenantId: 'other' }, 1), 'offer_tenant_mismatch')
  throwsCode(() => snapshotOfferForEnrollment(offer(), { ...target, contextId: '' }, 1), 'invalid_text')
  throwsCode(() => snapshotOfferForEnrollment(offer(), target, 2), 'offer_version_conflict')
  throwsCode(() => snapshotOfferForEnrollment({ ...offer(), archived: true }, target, 1), 'offer_archived')
})
test('offer labels do not encode promotion behavior', () => {
  for (const name of ['Summer Offer Special', 'Black Friday', "Owner's Discount"]) {
    const parsed = parseSavedOffer({ ...offer(), name })
    assert.equal(parsed.adjustment.basisPoints, 4000)
    assert.equal(parsed.scope.count, 1)
  }
})