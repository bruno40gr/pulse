export const MESSAGE_STATUS_RANK: Record<string, number> = {
  queued: 10,
  accepted: 20,
  scheduled: 20,
  sending: 30,
  sent: 40,
  delivered: 50,
  read: 60,
  undelivered: 90,
  failed: 90,
  canceled: 90,
}

export function shouldAdvanceMessageStatus(current: string | null | undefined, next: string): boolean {
  const normalizedCurrent = (current || '').toLowerCase()
  const normalizedNext = next.toLowerCase()
  if (!normalizedNext || normalizedCurrent === normalizedNext) return false
  const currentRank = MESSAGE_STATUS_RANK[normalizedCurrent] ?? 0
  const nextRank = MESSAGE_STATUS_RANK[normalizedNext] ?? 0
  if (currentRank >= 90) return false
  if (nextRank >= 90) return true
  return nextRank >= currentRank
}

export function displayMessageStatus(status: string | null | undefined): string {
  switch ((status || '').toLowerCase()) {
    case 'queued': return 'Queued'
    case 'accepted':
    case 'scheduled':
    case 'sending':
    case 'sent': return 'Sent'
    case 'delivered': return 'Delivered'
    case 'read': return 'Read'
    case 'undelivered': return 'Not delivered'
    case 'failed': return 'Failed'
    case 'canceled': return 'Canceled'
    default: return status || ''
  }
}