/* eslint-disable @typescript-eslint/no-require-imports -- Existing synthetic Node test harness. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const { createDemoFunding, fundingTotals, recalculateDemoFundingCase, isFundingDemoTenant } = createHarness().load('lib/funding/demo.ts')
const now = new Date('2026-10-09T12:00:00Z')
const KUMON = '00000000-0000-0000-0000-000000000003'

for (const tenant of [DEMO, KUMON]) {
  test(`${tenant}: three established programs and twelve complete demo workflows`, () => {
    const { programs, cases } = createDemoFunding(tenant, now)
    assert.equal(programs.length, 3)
    assert.equal(cases.length, 12)
    assert.equal(new Set(cases.map(item => item.id)).size, 12)
    for (const program of programs) {
      assert.equal(program.affiliationStatus, 'established')
      assert.equal(program.activeCases, 4)
      assert.ok(program.contacts.length && program.studentRequirements.length && program.billingGuidance.length)
      assert.ok(cases.filter(item => item.profileVersionId === program.profileVersionId).length === 4)
    }
    for (const status of ['draft', 'pending', 'paid', 'overdue', 'rejected']) {
      assert.ok(cases.some(item => item.invoices.some(invoice => invoice.status === status)))
    }
    assert.ok(cases.some(item => item.missingDetails.length > 0))
    assert.ok(cases.some(item => item.nextStepOptions.length > 1))
    assert.ok(cases.every(item => item.invoices.length === 3 && item.contacts.length > 0 && item.activity.length > 0))
  })
}

test('real Headliner and unconfigured tenants never receive demo funding records', () => {
  assert.equal(isFundingDemoTenant(HEAD), false)
  assert.equal(createDemoFunding(HEAD, now).cases.length, 0)
  assert.equal(createDemoFunding('unknown', now).programs.length, 0)
  const first = createDemoFunding(DEMO, now)
  const second = createDemoFunding(KUMON, now)
  assert.ok(first.cases.every(item => !second.cases.some(other => other.id === item.id)))
})

test('summary totals are invoice-derived, with pending-only next-30-day forecast', () => {
  const { cases } = createDemoFunding(DEMO, now)
  const totals = fundingTotals(cases, now)
  assert.ok(totals.owed > 0 && totals.paid > 0 && totals.forecast > 0)
  const invoices = cases.flatMap(item => item.invoices)
  assert.equal(totals.owed, invoices.filter(item => item.status !== 'paid').reduce((sum, item) => sum + item.amount, 0))
  assert.equal(totals.paid, invoices.filter(item => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0))
  assert.equal(totals.forecast, invoices.filter(item => item.status === 'pending').reduce((sum, item) => sum + item.amount, 0))
  assert.ok(invoices.filter(item => item.paidOn).every(item => item.paidOn <= '2026-10-09'))
})

test('marking a pending invoice paid updates balances and forecast', () => {
  const { cases } = createDemoFunding(DEMO, now)
  const original = cases[0]
  const invoice = original.invoices[0]
  const updated = recalculateDemoFundingCase({ ...original, invoices: original.invoices.map(item => item.id === invoice.id ? { ...item, status: 'paid' } : item) })
  assert.equal(updated.outstanding, original.outstanding - invoice.amount)
  assert.equal(updated.amountPaid, original.amountPaid + invoice.amount)
  assert.equal(updated.status, 'paid')
  assert.equal(fundingTotals([updated], now).forecast, 0)
})

test('completing missing authorization updates actionable checklist', () => {
  const item = createDemoFunding(DEMO, now).cases[4]
  assert.ok(item.missingDetails.includes('Add the authorization reference.'))
  const updated = recalculateDemoFundingCase({ ...item, authorization: 'DEMO-COMPLETE' })
  assert.equal(updated.missingDetails.length, 0)
  assert.ok(updated.nextStepOptions.some(step => step.includes('submit the draft')))
})

test('forecast excludes overdue, draft, rejected and pending outside the horizon', () => {
  const item = createDemoFunding(DEMO, now).cases[0]
  const invoice = item.invoices[0]
  const cases = [{ ...item, invoices: [
    { ...invoice, dueOn: '2026-10-08' }, { ...invoice, dueOn: '2026-11-15' },
    { ...invoice, status: 'draft' }, { ...invoice, status: 'overdue' }, { ...invoice, status: 'rejected' },
  ] }]
  assert.equal(fundingTotals(cases, now).forecast, 0)
})