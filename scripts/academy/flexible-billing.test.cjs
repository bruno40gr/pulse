/* eslint-disable @typescript-eslint/no-require-imports -- Offline domain and preview adapter tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
function load(name) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../lib', `${name}.ts`), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, { exports, URLSearchParams, require: name => load(name.replace('./', '')) })
  return exports
}
const domain = load('academy-billing')
const { createFamilyPreview, applyFamilyAction, quoteFlexibleInvoice, invoiceTotal } = load('academy-family-preview')
const { monthCoverage, rangesOverlap, validateBillingRanges, previewBillingSchedule, billingScheduleWarnings } = domain
const accountId = 'preview:kim', piano = 'preview:sophie-piano', voice = 'preview:sophie-voice', guitar = 'preview:ethan-guitar'
const selection = (subscriptionId, month, count = 1) => ({ subscriptionId, ranges: [monthCoverage(month, count)] })
const request = (patch = {}) => ({ kind: 'flexible-invoice', accountId, id: 'ADVANCE', requestKey: 'advance-key', payerId: '', date: '2026-11-08', due: '2026-12-08', proration: 'whole-month', selections: [selection(piano, '2027-01', 3)], ...patch })
const schedule = (patch = {}) => ({ start: '2027-04-01', coverageMonths: 3, cadenceMonths: 3, advanceDays: 15, paymentDays: 30, mode: 'manual', custom: [], ...patch })
const arrangement = (patch = {}) => ({ id: 'quarterly', accountId, payerId: '', subscriptionIds: [piano], schedule: schedule(), status: 'active', proration: 'whole-month', generatedKeys: [], ...patch })

test('three future months use subscription records without changing cadence or history', () => {
  const data = createFamilyPreview(), before = JSON.stringify(data), action = request()
  const quote = quoteFlexibleInvoice(data, action)
  assert.equal(quote.invoice.lines.length, 3)
  const enrollment = data.students.flatMap(item => item.enrollments).find(item => item.id === piano)
  assert.equal(invoiceTotal(quote.invoice), enrollment.amountMinor * quote.invoice.lines[0].quantity * 3)
  const next = applyFamilyAction(data, action)
  assert.equal(JSON.stringify(data), before)
  assert.equal(JSON.stringify(next.students), JSON.stringify(data.students))
  assert.equal(next.billingArrangements, undefined)
  assert.equal(next.invoices.at(-1).lines[0].serviceEnd, '2027-02-01')
})
test('unpaid, overdue, partial, paid and refunded invoices all retain service coverage', () => {
  const issued = applyFamilyAction(createFamilyPreview(), request())
  const total = invoiceTotal(issued.invoices.at(-1))
  const partial = applyFamilyAction(issued, { kind: 'partial-invoice-payment', accountId, invoiceId: 'ADVANCE', amountMinor: 1 })
  const paid = applyFamilyAction(partial, { kind: 'partial-invoice-payment', accountId, invoiceId: 'ADVANCE', amountMinor: total - 1 })
  const refunded = applyFamilyAction(paid, { kind: 'refund-invoice', accountId, invoiceId: 'ADVANCE', reason: 'Adjustment' })
  for (const data of [issued, partial, paid, refunded]) {
    const quote = quoteFlexibleInvoice(data, request({ id: 'SECOND', requestKey: 'second', date: '2027-04-01', due: '2027-04-30' }))
    assert.equal(quote.invoice.lines.length, 0)
    assert.equal(quote.conflicts[0].invoiceId, 'ADVANCE')
    assert.throws(() => applyFamilyAction(data, request({ id: 'SECOND', requestKey: 'second' })), /No uninvoiced/)
  }
})
test('coverage overrides and sibling attribution leave each subscription independently eligible', () => {
  const issued = applyFamilyAction(createFamilyPreview(), request({ proration: 'calendar-days', selections: [selection(piano, '2026-12', 2), selection(voice, '2026-11'), selection(guitar, '2027-01')] }))
  const december = quoteFlexibleInvoice(issued, request({ id: 'DEC', requestKey: 'dec', selections: [selection(piano, '2026-12'), selection(voice, '2026-12')] }))
  assert.equal(december.invoice.lines.length, 1)
  assert.equal(december.invoice.lines[0].enrollmentId, voice)
  const february = quoteFlexibleInvoice(issued, request({ selections: [selection(piano, '2027-02')] }))
  assert.equal(february.invoice.lines.length, 1)
  assert.equal(issued.invoices.at(-1).lines.find(line => line.enrollmentId === guitar).studentId, 'preview:ethan')
})
test('date overlap detection supports partial and nonconsecutive ranges with explicit proration', () => {
  assert.equal(rangesOverlap({ start: '2027-01-01', end: '2027-01-16' }, { start: '2027-01-16', end: '2027-02-01' }), false)
  assert.throws(() => validateBillingRanges([{ start: '2027-01-01', end: '2027-02-01' }, { start: '2027-01-16', end: '2027-03-01' }]), /overlap/)
  assert.throws(() => validateBillingRanges([{ start: '2027-02-30', end: '2027-03-01' }]), /valid/)
  const action = request({ proration: 'calendar-days', selections: [{ subscriptionId: piano, ranges: [{ start: '2027-01-01', end: '2027-01-16' }, monthCoverage('2027-03', 1)] }] })
  const issued = applyFamilyAction(createFamilyPreview(), action)
  const remaining = quoteFlexibleInvoice(issued, request({ proration: 'calendar-days', selections: [selection(piano, '2027-01')] }))
  assert.equal(remaining.invoice.lines[0].serviceStart, '2027-01-16')
  assert.throws(() => quoteFlexibleInvoice(issued, request({ selections: [selection(piano, '2027-01')] })), /proration/)
})
test('quarterly generation is independent of coverage duration and uses current prices', () => {
  const rows = previewBillingSchedule(schedule({ coverageMonths: 6 }), [piano])
  assert.equal(rows[0].issueDate, '2027-03-17')
  assert.equal(rows[1].selections[0].ranges[0].start, '2027-07-01')
  assert.equal(rows[0].selections[0].ranges[0].end, '2027-10-01')
  assert.match(billingScheduleWarnings(rows)[0], /overlap/)
  let data = applyFamilyAction(createFamilyPreview(), request({ arrangement: arrangement() }))
  data = { ...data, students: data.students.map(student => ({ ...student, enrollments: student.enrollments.map(item => item.id === piano ? { ...item, amountMinor: item.amountMinor + 100 } : item) })) }
  const generated = applyFamilyAction(data, { kind: 'generate-billing-arrangement', accountId, id: 'quarterly', key: '0' })
  assert.equal(generated.invoices.at(-1).lines[0].unitMinor, data.students.flatMap(item => item.enrollments).find(item => item.id === piano).amountMinor)
  assert.equal(generated.invoices.at(-1).arrangementId, 'quarterly')
  assert.equal(applyFamilyAction(generated, { kind: 'generate-billing-arrangement', accountId, id: 'quarterly', key: '0' }), generated)
})
test('custom invoice prefix transitions to repeating cadence and flags gaps', () => {
  const rows = previewBillingSchedule(schedule({ start: '2027-06-01', custom: [
    { issueDate: '2026-10-20', selections: [selection(piano, '2026-11', 2)] },
    { issueDate: '2026-12-20', selections: [selection(piano, '2027-01')] },
    { issueDate: '2027-01-20', selections: [selection(piano, '2027-02', 4)] },
  ] }), [piano])
  assert.equal(rows[3].selections[0].ranges[0].start, '2027-06-01')
  assert.equal(rows[4].selections[0].ranges[0].start, '2027-09-01')
  assert.equal(billingScheduleWarnings(rows).length, 0)
  assert.match(billingScheduleWarnings(previewBillingSchedule(schedule({ coverageMonths: 1 }), [piano]))[0], /gaps/)
  assert.equal(previewBillingSchedule(schedule({ end: '2027-06-30', occurrences: 2 }), [piano]).length, 1)
})
test('paused and cancelled schedules do not alter previously issued invoices', () => {
  const data = applyFamilyAction(createFamilyPreview(), request({ arrangement: arrangement() }))
  for (const status of ['paused', 'cancelled']) {
    const next = applyFamilyAction(data, { kind: 'billing-arrangement-state', accountId, id: 'quarterly', status })
    assert.equal(JSON.stringify(next.invoices), JSON.stringify(data.invoices))
    assert.throws(() => applyFamilyAction(next, { kind: 'generate-billing-arrangement', accountId, id: 'quarterly', key: '0' }), /not active/)
  }
})
test('retries are idempotent and stale finalization cannot issue overlapping quotes', () => {
  const data = createFamilyPreview(), action = request(), quote = quoteFlexibleInvoice(data, action)
  const next = applyFamilyAction(data, action)
  assert.equal(applyFamilyAction(next, action), next)
  assert.throws(() => applyFamilyAction(next, request({ due: '2026-12-09' })), /different invoice/)
  assert.throws(() => applyFamilyAction(next, request({ id: 'RACE', requestKey: 'race', selections: [selection(piano, '2027-01', 4)], expectedLines: JSON.stringify(quote.invoice.lines) })), /changed/)
  assert.throws(() => applyFamilyAction(next, request({ id: 'RACE', requestKey: 'race' })), /No uninvoiced/)
})
test('draft reservations block conflicts, release explicitly, and expire', () => {
  const data = createFamilyPreview(), selections = [selection(piano, '2027-01')]
  const reserved = applyFamilyAction(data, { kind: 'reserve-billing-draft', accountId, id: 'DRAFT', selections, expiresAt: new Date(Date.now() + 60000).toISOString() })
  assert.equal(quoteFlexibleInvoice(reserved, request({ selections })).invoice.lines.length, 0)
  assert.throws(() => applyFamilyAction(reserved, { kind: 'reserve-billing-draft', accountId, id: 'OTHER', selections, expiresAt: new Date(Date.now() + 60000).toISOString() }), /reserved/)
  assert.equal(quoteFlexibleInvoice(reserved, request({ selections, reservationId: 'DRAFT' })).invoice.lines.length, 1)
  assert.equal(quoteFlexibleInvoice(reserved, request({ selections }), new Date(Date.now() + 120000).toISOString()).invoice.lines.length, 1)
  const released = applyFamilyAction(reserved, { kind: 'release-billing-draft', accountId, id: 'DRAFT' })
  assert.equal(released.billingDrafts.length, 0)
})
test('void releases coverage only when explicit; partial payments cannot be voided', () => {
  const data = applyFamilyAction(createFamilyPreview(), request())
  for (const releaseCoverage of [false, true]) {
    const next = applyFamilyAction(data, { kind: 'void-billing-invoice', accountId, invoiceId: 'ADVANCE', reason: 'Correction', releaseCoverage })
    assert.equal(quoteFlexibleInvoice(next, request()).invoice.lines.length, releaseCoverage ? 3 : 0)
  }
  const partial = applyFamilyAction(data, { kind: 'partial-invoice-payment', accountId, invoiceId: 'ADVANCE', amountMinor: 1 })
  assert.throws(() => applyFamilyAction(partial, { kind: 'void-billing-invoice', accountId, invoiceId: 'ADVANCE', reason: 'Correction', releaseCoverage: true }), /wholly unpaid/)
})
test('cancellation, scope, missing pricing and invalid schedules fail closed', () => {
  const data = createFamilyPreview()
  assert.throws(() => applyFamilyAction(data, request(), { role: 'parent' }), /Only staff/)
  assert.throws(() => quoteFlexibleInvoice(data, request({ selections: [selection('outside', '2027-01')] })), /unavailable/)
  assert.throws(() => quoteFlexibleInvoice(data, request({ payerId: 'outside' })), /payer/)
  const cancelled = applyFamilyAction(data, { kind: 'subscription-state', accountId, enrollmentId: piano, state: 'cancelled' })
  assert.throws(() => quoteFlexibleInvoice(cancelled, request()), /active monthly/)
  assert.throws(() => previewBillingSchedule(schedule({ cadenceMonths: 0 }), [piano]), /intervals/)
  assert.throws(() => previewBillingSchedule(schedule({ custom: [{ issueDate: 'bad', selections: [] }] }), [piano]), /custom/)
})
test('future schedule revisions preserve issued snapshots and use independent override ranges', () => {
  let data = applyFamilyAction(createFamilyPreview(), request({ arrangement: arrangement() }))
  data = applyFamilyAction(data, { kind: 'generate-billing-arrangement', accountId, id: 'quarterly', key: '0' })
  const before = JSON.stringify(data.invoices)
  const changed = schedule({ start: '2027-07-01', cadenceMonths: 6, overrides: { [piano]: { offsetMonths: 1, coverageMonths: 1 } } })
  data = applyFamilyAction(data, { kind: 'update-billing-arrangement', accountId, id: 'quarterly', schedule: changed })
  assert.equal(JSON.stringify(data.invoices), before)
  assert.equal(data.billingArrangements[0].revision, 1)
  const rows = previewBillingSchedule(changed, [piano])
  assert.equal(rows[0].selections[0].ranges[0].start, '2027-08-01')
  assert.equal(rows[0].selections[0].ranges[0].end, '2027-09-01')
  const next = applyFamilyAction(data, { kind: 'generate-billing-arrangement', accountId, id: 'quarterly', key: '0' })
  assert.match(next.invoices.at(-1).requestKey, /:1:0$/)
})
test('scheduled cancellation skips an inactive subscription while billing active siblings', () => {
  const arr = arrangement({ subscriptionIds: [piano, guitar] })
  let data = applyFamilyAction(createFamilyPreview(), request({ selections: [selection(piano, '2027-01'), selection(guitar, '2027-01')], arrangement: arr }))
  data = applyFamilyAction(data, { kind: 'subscription-state', accountId, enrollmentId: piano, state: 'cancelled' })
  data = applyFamilyAction(data, { kind: 'generate-billing-arrangement', accountId, id: arr.id, key: '0' })
  assert.equal(data.invoices.at(-1).lines.every(line => line.enrollmentId === guitar), true)
})
test('PDF and HTML preserve exact partial service dates and student attribution', () => {
  const { invoiceDocument, invoicePdf } = load('academy-invoice-document')
  const invoice = quoteFlexibleInvoice(createFamilyPreview(), request({ proration: 'calendar-days', selections: [{ subscriptionId: piano, ranges: [{ start: '2027-01-16', end: '2027-02-01' }] }] })).invoice
  assert.match(invoiceDocument(invoice), /2027-01-16 – 2027-01-31/)
  assert.match(invoicePdf(invoice), /2027-01-16/)
  assert.match(invoicePdf(invoice), /Sophie Kim/)
})
const { nextInvoicePeriods } = load('academy-invoice-composer')
const nextPeriods = (data, ids = [piano], months = 1, reservationId) => nextInvoicePeriods(data, data.accounts.find(item => item.id === accountId), ids, '2026-11-08', months, '2026-11-08T12:00:00Z', reservationId)
test('forward composer starts after settled service dates without replacing them', () => {
  for (const status of ['Paid', 'Refunded']) {
    const data = createFamilyPreview()
    data.invoices = [{ id: 'booked', accountId, status, date: '2026-10-01', due: '2026-11-01', payerId: '', payerName: '', lines: [{ enrollmentId: piano, studentId: 'preview:sophie-kim', studentName: 'Sophie', program: 'Piano', quantity: 1, unitMinor: 1, serviceStart: '2026-11-01', serviceEnd: '2026-12-01' }] }]
    const selections = nextPeriods(data, [piano], 3)
    assert.equal(selections[0].ranges[0].start, '2026-12-01')
    assert.equal(selections[0].ranges[0].end, '2027-03-01')
    const quoted = quoteFlexibleInvoice(data, request({ selections, proration: 'calendar-days' }))
    assert.equal(quoted.conflicts.length, 0)
    assert.ok(invoiceTotal(quoted.invoice) > 0)
  }
})
test('forward composer moves beyond an advance invoice inside a longer requested period', () => {
  const data = applyFamilyAction(createFamilyPreview(), request({ selections: [selection(piano, '2027-01')] }))
  const result = nextPeriods(data, [piano], 6)
  assert.equal(result[0].ranges[0].start, '2027-02-01')
  assert.equal(result[0].ranges[0].end, '2027-08-01')
  assert.equal(quoteFlexibleInvoice(data, request({ selections: result, proration: 'calendar-days' })).conflicts.length, 0)
})
test('forward composer skips another active reservation but preserves its own review period', () => {
  const data = createFamilyPreview()
  const initial = nextPeriods(data)
  data.billingDrafts = [{ id: 'other-review', accountId, selections: initial, expiresAt: '2026-11-09T12:00:00Z' }]
  assert.ok(nextPeriods(data)[0].ranges[0].start >= initial[0].ranges[0].end)
  assert.equal(JSON.stringify(nextPeriods(data, [piano], 1, 'other-review')), JSON.stringify(initial))
  data.billingDrafts[0].expiresAt = '2026-11-07T12:00:00Z'
  assert.equal(JSON.stringify(nextPeriods(data)), JSON.stringify(initial))
})
test('composer bills the full month despite mid-month subscription start', () => {
  const data = createFamilyPreview()
  data.invoices = []
  const enrollment = data.students.flatMap(student => student.enrollments).find(item => item.id === voice)
  enrollment.start = '2026-11-15'
  enrollment.monthlyQuantity = 4
  const selections = nextPeriods(data, [voice])
  assert.equal(selections[0].ranges[0].start, '2026-11-01')
  const november = quoteFlexibleInvoice(data, request({ selections, proration: 'whole-month', fullBillingMonths: true }))
  const december = quoteFlexibleInvoice(data, request({ selections: [selection(voice, '2026-12')], proration: 'whole-month', fullBillingMonths: true }))
  assert.equal(invoiceTotal(november.invoice), invoiceTotal(december.invoice))
  assert.ok(november.invoice.lines.every(line => !line.pricingBasis.includes('proration')))
  assert.equal(november.invoice.lines[0].serviceStart, '2026-11-01')
})

const { planInvoiceComposition } = load('academy-invoice-composer')
const { invoiceReplacementSnapshot, invoiceOutstanding } = load('academy-family-preview')
function novemberData(paidMinor = 0) {
  const data = createFamilyPreview()
  const enrollment = data.students.flatMap(student => student.enrollments).find(item => item.id === piano)
  enrollment.monthlyQuantity = 4
  data.invoices = [{ id: 'NOVEMBER', accountId, status: 'Open', date: '2026-11-01', due: '2026-11-01', payerId: '', payerName: '', paidMinor, lines: [{ enrollmentId: piano, studentId: 'preview:sophie-kim', studentName: 'Sophie Kim', program: 'Piano', quantity: 4, unitMinor: enrollment.amountMinor, serviceStart: '2026-11-01', serviceEnd: '2026-12-01', pricingBasis: 'Original monthly charge' }] }]
  return data
}
function replacementRequest(data, ids = [piano], months = 3) {
  const plan = planInvoiceComposition(data, data.accounts.find(item => item.id === accountId), ids, '2026-11-10', months, '2026-11-10T12:00:00Z')
  const action = request({ ...plan, date: '2026-11-10', due: '2026-11-10', proration: 'calendar-days' })
  if (plan.replacementInvoiceIds.length) action.expectedReplacement = invoiceReplacementSnapshot(data, action)
  return action
}
test('November 10 unpaid November invoice becomes November–January, without proration or cadence changes', () => {
  const data = novemberData(), before = JSON.stringify(data.students)
  const action = replacementRequest(data), quote = quoteFlexibleInvoice(data, action)
  assert.equal(action.selections[0].ranges[0].start, '2026-11-01')
  assert.equal(action.selections[0].ranges[0].end, '2027-02-01')
  assert.deepEqual([...action.replacementInvoiceIds], ['NOVEMBER'])
  assert.equal(quote.conflicts.length, 0)
  assert.equal(invoiceTotal(quote.invoice), invoiceTotal(data.invoices[0]) * 3)
  assert.ok(quote.invoice.lines.every(line => !line.pricingBasis?.includes('proration')))
  const result = applyFamilyAction(data, action)
  assert.equal(result.invoices[0].status, 'Replaced')
  assert.equal(result.invoices[0].replacedByInvoiceId, action.id)
  assert.equal(invoiceOutstanding(result.invoices[0]), 0)
  assert.equal(result.invoices[1].status, 'Open')
  assert.equal(JSON.stringify(result.students), before)
  assert.equal(result.billingArrangements, undefined)
  assert.equal(applyFamilyAction(result, action), result, 'Retry is idempotent')
  assert.equal(data.invoices[0].status, 'Open', 'Quote/commit do not mutate input')
})
test('paid November starts December–February without voiding, refunding or replacing payment', () => {
  const data = novemberData()
  data.invoices[0].status = 'Paid'
  const action = replacementRequest(data), result = applyFamilyAction(data, action)
  assert.equal(action.selections[0].ranges[0].start, '2026-12-01')
  assert.equal(action.selections[0].ranges[0].end, '2027-03-01')
  assert.equal(action.replacementInvoiceIds.length, 0)
  assert.equal(JSON.stringify(result.invoices[0]), JSON.stringify(data.invoices[0]))
})
test('partial payment follows the replacement as credit with original payment history retained', () => {
  const data = novemberData(1000), action = replacementRequest(data)
  const quote = quoteFlexibleInvoice(data, action)
  assert.equal(quote.invoice.paidMinor, 1000)
  const result = applyFamilyAction(data, action), invoice = result.invoices[1]
  assert.equal(invoiceOutstanding(invoice), invoiceTotal(invoice) - 1000)
  assert.equal(result.invoices[0].paidMinor, 1000)
  assert.equal(result.invoices[0].status, 'Replaced')
  assert.equal(invoice.sourceInvoiceIds[0], 'NOVEMBER')
})
test('replacement preserves unselected sibling lines and original rate snapshots', () => {
  const data = novemberData(1000)
  const original = data.invoices[0]
  original.lines[0].unitMinor = 1234
  original.lines.push({ ...original.lines[0], enrollmentId: guitar, studentId: 'preview:ethan-kim', studentName: 'Ethan Kim', program: 'Guitar', unitMinor: 7777 })
  const action = replacementRequest(data), quoted = quoteFlexibleInvoice(data, action)
  assert.equal(quoted.invoice.lines.find(line => line.sourceInvoiceId === 'NOVEMBER' && line.enrollmentId === piano).unitMinor, 1234)
  assert.equal(quoted.invoice.lines.filter(line => line.enrollmentId === guitar).length, 1)
  assert.equal(quoted.invoice.lines.find(line => line.enrollmentId === guitar).unitMinor, 7777)
  const result = applyFamilyAction(data, action)
  assert.equal(result.invoices.filter(item => item.status === 'Open').length, 1)
  assert.equal(result.invoices[1].paidMinor, 1000)
})
test('replacement rejects payment changes, settled sources, incomplete periods, foreign accounts and duplicate sources', () => {
  const data = novemberData(), action = replacementRequest(data)
  const changed = novemberData(1)
  assert.throws(() => applyFamilyAction(changed, action), /changed/)
  changed.invoices[0].status = 'Paid'
  assert.throws(() => applyFamilyAction(changed, action), /changed|paid/)
  assert.throws(() => quoteFlexibleInvoice(data, { ...action, replacementInvoiceIds: ['NOVEMBER', 'NOVEMBER'] }), /Duplicate/)
  assert.throws(() => quoteFlexibleInvoice(data, { ...action, selections: [selection(piano, '2026-12', 3)] }), /original invoice service periods/)
  const foreign = novemberData(); foreign.invoices[0].accountId = 'foreign'
  assert.throws(() => quoteFlexibleInvoice(foreign, action), /changed|paid/)
  assert.throws(() => applyFamilyAction(data, action, { role: 'parent' }), /Only staff/)
})
test('replacement review reservations prevent another admin replacing the same unpaid dates', () => {
  const data = novemberData(), action = replacementRequest(data)
  const expiresAt = new Date(Date.now() + 600000).toISOString()
  const reserved = applyFamilyAction(data, { kind: 'reserve-billing-draft', accountId, id: 'review-one', selections: action.selections, replacementInvoiceIds: action.replacementInvoiceIds, expiresAt })
  assert.equal(reserved.invoices[0].status, 'Open', 'Review does not replace anything')
  assert.throws(() => applyFamilyAction(reserved, { kind: 'reserve-billing-draft', accountId, id: 'review-two', selections: action.selections, replacementInvoiceIds: action.replacementInvoiceIds, expiresAt }), /reserved or invoiced/)
  const quoted = quoteFlexibleInvoice(reserved, { ...action, reservationId: 'review-one' })
  const result = applyFamilyAction(reserved, { ...action, reservationId: 'review-one', expectedLines: JSON.stringify(quoted.invoice.lines) })
  assert.equal(result.invoices[0].status, 'Replaced')
  assert.equal(result.billingDrafts.length, 0)
})
test('replacement cannot carry an unselected sibling charge through a foreign reservation', () => {
  const data = novemberData()
  data.invoices[0].lines.push({ ...data.invoices[0].lines[0], enrollmentId: guitar, program: 'Guitar' })
  const action = replacementRequest(data)
  data.billingDrafts = [{ id: 'sibling-review', accountId, selections: [selection(guitar, '2026-11')], expiresAt: new Date(Date.now() + 600000).toISOString() }]
  assert.throws(() => applyFamilyAction(data, action), /reserved or invoiced elsewhere/)
})


test('visible invoice lists hide replaced sources in every view and sort newest first, including ties', () => {
  const { visibleInvoiceHistory } = load('academy-invoice-document')
  const invoice = (id, date, status) => ({ id, date, status })
  const list = [invoice('old', '2026-10-01', 'Paid'), invoice('same-day-old', '2026-11-10', 'Open'), invoice('hidden', '2026-12-01', 'Replaced'), invoice('new', '2026-11-10', 'Open')]
  const before = JSON.stringify(list)
  assert.equal(visibleInvoiceHistory(list, 'all').map(item => item.id).join(','), 'new,same-day-old,old')
  assert.equal(visibleInvoiceHistory(list, 'unpaid').map(item => item.id).join(','), 'new,same-day-old')
  assert.equal(visibleInvoiceHistory(list, 'past').map(item => item.id).join(','), 'old')
  assert.equal(JSON.stringify(list), before)
})
test('full-month composer refuses partial ranges and rounds future starts to billing months', () => {
  const data = novemberData()
  const enrollment = data.students.flatMap(student => student.enrollments).find(item => item.id === voice)
  enrollment.start = '2027-02-15'
  assert.equal(nextPeriods(data, [voice])[0].ranges[0].start, '2027-02-01')
  assert.throws(() => quoteFlexibleInvoice(data, request({ fullBillingMonths: true, selections: [{ subscriptionId: piano, ranges: [{ start: '2027-01-05', end: '2027-02-01' }] }] })), /whole billing months/)
})
