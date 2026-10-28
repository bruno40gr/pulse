import { getFollowUpTone } from './follow-up'
import { formatPhoneNumber } from './phone'

type ActionRow = { status: string; created_at: string; follow_up_at?: string | null; payload?: Record<string, unknown> | null }
export function displayedLeadStatus(row: ActionRow, tab: string): string {
  const winback = row.payload?.winback
  return tab === 'winback' ? String((winback && typeof winback === 'object' ? (winback as Record<string, unknown>).status : null) || 'to_contact') : row.status
}
export function isTerminalLead(row: ActionRow, tab: string): boolean {
  const status = displayedLeadStatus(row, tab)
  return (tab === 'winback' ? ['re_enrolled', 'closed'] : tab === 'job_application' ? ['hired', 'rejected', 'withdrew', 'ghosted'] : ['lost', 'ghosted', 'ghosted_us', 'won', 'enrolled', 'spam']).includes(status)
}
export function compareLeadAction(left: ActionRow, right: ActionRow, tab: string, now = new Date()): number {
  const due = (row: ActionRow) => row.follow_up_at || (typeof row.payload?.follow_up_at === 'string' ? row.payload.follow_up_at : null)
  const rank = (row: ActionRow) => {
    if (isTerminalLead(row, tab)) return 5
    const urgency = getFollowUpTone(due(row), now).urgency
    if (urgency === 'overdue' || urgency === 'today') return 0
    const status = displayedLeadStatus(row, tab)
    return status === 'contacted' ? 1 : ['booked', 'interested', 'audition_scheduled'].includes(status) ? 2 : 3
  }
  const comparison = rank(left) - rank(right)
  if (comparison) return comparison
  if (rank(left) === 0) {
    const dates = Date.parse(due(left)!) - Date.parse(due(right)!)
    if (dates) return dates
  }
  return Date.parse(right.created_at) - Date.parse(left.created_at)
}
/** Table-only US display normalization; storage and international numbers are unchanged. */
export function leadTablePhone(value: string | null | undefined): string {
  return formatPhoneNumber(value).replace(/^\+1 (?=\()/, '')
}