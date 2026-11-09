import { createConnectedPreview, previewStudentName, type PreviewEnrollment, type PreviewStudent } from './academy-student-preview'
import { enrollmentGroupPrograms, enrollmentInstruments, enrollmentServices, enrollmentTeachers } from './academy-staff-enrollment'
import { availableScheduleTeachers } from './academy-enrollment-schedule'
import { validBirthday } from './lead-birthday'
import { billingDate, monthCoverage, previewBillingSchedule, priceBillingSegment, rangesOverlap, splitBillingMonths, subtractBillingCoverage, validateBillingRanges, validateBillingSchedule, type BillingArrangement, type BillingConflict, type BillingSelection } from './academy-billing'

/** Local, fictional account membership. It is not an authorization or canonical family model. */
export type PreviewAccount = { id: string; name: string; holderId: string; holderName: string; email: string; studentIds: string[]; dependentRelationships?: Record<string, string>; parentAddedStudentIds?: string[]; followUp?: { date: string; note: string }; studentFollowUps?: Record<string, { date: string; note: string } | undefined> }
export type PreviewCard = { id: string; accountId: string; payerId: string; cardholderName?: string; label: string; expires: string; isDefault: boolean }
export type PreviewInvoice = {
  requestKey?: string
  requestFingerprint?: string
  arrangementId?: string
  paidMinor?: number
  voided?: { reason: string; releaseCoverage: boolean }
  billTo?: string
  billingDetails?: string
  sourceInvoiceIds?: string[]
  replacedByInvoiceId?: string
  customFields?: { label: string; value: string }[]
  notes?: string
  refund?: { amountMinor: number; reason: string; date: string }
  id: string; accountId: string; payerId: string; payerName: string; paidById?: string; paidByName?: string; paymentMethod?: string; date: string; due: string; status: 'Paid' | 'Open' | 'Draft' | 'Refunded' | 'Replaced'
  lines: { enrollmentId: string; studentId: string; studentName: string; program: string; quantity: number; unitMinor: number; period?: string; sourceInvoiceId?: string; serviceStart?: string; serviceEnd?: string; pricingBasis?: string }[]
}
export type PreviewContact = { id: string; firstName: string; lastName: string; email: string; phone: string; birthday?: string; memberSince?: string }
export type FamilyPreviewData = ReturnType<typeof createConnectedPreview> & { contacts?: PreviewContact[]; accounts: PreviewAccount[]; cards: PreviewCard[]; invoices: PreviewInvoice[]; billingArrangements?: BillingArrangement[]; billingDrafts?: { id: string; accountId: string; selections: BillingSelection[]; expiresAt: string }[] }
export type FlexibleInvoiceRequest = { accountId: string; id: string; requestKey: string; selections: BillingSelection[]; payerId: string; billTo?: string; billingDetails?: string; date: string; due: string; proration: 'whole-month' | 'calendar-days'; arrangement?: BillingArrangement; reservationId?: string; expectedLines?: string; replacementInvoiceIds?: string[]; expectedReplacement?: string; fullBillingMonths?: boolean }
export type FamilyAction =
  | ({ kind: 'flexible-invoice' } & FlexibleInvoiceRequest)
  | { kind: 'billing-arrangement-state'; accountId: string; id: string; status: BillingArrangement['status'] }
  | { kind: 'update-billing-arrangement'; accountId: string; id: string; schedule: BillingArrangement['schedule'] }
  | { kind: 'generate-billing-arrangement'; accountId: string; id: string; key: string }
  | { kind: 'reserve-billing-draft'; accountId: string; id: string; selections: BillingSelection[]; expiresAt: string; replacementInvoiceIds?: string[] }
  | { kind: 'release-billing-draft'; accountId: string; id: string }
  | { kind: 'partial-invoice-payment'; accountId: string; invoiceId: string; amountMinor: number }
  | { kind: 'void-billing-invoice'; accountId: string; invoiceId: string; reason: string; releaseCoverage: boolean }
  | { kind: 'build-invoice'; accountId: string; id: string; studentId: string; enrollmentIds: string[]; periods: string[]; payerId?: string; billTo?: string; billingDetails?: string; date: string; due: string }
  | { kind: 'invoice-months'; accountId: string; id: string; enrollmentId: string; periods: string[]; quantity: number; date: string; due: string }
  | { kind: 'combine-invoices'; accountId: string; invoiceIds: string[]; id: string; date: string; due: string }
  | { kind: 'contact-batch'; accountId: string; contacts: PreviewContact[] }
  | { kind: 'dependent-relationship'; accountId: string; studentId: string; relationship: string }
  | { kind: 'contact-details'; accountId: string; contact: PreviewContact }
  | { kind: 'link-holder'; accountId: string; studentId: string; contact: PreviewContact; relationship: string }
  | { kind: 'unlink-child'; accountId: string; studentId: string; payerId?: string }
  | { kind: 'invoice-details'; accountId: string; invoiceId: string; customFields: NonNullable<PreviewInvoice['customFields']>; notes: string }
  | { kind: 'follow-up'; accountId: string; studentId?: string; followUp: PreviewAccount['followUp'] }
  | { kind: 'child'; accountId: string; id: string; firstName: string; lastName: string; email?: string; phone?: string; birthday?: string }
  | { kind: 'enrollment'; accountId: string; enrollment: PreviewEnrollment }
  | { kind: 'delete-enrollment'; accountId: string; enrollmentId: string }
  | { kind: 'subscription-state'; accountId: string; enrollmentId: string; state: 'active' | 'frozen' | 'cancelled' }
  | { kind: 'update-subscription'; accountId: string; enrollmentId: string; level: 1 | 2 | 3; duration: number }
  | { kind: 'payment'; accountId: string; enrollmentId: string; payerId: string; collection: string; cardId?: string }
  | { kind: 'refund-invoice'; accountId: string; invoiceId: string; reason: string }
  | { kind: 'pay-invoice'; accountId: string; invoiceId: string; payerId: string; cardId: string }
  | { kind: 'pay-invoices'; accountId: string; invoiceIds: string[]; payerId: string; cardId: string }
  | { kind: 'add-card'; accountId: string; payerId: string; id: string; preset: 'visa' | 'mastercard'; cardholderName?: string }
  | { kind: 'default-card' | 'remove-card'; accountId: string; cardId: string }
  | { kind: 'invoice'; accountId: string; id: string; enrollmentId: string; quantity: number; date: string; due: string; period?: string }

export function accountStudents(data: FamilyPreviewData, account: PreviewAccount) { return data.students.filter(student => account.studentIds.includes(student.id)) }

/** Coverage belongs to a subscription/month, not a payment or invoice issue date. */
export function invoiceMonthCoverage(data: FamilyPreviewData, enrollmentId: string, period: string) {
  const range = monthCoverage(period, 1)
  return data.invoices.filter(invoice => (invoice.status !== 'Replaced' || Boolean(invoice.voided)) && !invoice.voided?.releaseCoverage && invoice.lines.some(line => line.enrollmentId === enrollmentId && rangesOverlap(invoiceLineRange(invoice, line), range)))
}

export function invoiceLineRange(invoice: PreviewInvoice, line: PreviewInvoice['lines'][number]) {
  return line.serviceStart && line.serviceEnd ? { start: line.serviceStart, end: line.serviceEnd } : monthCoverage(line.period || invoice.due.slice(0, 7), 1)
}

