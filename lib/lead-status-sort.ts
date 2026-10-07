export const LEAD_STATUS_SORT_ORDER = ['won', 'processing', 'booked', 'contacted', 'new', 'lost', 'spam', 'ghosted_us']
export const APPLICATION_STATUS_SORT_ORDER = ['hired', 'offer_sent', 'audition_completed', 'audition_scheduled', 'contacted', 'new', 'rejected', 'withdrew', 'ghosted']
export const WINBACK_STATUS_SORT_ORDER = ['re_enrolled', 'interested', 'contacted', 'to_contact', 'closed']

export function getStatusSortOrder(tab: string): string[] {
  if (tab === 'job_application') return APPLICATION_STATUS_SORT_ORDER
  if (tab === 'winback') return WINBACK_STATUS_SORT_ORDER
  return LEAD_STATUS_SORT_ORDER
}

type StatusRow = { status: string; created_at: string; payload?: Record<string, unknown> | null }

export function compareLeadStatus(left: StatusRow, right: StatusRow, tab: string, direction: 'asc' | 'desc'): number {
  const order = getStatusSortOrder(tab)
  const rank = (row: StatusRow) => {
    const winback = row.payload?.winback as Record<string, unknown> | undefined
    const status = tab === 'winback' ? String(winback?.status || 'to_contact') : row.status
    const index = order.indexOf(status)
    return index < 0 ? order.length : index
  }
  const leftRank = rank(left)
  const rightRank = rank(right)
  // Unknown states stay at the end in either direction.
  if (leftRank === order.length && rightRank !== order.length) return 1
  if (rightRank === order.length && leftRank !== order.length) return -1
  const comparison = leftRank - rightRank
  if (comparison) return comparison * (direction === 'asc' ? 1 : -1)
  return Date.parse(right.created_at) - Date.parse(left.created_at)
}