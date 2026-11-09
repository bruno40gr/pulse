import { addBillingMonths, billingDate, monthCoverage, rangesOverlap, type BillingSelection } from './academy-billing'
import { accountStudents, invoiceLineRange, invoiceTotal, type FamilyPreviewData, type PreviewAccount } from './academy-family-preview'

/** Current unpaid invoices may be replaced; settled service periods stay booked. */
export function planInvoiceComposition(data: FamilyPreviewData, account: PreviewAccount, subscriptionIds: string[], today: string, months: number, now: string, reservationId?: string) {
  if (!billingDate(today)) throw new Error('Choose a valid invoice date.')
  const current = monthCoverage(today.slice(0, 7), 1)
  monthCoverage(today.slice(0, 7), months)
  const candidates = data.invoices.filter(invoice => invoice.accountId === account.id && invoice.status === 'Open' && !invoice.voided && (invoice.paidMinor || 0) < invoiceTotal(invoice) && invoice.lines.some(line => subscriptionIds.includes(line.enrollmentId) && rangesOverlap(invoiceLineRange(invoice, line), current)) && invoice.lines.filter(line => subscriptionIds.includes(line.enrollmentId)).every(line => { const range = invoiceLineRange(invoice, line); return range.start >= current.start && range.end <= current.end }))
  const replacementIds = candidates.map(invoice => invoice.id)
  const selections: BillingSelection[] = subscriptionIds.map(subscriptionId => {
    const enrollment = accountStudents(data, account).flatMap(student => student.enrollments).find(item => item.id === subscriptionId)
    if (!enrollment) throw new Error('Subscription unavailable in this account.')
    let start = enrollment.start.slice(0, 7) > today.slice(0, 7) ? `${enrollment.start.slice(0, 7)}-01` : current.start
    // An existing current-month invoice represents the full billed month, not today.
    if (candidates.some(invoice => invoice.lines.some(line => line.enrollmentId === subscriptionId))) start = current.start
    const booked = data.invoices.filter(invoice => invoice.accountId === account.id && !replacementIds.includes(invoice.id) && (invoice.status !== 'Replaced' || Boolean(invoice.voided)) && !invoice.voided?.releaseCoverage).flatMap(invoice => invoice.lines.filter(line => line.enrollmentId === subscriptionId).map(line => invoiceLineRange(invoice, line)))
    booked.push(...(data.billingDrafts || []).filter(draft => draft.accountId === account.id && draft.id !== reservationId && draft.expiresAt > now).flatMap(draft => draft.selections.filter(item => item.subscriptionId === subscriptionId).flatMap(item => item.ranges)))
    for (let attempt = 0; attempt <= booked.length; attempt++) {
      const end = addBillingMonths(`${start.slice(0, 7)}-01`, months)
      const overlaps = booked.filter(range => rangesOverlap(range, { start, end }))
      if (!overlaps.length) return { subscriptionId, ranges: [{ start, end }] }
      const after = overlaps.reduce((latest, range) => range.end > latest ? range.end : latest, start)
      start = after.endsWith('-01') ? after : addBillingMonths(`${after.slice(0, 7)}-01`, 1)
    }
    throw new Error('Could not find the next billing period. Refresh and try again.')
  })
  // Only replace sources actually included after advancing past reservations/paid dates.
  const replacementInvoiceIds = candidates.filter(invoice => invoice.lines.filter(line => subscriptionIds.includes(line.enrollmentId)).every(line => selections.some(item => item.subscriptionId === line.enrollmentId && item.ranges.some(range => range.start <= invoiceLineRange(invoice, line).start && range.end >= invoiceLineRange(invoice, line).end)))).map(invoice => invoice.id)
  return { selections, replacementInvoiceIds }
}

export function nextInvoicePeriods(...args: Parameters<typeof planInvoiceComposition>): BillingSelection[] { return planInvoiceComposition(...args).selections }