/** Replacement is explicit and preserves every source line and payment record. */
export function invoiceReplacementSources(data: FamilyPreviewData, request: Pick<FlexibleInvoiceRequest, 'accountId' | 'replacementInvoiceIds' | 'selections'>) {
  const ids = request.replacementInvoiceIds || []
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate replacement invoice.')
  return ids.map(id => {
    const invoice = data.invoices.find(item => item.id === id && item.accountId === request.accountId)
    if (!invoice || invoice.status !== 'Open' || invoice.voided || !Number.isSafeInteger(invoice.paidMinor || 0) || (invoice.paidMinor || 0) < 0 || (invoice.paidMinor || 0) >= invoiceTotal(invoice)) throw new Error('The original invoice changed or was paid. Go back and review again.')
    const selected = invoice.lines.filter(line => request.selections.some(item => item.subscriptionId === line.enrollmentId))
    if (!selected.length || selected.some(line => !request.selections.some(item => item.subscriptionId === line.enrollmentId && item.ranges.some(range => range.start <= invoiceLineRange(invoice, line).start && range.end >= invoiceLineRange(invoice, line).end)))) throw new Error('Include the original invoice service periods in the replacement.')
    return invoice
  })
}
export function invoiceReplacementSnapshot(data: FamilyPreviewData, request: Pick<FlexibleInvoiceRequest, 'accountId' | 'replacementInvoiceIds' | 'selections'>) { return JSON.stringify(invoiceReplacementSources(data, request)) }

/** Preview adapter for the transport-independent ledger contracts. Existing issued
 * lines are immutable snapshots; settlement never changes their coverage. */
export function quoteFlexibleInvoice(data: FamilyPreviewData, request: FlexibleInvoiceRequest, now = new Date().toISOString()) {
  const account = data.accounts.find(item => item.id === request.accountId)
  if (!account || !request.id.trim() || !request.requestKey.trim() || !billingDate(request.date) || !billingDate(request.due) || request.due < request.date || !request.selections.length || new Set(request.selections.map(item => item.subscriptionId)).size !== request.selections.length || !['whole-month', 'calendar-days'].includes(request.proration)) throw new Error('Check subscriptions, service periods and invoice dates.')
  const payer = accountPayers(data, account).find(item => item.id === request.payerId)
  if (request.payerId && !payer) throw new Error('Choose a payer in this account.')
  if ((request.billTo || '').length > 200 || (request.billingDetails || '').length > 2000) throw new Error('Billing details are too long.')
  const sources = invoiceReplacementSources(data, request)
  const conflicts: BillingConflict[] = [], lines: PreviewInvoice['lines'] = []
  for (const selection of request.selections) {
    validateBillingRanges(selection.ranges)
    if (request.fullBillingMonths && (request.proration !== 'whole-month' || selection.ranges.some(range => !range.start.endsWith('-01') || !range.end.endsWith('-01')))) throw new Error('Choose whole billing months.')
    const student = accountStudents(data, account).find(item => item.enrollments.some(enrollment => enrollment.id === selection.subscriptionId))
    const enrollment = student?.enrollments.find(item => item.id === selection.subscriptionId)
    if (!student || !enrollment) throw new Error('Subscription unavailable in this account.')
    const coverage = data.invoices.filter(invoice => (invoice.status !== 'Replaced' || Boolean(invoice.voided)) && !invoice.voided?.releaseCoverage).flatMap(invoice => invoice.lines.filter(line => line.enrollmentId === enrollment.id).map(line => ({ ...invoiceLineRange(invoice, line), subscriptionId: enrollment.id, invoiceId: invoice.id, status: invoice.voided ? 'Voided · coverage retained' : invoice.status })))
    coverage.push(...(data.billingDrafts || []).filter(draft => draft.id !== request.reservationId && draft.expiresAt > now).flatMap(draft => draft.selections.filter(item => item.subscriptionId === enrollment.id).flatMap(item => item.ranges.map(range => ({ ...range, subscriptionId: enrollment.id, invoiceId: draft.id, status: 'Reserved draft' })))))
    for (const range of splitBillingMonths(selection.ranges)) {
      const matching = coverage.filter(item => rangesOverlap(item, range))
      conflicts.push(...matching)
      for (const uncovered of subtractBillingCoverage(range, matching)) {
        if (enrollment.status !== 'active' || enrollment.lifecycle || enrollment.frequency !== 'Weekly' || !enrollment.collection.startsWith('Monthly')) throw new Error(`${enrollment.program} is not an active monthly subscription.`)
        const start = !request.fullBillingMonths && uncovered.start < enrollment.start ? enrollment.start : uncovered.start
        if (start >= uncovered.end) continue
        const monthly = /per month|monthly/i.test(enrollment.priceUnit), quantity = monthly ? 1 : subscriptionMonthlyQuantity(data, enrollment)
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100 || !Number.isSafeInteger(enrollment.amountMinor) || enrollment.amountMinor < 0 || enrollment.currency !== 'USD') throw new Error('Check subscription pricing. This preview supports USD monthly subscriptions.')
        const priced = priceBillingSegment({ start, end: uncovered.end }, { quantity, unitMinor: enrollment.amountMinor, proration: request.proration })
        lines.push({ enrollmentId: enrollment.id, studentId: student.id, studentName: previewStudentName(student), program: enrollment.program, period: start.slice(0, 7), serviceStart: start, serviceEnd: uncovered.end, quantity: priced.quantity, unitMinor: priced.unitMinor, pricingBasis: priced.partial ? 'Calendar-day proration of configured monthly charge' : monthly ? 'Monthly subscription rate' : 'Configured monthly lesson quantity × current lesson rate' })
      }
    }
  }
  for (const source of sources) {
    for (const line of source.lines) {
      const range = invoiceLineRange(source, line)
      const otherInvoices = data.invoices.filter(invoice => invoice.accountId === account.id && !sources.some(item => item.id === invoice.id) && (invoice.status !== 'Replaced' || Boolean(invoice.voided)) && !invoice.voided?.releaseCoverage)
      for (const invoice of otherInvoices) for (const other of invoice.lines) if (other.enrollmentId === line.enrollmentId && rangesOverlap(range, invoiceLineRange(invoice, other))) conflicts.push({ ...invoiceLineRange(invoice, other), subscriptionId: line.enrollmentId, invoiceId: invoice.id, status: invoice.status })
      for (const draft of data.billingDrafts || []) if (draft.accountId === account.id && draft.id !== request.reservationId && draft.expiresAt > now) for (const selection of draft.selections) if (selection.subscriptionId === line.enrollmentId) for (const other of selection.ranges) if (rangesOverlap(range, other)) conflicts.push({ ...other, subscriptionId: line.enrollmentId, invoiceId: draft.id, status: 'Reserved draft' })
      lines.push({ ...line, serviceStart: range.start, serviceEnd: range.end, sourceInvoiceId: source.id })
    }
  }
  lines.sort((a, b) => (a.serviceStart || '').localeCompare(b.serviceStart || '') || a.studentName.localeCompare(b.studentName))
  const invoice: PreviewInvoice = { sourceInvoiceIds: sources.length ? sources.map(item => item.id) : undefined, paidMinor: sources.length ? sources.reduce((sum, item) => sum + (item.paidMinor || 0), 0) : undefined, id: request.id, accountId: account.id, payerId: payer?.id || '', payerName: payer?.name || '', billTo: request.billTo?.trim() || undefined, billingDetails: request.billingDetails?.trim() || undefined, date: request.date, due: request.due, status: 'Open', lines, requestKey: request.requestKey, requestFingerprint: flexibleInvoiceFingerprint(request), arrangementId: request.arrangement?.id }
  return { invoice, conflicts: conflicts.filter(item => !sources.some(source => source.id === item.invoiceId)).filter((item, index, remaining) => remaining.findIndex(other => other.invoiceId === item.invoiceId && other.subscriptionId === item.subscriptionId && other.start === item.start && other.end === item.end) === index) }
}
function flexibleInvoiceFingerprint(request: FlexibleInvoiceRequest) {
  return JSON.stringify({ accountId: request.accountId, payerId: request.payerId, selections: request.selections, date: request.date, due: request.due, billTo: request.billTo || '', billingDetails: request.billingDetails || '', proration: request.proration, arrangement: request.arrangement, replacementInvoiceIds: request.replacementInvoiceIds, expectedReplacement: request.expectedReplacement, fullBillingMonths: request.fullBillingMonths })
}

