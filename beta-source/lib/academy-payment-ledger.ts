import type { FamilyPreviewData } from './academy-family-preview'

/** Local simulation only. Attempts do not create invoices or imply provider charges. */
export type PaymentAttempt = {
  id: string; accountId: string; invoiceId: string; payerId: string; amountMinor: number
  outcome: 'failed' | 'succeeded'; recordedAt: string; method: string; reason?: string
}
export type PaymentReceipt = { id: string; attemptId: string; accountId: string; payerId: string; amountMinor: number; recordedAt: string; allocations: { invoiceId: string; amountMinor: number }[] }
export type PaymentRefund = { id: string; paymentId: string; invoiceId: string; amountMinor: number; reason: string; recordedAt: string }

export function recordPaymentAttempt(data: FamilyPreviewData, attempt: PaymentAttempt): FamilyPreviewData {
  const previous = data.paymentAttempts?.find(item => item.id === attempt.id)
  if (previous) {
    if (JSON.stringify(previous) !== JSON.stringify(attempt)) throw new Error('Payment attempt ID already has different details.')
    return data
  }
  const invoice = data.invoices.find(item => item.id === attempt.invoiceId && item.accountId === attempt.accountId)
  if (!attempt.id.trim() || !attempt.payerId.trim() || !attempt.method.trim() || !Number.isFinite(Date.parse(attempt.recordedAt)) || !['failed', 'succeeded'].includes(attempt.outcome) || (attempt.outcome === 'failed' && !attempt.reason?.trim())) throw new Error('Check payment attempt details.')
  if (!invoice || invoice.status !== 'Open' || invoice.voided) throw new Error('Choose an open invoice in this account.')
  const total = invoice.lines.reduce((sum, line) => sum + line.quantity * line.unitMinor, 0)
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(attempt.amountMinor) || attempt.amountMinor <= 0 || attempt.amountMinor > total - (invoice.paidMinor || 0)) throw new Error('Choose a valid outstanding payment amount.')
  const attempts = [...(data.paymentAttempts || []), { ...attempt }]
  if (attempt.outcome === 'failed') return { ...data, paymentAttempts: attempts }
  const paidMinor = (invoice.paidMinor || 0) + attempt.amountMinor
  const receipt: PaymentReceipt = { id: `payment:${attempt.id}`, attemptId: attempt.id, accountId: attempt.accountId, payerId: attempt.payerId, amountMinor: attempt.amountMinor, recordedAt: attempt.recordedAt, allocations: [{ invoiceId: invoice.id, amountMinor: attempt.amountMinor }] }
  return { ...data, paymentAttempts: attempts, payments: [...(data.payments || []), receipt], invoices: data.invoices.map(item => item.id === invoice.id ? { ...item, paidMinor, status: paidMinor === total ? 'Paid' : 'Open', paidById: attempt.payerId, paymentMethod: attempt.method } : item) }
}

export function recordPaymentRefund(data: FamilyPreviewData, refund: PaymentRefund): FamilyPreviewData {
  const previous = data.paymentRefunds?.find(item => item.id === refund.id)
  if (previous) {
    if (JSON.stringify(previous) !== JSON.stringify(refund)) throw new Error('Refund ID already has different details.')
    return data
  }
  const payment = data.payments?.find(item => item.id === refund.paymentId)
  const allocated = payment?.allocations.filter(item => item.invoiceId === refund.invoiceId).reduce((sum, item) => sum + item.amountMinor, 0) || 0
  const refunded = data.paymentRefunds?.filter(item => item.paymentId === refund.paymentId && item.invoiceId === refund.invoiceId).reduce((sum, item) => sum + item.amountMinor, 0) || 0
  if (!refund.id.trim() || !refund.reason.trim() || !Number.isFinite(Date.parse(refund.recordedAt)) || !Number.isSafeInteger(refund.amountMinor) || refund.amountMinor <= 0 || refund.amountMinor > allocated - refunded) throw new Error('Refund must reference an available recorded payment allocation.')
  return { ...data, paymentRefunds: [...(data.paymentRefunds || []), { ...refund }] }
}