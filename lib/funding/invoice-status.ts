export const INVOICE_STATUSES = ['draft', 'pending', 'overdue', 'rejected', 'paid'] as const

export type FundingInvoiceStatus = typeof INVOICE_STATUSES[number]

export const INVOICE_STATUS_LABELS: Record<FundingInvoiceStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  overdue: 'Overdue',
  rejected: 'Rejected',
  paid: 'Paid',
}

const TRANSITIONS: Record<FundingInvoiceStatus, readonly FundingInvoiceStatus[]> = {
  draft: ['pending'],
  pending: ['draft', 'overdue', 'rejected', 'paid'],
  overdue: ['pending', 'rejected', 'paid'],
  rejected: ['draft', 'pending'],
  paid: ['pending'],
}

export function isFundingInvoiceStatus(value: unknown): value is FundingInvoiceStatus {
  return typeof value === 'string' && INVOICE_STATUSES.includes(value as FundingInvoiceStatus)
}

export function getAllowedInvoiceStatuses(status: FundingInvoiceStatus) {
  return TRANSITIONS[status]
}

export function validateInvoiceStatusChange(input: {
  fromStatus: FundingInvoiceStatus
  toStatus: unknown
  evidence?: unknown
  paidOn?: unknown
}) {
  if (!isFundingInvoiceStatus(input.toStatus)) return 'Choose a valid invoice status.'
  if (input.fromStatus === input.toStatus) return 'The invoice already has that status.'
  if (!TRANSITIONS[input.fromStatus].includes(input.toStatus)) {
    return `Invoice cannot move from ${INVOICE_STATUS_LABELS[input.fromStatus]} to ${INVOICE_STATUS_LABELS[input.toStatus]}.`
  }
  const evidence = typeof input.evidence === 'string' ? input.evidence.trim() : ''
  if (input.toStatus === 'rejected' && !evidence) return 'Rejection evidence is required.'
  if (input.fromStatus === 'paid' && !evidence) return 'Evidence is required to reopen a paid invoice.'
  if (input.toStatus === 'paid' && (typeof input.paidOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn))) {
    return 'Paid date is required.'
  }
  return null
}