/** Monthly quantities belong to billing, not the number of weekdays in a month. */
export function subscriptionMonthlyQuantity(data: FamilyPreviewData, enrollment: PreviewEnrollment) {
  if (enrollment.monthlyQuantity !== undefined) return enrollment.monthlyQuantity
  const history = data.invoices.filter(invoice => invoice.status !== 'Replaced').sort((a, b) => b.date.localeCompare(a.date))
  const quantity = history.flatMap(invoice => invoice.lines).find(line => line.enrollmentId === enrollment.id)?.quantity
  if (!quantity) throw new Error(`Set the monthly billing quantity for ${enrollment.program}.`)
  return quantity
}

export function invoiceRecipient(invoice: PreviewInvoice) { return invoice.billTo || invoice.payerName }

export function invoiceCoverageLabel(invoice: PreviewInvoice) {
  const periods = [...new Set(invoice.lines.map(line => line.period).filter((period): period is string => Boolean(period)))].sort()
  return periods.map(period => new Date(`${period}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })).join(' · ')
}

/** The same calculation is used for review and commit; no draft mutates coverage. */
export function buildSubscriptionInvoice(data: FamilyPreviewData, action: Extract<FamilyAction, { kind: 'build-invoice' }>): PreviewInvoice {
  const account = data.accounts.find(item => item.id === action.accountId)
  const student = account && accountStudents(data, account).find(item => item.id === action.studentId)
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  if (!account || !student || !action.enrollmentIds.length || new Set(action.enrollmentIds).size !== action.enrollmentIds.length || !action.periods.length || action.periods.length > 24 || new Set(action.periods).size !== action.periods.length || action.periods.some(period => !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) || !validDate(action.date) || !validDate(action.due) || action.due < action.date || !action.id.trim() || action.id.startsWith('STATEMENT') || data.invoices.some(invoice => invoice.id === action.id)) throw new Error('Check the student, subscriptions, months and dates.')
  const payer = action.payerId ? accountPayers(data, account).find(item => item.id === action.payerId) : undefined
  if (action.payerId && !payer) throw new Error('Choose a payer in this account.')
  if ((action.billTo || '').length > 200 || (action.billingDetails || '').length > 2000) throw new Error('Billing details are too long.')
  const sources = new Map<string, PreviewInvoice>()
  const lines: PreviewInvoice['lines'] = []
  for (const enrollmentId of action.enrollmentIds) {
    const enrollment = student.enrollments.find(item => item.id === enrollmentId)
    if (!enrollment) throw new Error('Subscription unavailable.')
    for (const period of [...action.periods].sort()) {
      const coverage = invoiceMonthCoverage(data, enrollment.id, period)
      if (coverage.some(invoice => invoice.accountId !== account.id || invoice.status !== 'Open' || Boolean(invoice.paidMinor))) throw new Error(`${period} is already paid, refunded or reserved.`)
      if (coverage.length > 1) throw new Error(`${period} has overlapping invoices.`)
      if (coverage.length) {
        const source = coverage[0]
        if (source.lines.some(line => line.studentId !== student.id || !action.enrollmentIds.includes(line.enrollmentId) || !action.periods.includes(line.period || source.due.slice(0, 7)))) throw new Error(`Include all charges from ${source.id}.`)
        sources.set(source.id, source)
        lines.push(...source.lines.filter(line => line.enrollmentId === enrollment.id && (line.period || source.due.slice(0, 7)) === period).map(line => ({ ...line, period, sourceInvoiceId: line.sourceInvoiceId || source.id })))
      } else {
        if (enrollment.status !== 'active' || enrollment.lifecycle === 'frozen' || enrollment.lifecycle === 'cancelled' || enrollment.frequency !== 'Weekly' || !enrollment.collection.startsWith('Monthly') || period < enrollment.start.slice(0, 7)) throw new Error(`${enrollment.program} is not billed monthly for ${period}.`)
        const monthlyRate = /per month|monthly/i.test(enrollment.priceUnit)
        const quantity = monthlyRate ? 1 : subscriptionMonthlyQuantity(data, enrollment)
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100 || !Number.isSafeInteger(enrollment.amountMinor) || enrollment.amountMinor < 0 || enrollment.currency !== 'USD') throw new Error('Check subscription pricing.')
        lines.push({ enrollmentId, studentId: student.id, studentName: previewStudentName(student), program: enrollment.program, period, quantity: monthlyRate ? 1 : quantity, unitMinor: enrollment.amountMinor })
      }
    }
  }
  return { id: action.id, accountId: account.id, payerId: payer?.id || '', payerName: payer?.name || '', billTo: action.billTo?.trim() || undefined, billingDetails: action.billingDetails?.trim() || undefined, date: action.date, due: action.due, status: 'Open', lines, ...(sources.size ? { sourceInvoiceIds: [...sources.keys()], notes: [...sources.values()].map(source => [source.notes, ...(source.customFields || []).map(field => `${field.label}: ${field.value}`)].filter(Boolean).join('\n')).filter(Boolean).join('\n\n') } : {}) }
}

/** Shared preview issuance gate for manual and future scheduled billing. Never re-bill covered months. */
export function issueMonthlyInvoice(data: FamilyPreviewData, action: { accountId: string; id: string; enrollmentId: string; periods: string[]; quantity: number; date: string; due: string }, replaceUnpaid = false): FamilyPreviewData {
  const account = data.accounts.find(item => item.id === action.accountId)
  const student = account && accountStudents(data, account).find(item => item.enrollments.some(enrollment => enrollment.id === action.enrollmentId))
  const enrollment = student?.enrollments.find(item => item.id === action.enrollmentId)
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  if (!account || !student || !enrollment || !action.periods.length || action.periods.length > 24 || new Set(action.periods).size !== action.periods.length || action.periods.some(period => !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) || !Number.isInteger(action.quantity) || action.quantity < 1 || action.quantity > 10 || !validDate(action.date) || !validDate(action.due) || action.due < action.date || !action.id.trim() || action.id.startsWith('STATEMENT') || data.invoices.some(invoice => invoice.id === action.id)) throw new Error('Choose a subscription, unique months, 1–10 lessons per new month and valid invoice dates.')
  const payer = accountPayers(data, account).find(item => item.id === enrollment.payerId)
  if (!payer) throw new Error('Payer unavailable in this account.')
  const sources = new Map<string, PreviewInvoice>()
  const lines: PreviewInvoice['lines'] = []
  for (const period of [...action.periods].sort()) {
    const coverage = invoiceMonthCoverage(data, enrollment.id, period)
    if (coverage.length && !replaceUnpaid) throw new Error(`${period} is already invoiced. Skip it in scheduled billing or reuse its existing unpaid invoice.`)
    if (coverage.some(invoice => invoice.status !== 'Open' || Boolean(invoice.paidMinor))) throw new Error(`${period} is already paid, refunded or reserved. It cannot be billed again.`)
    for (const invoice of coverage) {
      if (invoice.accountId !== account.id || invoice.payerId !== payer.id) throw new Error('Existing coverage belongs to a different account or payer.')
      // Do not silently void unrelated months or siblings on a mixed invoice.
      if (invoice.lines.some(line => line.enrollmentId !== enrollment.id || !action.periods.includes(line.period || invoice.due.slice(0, 7)))) throw new Error('An existing invoice includes other charges. Select all its covered months or combine the full invoice instead.')
      sources.set(invoice.id, invoice)
    }
    if (coverage.length) {
      if (coverage.length > 1) throw new Error(`${period} has overlapping invoices. Resolve those duplicates before issuing.`)
      for (const line of coverage[0].lines.filter(line => line.enrollmentId === enrollment.id && (line.period || coverage[0].due.slice(0, 7)) === period)) lines.push({ ...line, period, sourceInvoiceId: line.sourceInvoiceId || coverage[0].id })
    } else lines.push({ enrollmentId: enrollment.id, studentId: student.id, studentName: previewStudentName(student), program: enrollment.program, quantity: action.quantity, unitMinor: enrollment.amountMinor, period })
  }
  const invoice: PreviewInvoice = { id: action.id, accountId: account.id, payerId: payer.id, payerName: payer.name, date: action.date, due: action.due, status: 'Open', lines, ...(sources.size ? { sourceInvoiceIds: [...sources.keys()], notes: [...sources.values()].map(source => [source.id, source.notes, ...(source.customFields || []).map(field => `${field.label}: ${field.value}`)].filter(Boolean).join('\n')).join('\n\n') } : {}) }
  return { ...data, invoices: [invoice, ...data.invoices.map(source => sources.has(source.id) ? { ...source, status: 'Replaced' as const, replacedByInvoiceId: invoice.id } : source)] }
}
export function accountPayers(data: FamilyPreviewData, account: PreviewAccount) {
  const students = accountStudents(data, account)
  const payers = new Map<string, { id: string; name: string }>()
  payers.set(account.holderId, { id: account.holderId, name: account.holderName })
  for (const student of students) {
    for (const person of student.family) if (!person.studentId) payers.set(person.id, { id: person.id, name: person.name })
    payers.set(student.id, { id: student.id, name: previewStudentName(student) })
  }
  return [...payers.values()]
}
export function invoiceTotal(invoice: PreviewInvoice) { return invoice.lines.reduce((total, line) => total + line.quantity * line.unitMinor, 0) }
export function invoiceOutstanding(invoice: PreviewInvoice) { return invoice.status === 'Open' ? Math.max(0, invoiceTotal(invoice) - (invoice.paidMinor || 0)) : 0 }

/** Scheduled billing date, not an outstanding invoice due date or a promise of a charge. */
export function nextPreviewPaymentDate(data: FamilyPreviewData, studentIds: string[], after: string): string | null {
  const dates = data.students.filter(student => studentIds.includes(student.id)).flatMap(student => student.enrollments.flatMap(enrollment => {
    if (enrollment.lifecycle || enrollment.status !== 'active') return []
    if (enrollment.collection === 'Monthly · 1st of the month') {
      const date = new Date(`${after}T12:00:00Z`)
      date.setUTCMonth(date.getUTCMonth() + 1, 1)
      while (date.toISOString().slice(0, 10) < enrollment.start) date.setUTCMonth(date.getUTCMonth() + 1, 1)
      return [date.toISOString().slice(0, 10)]
    }
    if (enrollment.collection !== 'Per lesson') return []
    return data.lessons.filter(lesson => lesson.enrollmentId === enrollment.id && lesson.status === 'Scheduled' && lesson.date > after).map(lesson => lesson.date)
  }))
  return dates.sort()[0] || null
}

/** Presentation scope only; keeps original account membership and payer identity intact. */
export function studentFamilyProjection(data: FamilyPreviewData, account: PreviewAccount, studentId: string): FamilyPreviewData {
  const students = accountStudents(data, account).filter(student => student.id === studentId)
  const enrollmentIds = new Set(students.flatMap(student => student.enrollments.map(item => item.id)))
  const invoices = data.invoices.filter(item => item.accountId === account.id && item.lines.some(line => line.studentId === studentId))
  const payerIds = new Set([...students.flatMap(student => student.enrollments.map(item => item.payerId)), ...invoices.map(item => item.payerId)])
  return { ...data, contacts: previewContacts(data), students, lessons: data.lessons.filter(item => enrollmentIds.has(item.enrollmentId)), invoices, cards: data.cards.filter(item => item.accountId === account.id && payerIds.has(item.payerId)) }
}
/** Explicit simulated guardian projection, including historical invoice ownership after deletion. */
export function parentFamilyProjection(data: FamilyPreviewData, account: PreviewAccount): FamilyPreviewData {
  const students = account.id === 'preview:kim' ? accountStudents(data, account).filter(student => ['preview:sophie', 'preview:ethan', ...(account.parentAddedStudentIds || [])].includes(student.id)) : []
  return { ...data, students,
    invoices: data.invoices.filter(invoice => account.id === 'preview:kim' && invoice.accountId === account.id && invoice.payerId === account.holderId && invoice.lines.every(line => students.some(student => student.id === line.studentId))),
    cards: data.cards.filter(card => account.id === 'preview:kim' && card.accountId === account.id && card.payerId === account.holderId),
  }
}
export function createFamilyPreview(): FamilyPreviewData {
  const data = createConnectedPreview()
  data.students = data.students.map(student => student.id === 'preview:sophie' ? { ...student, notes: [{ id: 'preview:sophie-practice', text: 'Practice the first eight bars slowly, then bring your questions to the next piano lesson.', timestamp: '2026-11-02T18:00:00Z', actor_id: 'preview:staff:jordan', actor_name: 'Jordan Vale', audience: 'family' as const }, ...student.notes] } : student)
  const accounts: PreviewAccount[] = [
    { id: 'preview:kim', name: 'Kim family', holderId: 'preview:sam-kim', holderName: 'Sam Kim', email: 'sam.kim@example.invalid', studentIds: ['preview:sophie', 'preview:ethan'] },
    { id: 'preview:alex-account', name: 'Alex Morgan', holderId: 'preview:alex', holderName: 'Alex Morgan', email: 'alex@example.invalid', studentIds: ['preview:alex'] },
    { id: 'preview:mia-account', name: 'Mia Chen', holderId: 'preview:mia', holderName: 'Mia Chen', email: 'mia@example.invalid', studentIds: ['preview:mia'] },
  ]
  const line = (id: string, quantity: number) => {
    const student = data.students.find(person => person.enrollments.some(item => item.id === id))!
    const enrollment = student.enrollments.find(item => item.id === id)!
    return { enrollmentId: id, studentId: student.id, studentName: previewStudentName(student), program: enrollment.program, quantity, unitMinor: enrollment.amountMinor }
  }
  return { ...data, accounts,
    cards: [
      { id: 'preview:visa', accountId: 'preview:kim', payerId: 'preview:sam-kim', label: 'Visa ···· 4242', expires: '12/2030', isDefault: true },
      { id: 'preview:sam-mc', accountId: 'preview:kim', payerId: 'preview:sam-kim', label: 'Mastercard ···· 4444', expires: '09/2029', isDefault: false },
      { id: 'preview:riley-visa', accountId: 'preview:kim', payerId: 'preview:riley-kim', label: 'Visa ···· 1881', expires: '03/2028', isDefault: true },
      { id: 'preview:riley-mc', accountId: 'preview:kim', payerId: 'preview:riley-kim', label: 'Mastercard ···· 0005', expires: '11/2027', isDefault: false },
    ],
    invoices: [
      { id: 'DEMO-1003', accountId: 'preview:kim', payerId: 'preview:sam-kim', payerName: 'Sam Kim', date: '2026-10-30', due: '2026-11-01', status: 'Open', lines: [line('preview:sophie-piano', 4)] },
      { id: 'DEMO-1004', accountId: 'preview:kim', payerId: 'preview:riley-kim', payerName: 'Riley Kim', date: '2026-10-31', due: '2026-11-15', status: 'Open', lines: [line('preview:ethan-guitar', 4)] },
      { id: 'DEMO-1002', accountId: 'preview:kim', payerId: 'preview:sam-kim', payerName: 'Sam Kim', date: '2026-10-01', due: '2026-10-01', status: 'Paid', lines: [line('preview:sophie-voice', 4)] },
      { id: 'DEMO-1001', accountId: 'preview:alex-account', payerId: 'preview:alex', payerName: 'Alex Morgan', date: '2026-10-30', due: '2026-11-01', status: 'Open', lines: [line('preview:alex-guitar', 4)] },
    ],
  }
}

/** Immutable, account-scoped demo mutations; invoice lines are historical snapshots. */
export function previewContacts(data: FamilyPreviewData): PreviewContact[] {
  const contacts = new Map<string, PreviewContact>()
  for (const student of data.students) {
    contacts.set(student.id, { id: student.id, firstName: student.firstName, lastName: student.lastName, email: student.email, phone: student.phone, birthday: student.birthday })
    for (const person of student.family) if (!contacts.has(person.id)) {
      const [firstName, ...last] = person.name.split(' ')
      contacts.set(person.id, { id: person.id, firstName, lastName: last.join(' '), email: person.email || '', phone: person.phone || '' })
    }
  }
  for (const account of data.accounts) if (!contacts.has(account.holderId)) {
    const [firstName, ...last] = account.holderName.split(' ')
    contacts.set(account.holderId, { id: account.holderId, firstName, lastName: last.join(' '), email: account.email, phone: '' })
  }
  for (const contact of data.contacts || []) contacts.set(contact.id, contact)
  return [...contacts.values()]
}

/** Role context is fictional preview policy, not production authorization. */
export function applyFamilyAction(data: FamilyPreviewData, action: FamilyAction, actor?: { role: 'admin' | 'staff' | 'parent'; holderId?: string }): FamilyPreviewData {
  const account = data.accounts.find(item => item.id === action.accountId)
  if (!account) throw new Error('Account unavailable.')
  if (['flexible-invoice', 'billing-arrangement-state', 'update-billing-arrangement', 'generate-billing-arrangement', 'reserve-billing-draft', 'release-billing-draft', 'partial-invoice-payment', 'void-billing-invoice'].includes(action.kind) && actor?.role === 'parent') throw new Error('Only staff can manage billing schedules and invoices.')
  if (action.kind === 'release-billing-draft') return { ...data, billingDrafts: (data.billingDrafts || []).filter(item => item.id !== action.id || item.accountId !== account.id) }
  if (action.kind === 'reserve-billing-draft') {
    const now = new Date().toISOString()
    if (data.billingDrafts?.some(item => item.id === action.id && item.accountId !== account.id)) throw new Error('Draft reservation belongs to another account.')
    if (!action.id.trim() || !Number.isFinite(Date.parse(action.expiresAt)) || action.expiresAt <= now || Date.parse(action.expiresAt) > Date.parse(now) + 30 * 60 * 1000) throw new Error('Draft reservations must expire within 30 minutes.')
    const quote = quoteFlexibleInvoice(data, { accountId: account.id, id: action.id, requestKey: action.id, payerId: '', date: now.slice(0, 10), due: now.slice(0, 10), selections: action.selections, proration: 'calendar-days', reservationId: action.id, replacementInvoiceIds: action.replacementInvoiceIds }, now)
    if (quote.conflicts.length) throw new Error(`Coverage is already reserved or invoiced: ${quote.conflicts.map(item => item.invoiceId).join(', ')}.`)
    if (!quote.invoice.lines.length) throw new Error('No eligible charges to reserve.')
    return { ...data, billingDrafts: [...(data.billingDrafts || []).filter(item => item.id !== action.id && item.expiresAt > now), { id: action.id, accountId: account.id, selections: action.selections, expiresAt: action.expiresAt }] }
  }
  if (action.kind === 'flexible-invoice') {
    const previous = data.invoices.find(item => item.accountId === account.id && item.requestKey === action.requestKey)
    if (previous) { if (previous.requestFingerprint !== flexibleInvoiceFingerprint(action)) throw new Error('This request key was already used with different invoice details.'); return data }
    if (data.invoices.some(item => item.id === action.id)) throw new Error('Invoice reference already exists.')
    if (action.replacementInvoiceIds?.length && action.expectedReplacement !== invoiceReplacementSnapshot(data, action)) throw new Error('The original invoice or payment changed. Go back and review again.')
    const { invoice, conflicts } = quoteFlexibleInvoice(data, action)
    if (action.replacementInvoiceIds?.length && conflicts.length) throw new Error('These service dates are reserved or invoiced elsewhere. Go back and review again.')
    if (!invoice.lines.length || invoiceTotal(invoice) <= 0) throw new Error('No uninvoiced charges remain in this selection.')
    if (action.expectedLines !== undefined && action.expectedLines !== JSON.stringify(invoice.lines)) throw new Error('Coverage or pricing changed. Go back and review the updated invoice.')
    if (action.arrangement) {
      const arrangement = action.arrangement
      if (arrangement.accountId !== account.id || arrangement.payerId !== action.payerId || !arrangement.id.trim() || (data.billingArrangements || []).some(item => item.id === arrangement.id) || arrangement.status !== 'active' || arrangement.generatedKeys.length || arrangement.proration !== action.proration || new Set(arrangement.subscriptionIds).size !== arrangement.subscriptionIds.length || arrangement.subscriptionIds.length !== action.selections.length || arrangement.subscriptionIds.some(id => !action.selections.some(item => item.subscriptionId === id))) throw new Error('Check the billing arrangement and selected subscriptions.')
      validateBillingSchedule(arrangement.schedule, arrangement.subscriptionIds)
    }
    return { ...data, invoices: [...data.invoices.map(item => action.replacementInvoiceIds?.includes(item.id) ? { ...item, status: 'Replaced' as const, replacedByInvoiceId: invoice.id } : item), invoice], billingDrafts: (data.billingDrafts || []).filter(item => item.id !== action.reservationId), billingArrangements: action.arrangement ? [...(data.billingArrangements || []), action.arrangement] : data.billingArrangements }
  }
  if (action.kind === 'billing-arrangement-state') {
    if (!(data.billingArrangements || []).some(item => item.id === action.id && item.accountId === account.id) || !['active', 'paused', 'cancelled'].includes(action.status)) throw new Error('Billing arrangement unavailable.')
    return { ...data, billingArrangements: data.billingArrangements!.map(item => item.id === action.id && item.accountId === account.id ? { ...item, status: action.status } : item) }
  }
  if (action.kind === 'update-billing-arrangement') {
    const arrangement = data.billingArrangements?.find(item => item.id === action.id && item.accountId === account.id && item.status !== 'cancelled')
    if (!arrangement) throw new Error('Billing arrangement unavailable.')
    validateBillingSchedule(action.schedule, arrangement.subscriptionIds)
    if (!previewBillingSchedule(action.schedule, arrangement.subscriptionIds).length) throw new Error('No invoices fit the schedule’s end conditions.')
    return { ...data, billingArrangements: data.billingArrangements!.map(item => item.id === arrangement.id ? { ...item, schedule: action.schedule, revision: (item.revision || 0) + 1, generatedKeys: [] } : item) }
  }
  if (action.kind === 'generate-billing-arrangement') {
    const arrangement = data.billingArrangements?.find(item => item.id === action.id && item.accountId === account.id)
    if (!arrangement || arrangement.status !== 'active') throw new Error('Billing arrangement is not active.')
    if (arrangement.generatedKeys.includes(action.key)) return data
    const row = previewBillingSchedule(arrangement.schedule, arrangement.subscriptionIds, 120).find(item => item.key === action.key)
    if (!row) throw new Error('Scheduled invoice unavailable.')
    const eligible = row.selections.filter(selection => accountStudents(data, account).some(student => student.enrollments.some(enrollment => enrollment.id === selection.subscriptionId && enrollment.status === 'active' && !enrollment.lifecycle)))
    if (!eligible.length) return { ...data, billingArrangements: data.billingArrangements!.map(item => item.id === arrangement.id ? { ...item, generatedKeys: [...item.generatedKeys, action.key] } : item) }
    const request: FlexibleInvoiceRequest = { accountId: account.id, id: `DEMO-${arrangement.id}-${arrangement.revision || 0}-${row.key}`, requestKey: `${arrangement.id}:${arrangement.revision || 0}:${row.key}`, selections: eligible, payerId: arrangement.payerId, billTo: arrangement.billTo, billingDetails: arrangement.billingDetails, date: row.issueDate, due: row.dueDate, proration: arrangement.proration, fullBillingMonths: arrangement.fullBillingMonths }
    const quoted = quoteFlexibleInvoice(data, request)
    const next = quoted.invoice.lines.length && invoiceTotal(quoted.invoice) > 0 ? applyFamilyAction(data, { ...request, kind: 'flexible-invoice' }, actor) : data
    return { ...next, invoices: next.invoices.map(item => item.requestKey === request.requestKey ? { ...item, arrangementId: arrangement.id } : item), billingArrangements: next.billingArrangements!.map(item => item.id === arrangement.id ? { ...item, generatedKeys: [...item.generatedKeys, action.key] } : item) }
  }
  if (action.kind === 'partial-invoice-payment') {
    const invoice = data.invoices.find(item => item.id === action.invoiceId && item.accountId === account.id && item.status === 'Open' && !item.voided)
    if (!invoice || !Number.isSafeInteger(action.amountMinor) || action.amountMinor <= 0 || action.amountMinor > invoiceTotal(invoice) - (invoice.paidMinor || 0)) throw new Error('Choose a valid outstanding payment amount.')
    const paidMinor = (invoice.paidMinor || 0) + action.amountMinor
    return { ...data, invoices: data.invoices.map(item => item.id === invoice.id ? { ...item, paidMinor, status: paidMinor === invoiceTotal(invoice) ? 'Paid' : 'Open' } : item) }
  }
  if (action.kind === 'void-billing-invoice') {
    const invoice = data.invoices.find(item => item.id === action.invoiceId && item.accountId === account.id && item.status === 'Open' && !item.voided)
    if (!invoice || !action.reason.trim() || invoice.paidMinor) throw new Error('Only wholly unpaid invoices may be voided in this preview. Enter a reason.')
    return { ...data, invoices: data.invoices.map(item => item.id === invoice.id ? { ...item, status: 'Replaced', voided: { reason: action.reason.trim(), releaseCoverage: action.releaseCoverage } } : item) }
  }
  if (action.kind === 'contact-batch') {
    // Fold immutably before committing: an invalid contact must not partially save the form.
    return action.contacts.reduce((current, contact) => applyFamilyAction(current, { kind: 'contact-details', accountId: action.accountId, contact }, actor), data)
  }
  if (action.kind === 'dependent-relationship') {
    if (!account.studentIds.includes(action.studentId) || action.studentId === account.holderId || !data.students.some(student => student.id === action.studentId)) throw new Error('Dependent unavailable in this account.')
    if (actor?.role === 'parent' && actor.holderId !== account.holderId) throw new Error('Family group action unavailable.')
    if (!['Child', 'Spouse', 'Sibling', 'Other'].includes(action.relationship)) throw new Error('Choose a relationship.')
    return { ...data, accounts: data.accounts.map(item => item.id === account.id ? { ...item, dependentRelationships: { ...item.dependentRelationships, [action.studentId]: action.relationship } } : item) }
  }
  if (action.kind === 'contact-details' || action.kind === 'link-holder') {
    const contact = { ...action.contact, firstName: action.contact.firstName.trim(), lastName: action.contact.lastName.trim(), email: action.contact.email.trim(), phone: action.contact.phone.trim() }
    if (!contact.id || !contact.firstName || !contact.lastName || (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) || (contact.birthday && !validBirthday(contact.birthday))) throw new Error('Check the contact name, email and birthday.')
    const name = `${contact.firstName} ${contact.lastName}`
    if (action.kind === 'contact-details') {
      if (![account.holderId, ...account.studentIds].includes(contact.id)) throw new Error('Contact unavailable in this account.')
      return { ...data, contacts: [...(data.contacts || []).filter(item => item.id !== contact.id), contact], accounts: data.accounts.map(item => item.holderId === contact.id ? { ...item, holderName: name, email: contact.email } : item), students: data.students.map(student => ({ ...student, ...(student.id === contact.id ? contact : {}), family: student.family.map(person => person.id === contact.id ? { ...person, name, email: contact.email, phone: contact.phone } : person) })) }
    }
    if (actor?.role !== 'admin') throw new Error('Only admins can manage relationships.')
    const student = data.students.find(item => item.id === action.studentId && account.studentIds.includes(item.id))
    if (!student || account.holderId !== student.id || account.studentIds.length !== 1 || data.cards.some(card => card.accountId === account.id)) throw new Error('Use the existing account relationship; resolve saved cards before replacing a holder.')
    if (!action.relationship.trim()) throw new Error('Choose a relationship.')
    const existing = previewContacts(data).find(item => item.id === contact.id)
    if (existing && (['firstName', 'lastName', 'email', 'phone', 'birthday'] as const).some(key => (existing[key] || '') !== (contact[key] || ''))) throw new Error('Select the existing contact without changing their details.')
    if (!existing && previewContacts(data).some(item => (contact.email && item.email.toLowerCase() === contact.email.toLowerCase()) || `${item.firstName} ${item.lastName}`.toLowerCase() === name.toLowerCase())) throw new Error('A matching contact already exists. Select the existing contact.')
    return { ...data, contacts: existing ? data.contacts : [...(data.contacts || []), contact], accounts: data.accounts.map(item => item.id === account.id ? { ...item, holderId: contact.id, holderName: name, email: contact.email } : item), students: data.students.map(item => item.id === student.id ? { ...item, family: [...item.family.filter(person => person.id !== contact.id), { id: contact.id, name, email: contact.email, phone: contact.phone, relationship: action.relationship.trim() }] } : item) }
  }
  if (action.kind === 'unlink-child') {
    const parentCanRemove = actor?.role === 'parent' && actor.holderId === account.holderId && parentFamilyProjection(data, account).students.some(student => student.id === action.studentId) && (!action.payerId || action.payerId === action.studentId)
    if (actor?.role !== 'admin' && !parentCanRemove) throw new Error('Only admins or the scoped family holder can remove this relationship.')
    const student = data.students.find(item => item.id === action.studentId && account.studentIds.includes(item.id))
    if (!student || student.id === account.holderId) throw new Error('Child unavailable.')
    const payerId = action.payerId || student.id
    const payer = previewContacts(data).find(person => person.id === payerId)
    if (!payer || payer.id === account.holderId) throw new Error('Choose the student or another contact as the future payer.')
    const id = `preview:unlinked:${student.id}`
    if (data.accounts.some(item => item.id === id)) throw new Error('Student already has a standalone account.')
    const payerName = `${payer.firstName} ${payer.lastName}`
    // Unpaid student debt follows the student, not the previous household.
    // Mixed invoices are allocated by their existing lines; never move a sibling's debt.
    const invoices = data.invoices.flatMap(invoice => {
      if (invoice.accountId !== account.id || !invoice.lines.some(line => line.studentId === student.id)) return [invoice]
      const own = invoice.lines.filter(line => line.studentId === student.id)
      const remaining = invoice.lines.filter(line => line.studentId !== student.id)
      if (!remaining.length) return [{ ...invoice, accountId: id, ...(invoice.status !== 'Paid' && invoice.status !== 'Refunded' && invoice.status !== 'Replaced' ? { payerId, payerName } : {}) }]
      if (invoice.status === 'Paid' || invoice.status === 'Refunded' || invoice.status === 'Replaced') return [invoice]
      const allocatedId = `${invoice.id}:${student.id}`
      if (data.invoices.some(item => item.id === allocatedId)) throw new Error('An allocated student invoice already exists.')
      return [{ ...invoice, lines: remaining }, { ...invoice, id: allocatedId, accountId: id, payerId, payerName, lines: own }]
    })
    return { ...data, invoices, accounts: [...data.accounts.map(item => item.id === account.id ? { ...item, studentIds: item.studentIds.filter(id => id !== student.id) } : item), { id, name: previewStudentName(student), holderId: student.id, holderName: previewStudentName(student), email: student.email, studentIds: [student.id] }], students: data.students.map(item => item.id === student.id ? { ...item, family: payer.id === student.id ? [] : [{ id: payer.id, name: payerName, email: payer.email, phone: payer.phone, relationship: 'Payer' }], communicationContactId: student.id, enrollments: item.enrollments.map(enrollment => ({ ...enrollment, payerId, paymentMethod: '' })) } : { ...item, family: item.family.filter(person => person.id !== student.id) }) }

  }
  if (action.kind === 'follow-up') {
    if (action.studentId && !account.studentIds.includes(action.studentId)) throw new Error('Student unavailable.')
    if (action.followUp && (!/^\d{4}-\d{2}-\d{2}$/.test(action.followUp.date) || !Number.isFinite(Date.parse(`${action.followUp.date}T12:00:00Z`)))) throw new Error('Choose a follow-up date.')
    const followUp = action.followUp && { ...action.followUp, note: action.followUp.note.trim() }
    return { ...data, accounts: data.accounts.map(item => item.id === account.id ? action.studentId ? { ...item, studentFollowUps: { ...item.studentFollowUps, [action.studentId]: followUp } } : { ...item, followUp } : item) }
  }
  const students = accountStudents(data, account)
  const enrollment = 'enrollmentId' in action ? students.flatMap(student => student.enrollments).find(item => item.id === action.enrollmentId) : undefined
  const payer = 'payerId' in action ? accountPayers(data, account).find(item => item.id === action.payerId) : undefined
  const updateEnrollment = (id: string, patch: Partial<PreviewEnrollment>) => ({ ...data, students: data.students.map(student => ({ ...student, enrollments: student.enrollments.map(item => item.id === id ? { ...item, ...patch } : item) })) })
  switch (action.kind) {
    case 'invoice-details': {
      if (!data.invoices.some(invoice => invoice.id === action.invoiceId && invoice.accountId === account.id)) throw new Error('Invoice unavailable.')
      const customFields = action.customFields.map(field => ({ label: field.label.trim(), value: field.value.trim() }))
      if (customFields.some(field => !field.label || !field.value)) throw new Error('Enter a label and value for each custom field.')
      return { ...data, invoices: data.invoices.map(invoice => invoice.id === action.invoiceId && invoice.accountId === account.id ? { ...invoice, customFields, notes: action.notes.trim() } : invoice) }
    }
    case 'subscription-state':
      if (!enrollment || enrollment.lifecycle === 'cancelled' || !['active', 'frozen', 'cancelled'].includes(action.state)) throw new Error('Subscription unavailable for this change.')
      return updateEnrollment(enrollment.id, { lifecycle: action.state === 'active' ? undefined : action.state })
    case 'update-subscription':
      if (!enrollment || enrollment.lifecycle === 'cancelled' || ![1, 2, 3].includes(action.level) || ![30, 45, 60].includes(action.duration)) throw new Error('Check subscription level and duration.')
      return updateEnrollment(enrollment.id, { level: action.level, duration: action.duration })
    case 'child': {
      if (!action.firstName.trim() || !action.lastName.trim() || !action.id.startsWith('preview:') || data.students.some(student => student.id === action.id)) throw new Error('Enter a first and last name for a new child.')
      if (action.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(action.email.trim())) throw new Error('Check the child’s email address.')
      if (action.birthday && !validBirthday(action.birthday)) throw new Error('Enter a valid birthday, not a future date.')
      const child: PreviewStudent = { id: action.id, firstName: action.firstName.trim(), lastName: action.lastName.trim(), email: action.email?.trim() || '', phone: action.phone?.trim() || '', family: [{ id: account.holderId, name: account.holderName, email: account.email, relationship: 'Parent / guardian' }], communicationContactId: account.holderId, enrollments: [], notes: [], messages: [] }
      return { ...data, students: [...data.students, { ...child, birthday: action.birthday || '' }], accounts: data.accounts.map(item => item.id === account.id ? { ...item, studentIds: [...item.studentIds, child.id] } : item) }
    }
    case 'enrollment': {
      const item = action.enrollment
      if (item.monthlyQuantity !== undefined && (!Number.isSafeInteger(item.monthlyQuantity) || item.monthlyQuantity < 1 || item.monthlyQuantity > 100)) throw new Error('Check lessons billed per month.')
      if (![1, 2, 3].includes(item.level)) throw new Error('Choose Level 1, 2 or 3.')
      if (!students.some(student => student.id === item.studentId) || !accountPayers(data, account).some(p => p.id === item.payerId) || data.students.some(student => student.enrollments.some(e => e.id === item.id))) throw new Error('Choose a student and payer in this account.')
      if (!(item.service === 'Group' ? enrollmentGroupPrograms : enrollmentInstruments).some(program => program === item.program) || !enrollmentServices.some(service => service === item.service) || !enrollmentTeachers.some(teacher => teacher === item.teacher) || ![30, 45, 60].includes(item.duration) || !['Weekly', 'One-off'].includes(item.frequency) || !Number.isSafeInteger(item.amountMinor) || item.amountMinor < 0 || item.currency !== 'USD' || !/^2026-11-\d{2}$/.test(item.start) || !['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'].includes(item.start) || !/^(14|15|16|17|18):(00|15|30|45)$/.test(item.time)) throw new Error('Check the lesson details, sample date, time and price.')
      if (item.service === 'Group' && !availableScheduleTeachers({ ...item, service: 'Group', instrument: item.program, duration: String(item.duration) }, item.start, item.time, null, []).some(teacher => teacher.name === item.teacher)) throw new Error('Choose a scheduled sample group session.')
      const day = new Date(`${item.start}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
      const date = new Date(`${item.start}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 7)
      const dates = [item.start, ...(item.frequency === 'Weekly' && date.toISOString().slice(0, 10) <= '2026-11-13' ? [date.toISOString().slice(0, 10)] : [])]
      return { ...data, students: data.students.map(student => student.id === item.studentId ? { ...student, enrollments: [...student.enrollments, { ...item, day }] } : student), lessons: [...data.lessons, ...dates.map((date, index) => ({ id: `${item.id}:lesson:${index}`, enrollmentId: item.id, date, time: item.time, room: 'Studio preview', status: 'Scheduled' }))] }
    }
    case 'delete-enrollment':
      if (!enrollment) throw new Error('Enrollment unavailable in this account.')
      return { ...data, students: data.students.map(student => ({ ...student, enrollments: student.enrollments.filter(item => item.id !== enrollment.id) })), lessons: data.lessons.filter(item => item.enrollmentId !== enrollment.id) }
    case 'payment': {
      if (!enrollment || !payer || !['Monthly · 1st of the month', 'Per lesson'].includes(action.collection)) throw new Error('Choose an enrollment, payer and billing frequency in this account.')
      const card = action.cardId ? data.cards.find(item => item.id === action.cardId && item.accountId === account.id && item.payerId === payer.id) : data.cards.find(item => item.accountId === account.id && item.payerId === payer.id && item.isDefault)
      if (action.cardId && !card) throw new Error('Choose a card on file for this payer.')
      return updateEnrollment(enrollment.id, { payerId: payer.id, collection: action.collection, paymentMethod: card?.label || 'Not added' })
    }
    case 'combine-invoices': {
      if (actor?.role === 'parent') throw new Error('Only staff can combine invoices.')
      const ids = new Set(action.invoiceIds)
      const invoices = data.invoices.filter(invoice => invoice.accountId === account.id && ids.has(invoice.id))
      if (ids.size < 2 || ids.size !== action.invoiceIds.length || invoices.length !== ids.size || invoices.some(invoice => invoice.status !== 'Open' || invoice.paidMinor || invoice.replacedByInvoiceId || invoice.id.startsWith('STATEMENT'))) throw new Error('Choose at least two unique unpaid invoices from this account.')
      if (new Set(invoices.map(invoice => invoice.payerId)).size !== 1) throw new Error('Combined invoices must have the same payer.')
      const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
      if (!validDate(action.date) || !validDate(action.due) || action.due < action.date) throw new Error('Choose a valid issue date and a due date on or after it.')
      if (!action.id.trim() || action.id.startsWith('STATEMENT') || data.invoices.some(invoice => invoice.id === action.id)) throw new Error('Choose a unique invoice number.')
      const combined: PreviewInvoice = { id: action.id, accountId: account.id, payerId: invoices[0].payerId, payerName: invoices[0].payerName, date: action.date, due: action.due, status: 'Open', sourceInvoiceIds: invoices.map(invoice => invoice.id), lines: invoices.flatMap(invoice => invoice.lines.map(line => ({ ...line, period: line.period || invoice.due.slice(0, 7), sourceInvoiceId: line.sourceInvoiceId || invoice.id }))), notes: invoices.map(invoice => [invoice.id, invoice.notes, ...(invoice.customFields || []).map(field => `${field.label}: ${field.value}`)].filter(Boolean).join('\n')).join('\n\n') }
      return { ...data, invoices: [combined, ...data.invoices.map(invoice => ids.has(invoice.id) ? { ...invoice, status: 'Replaced' as const, replacedByInvoiceId: combined.id } : invoice)] }
    }
    case 'refund-invoice': {
      if (actor?.role === 'parent') throw new Error('Only staff can issue refunds.')
      const invoice = data.invoices.find(item => item.id === action.invoiceId && item.accountId === account.id)
      if (!invoice || invoice.status !== 'Paid' || invoice.refund || invoice.id.startsWith('STATEMENT')) throw new Error('Only a paid invoice can be refunded once.')
      const reason = action.reason.trim()
      if (!reason || reason.length > 1000 || invoiceTotal(invoice) <= 0) throw new Error('Enter a refund reason of 1–1000 characters for a paid amount.')
      return { ...data, invoices: data.invoices.map(item => item.id === invoice.id ? { ...item, status: 'Refunded', refund: { amountMinor: invoiceTotal(invoice), reason, date: new Date().toISOString().slice(0, 10) } } : item) }
    }
    case 'pay-invoice': {
      const invoice = data.invoices.find(item => item.id === action.invoiceId && item.accountId === account.id)
      if (!invoice || invoice.status !== 'Open') throw new Error('This invoice is not open.')
      const card = data.cards.find(item => item.id === action.cardId && item.accountId === account.id && item.payerId === action.payerId)
      if (!payer || !card) throw new Error('Choose a payer and a card on file.')
      return { ...data, invoices: data.invoices.map(item => item.id === invoice.id ? { ...item, status: 'Paid', paidById: payer.id, paidByName: payer.name, paymentMethod: card.label } : item) }
    }
    case 'pay-invoices': {
      const ids = new Set(action.invoiceIds)
      if (!ids.size || ids.size !== action.invoiceIds.length) throw new Error('Choose unique open invoices.')
      const invoices = data.invoices.filter(item => ids.has(item.id) && item.accountId === account.id)
      if (invoices.length !== ids.size || invoices.some(item => item.status !== 'Open')) throw new Error('Every selected invoice must be open and belong to this account.')
      const card = data.cards.find(item => item.id === action.cardId && item.accountId === account.id && item.payerId === action.payerId)
      if (!payer || !card) throw new Error('Choose a payer and a card on file.')
      return { ...data, invoices: data.invoices.map(item => ids.has(item.id) ? { ...item, status: 'Paid', paidById: payer.id, paidByName: payer.name, paymentMethod: card.label } : item) }
    }
    case 'add-card': {
      if (!payer || !action.id.startsWith('preview:') || data.cards.some(card => card.id === action.id) || !['visa', 'mastercard'].includes(action.preset)) throw new Error('Choose a payer and fictional card.')
      const cardholderName = (action.cardholderName ?? payer.name).trim()
      if (!cardholderName || cardholderName.length > 120) throw new Error('Enter the name on the card (up to 120 characters).')
      const card: PreviewCard = { id: action.id, accountId: account.id, payerId: payer.id, cardholderName, label: action.preset === 'visa' ? 'Visa ···· 4242' : 'Mastercard ···· 4444', expires: '12/2030', isDefault: !data.cards.some(card => card.accountId === account.id && card.payerId === payer.id) }
      const next = { ...data, cards: [...data.cards, card] }
      return card.isDefault ? syncCards(next) : next
    }
    case 'default-card':
    case 'remove-card': {
      const card = data.cards.find(item => item.id === action.cardId && item.accountId === account.id)
      if (!card) throw new Error('Card unavailable in this account.')
      let cards = action.kind === 'default-card' ? data.cards.map(item => item.accountId === account.id && item.payerId === card.payerId ? { ...item, isDefault: item.id === card.id } : item) : data.cards.filter(item => item.id !== card.id)
      if (action.kind === 'remove-card' && card.isDefault) {
        const next = cards.find(item => item.accountId === account.id && item.payerId === card.payerId)
        cards = cards.map(item => item.id === next?.id ? { ...item, isDefault: true } : item)
      }
      return syncCards({ ...data, cards })
    }
    case 'build-invoice': {
      if (actor?.role === 'parent') throw new Error('Only staff can issue invoices.')
      const invoice = buildSubscriptionInvoice(data, action)
      return { ...data, invoices: [...data.invoices.map(item => invoice.sourceInvoiceIds?.includes(item.id) ? { ...item, status: 'Replaced' as const, replacedByInvoiceId: invoice.id } : item), invoice] }
    }
    case 'invoice-months':
      if (actor?.role === 'parent') throw new Error('Only staff can issue invoices.')
      return issueMonthlyInvoice(data, action, true)
    case 'invoice':
      if (actor?.role === 'parent') throw new Error('Only staff can issue invoices.')
      return issueMonthlyInvoice(data, { ...action, periods: [action.period || action.due.slice(0, 7)] })
  }
}

function syncCards(data: FamilyPreviewData): FamilyPreviewData {
  return { ...data, students: data.students.map(student => ({ ...student, enrollments: student.enrollments.map(item => ({ ...item, paymentMethod: data.cards.find(card => data.accounts.find(account => account.id === card.accountId)?.studentIds.includes(student.id) && card.payerId === item.payerId && card.isDefault)?.label || 'Not added' })) })) }
}