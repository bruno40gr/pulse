export interface ContactFollowUpSummary {
  follow_up_at: string | null
  follow_up_note: string | null
  follow_up_count: number
}

/** Earliest open reminder drives table urgency; completed/cleared records do not. */
export function contactFollowUpSummary(rows: { due_at: string | null; message: string | null; status: string }[]): ContactFollowUpSummary {
  const open = rows.filter(row => row.status === 'open' && row.due_at && Number.isFinite(Date.parse(row.due_at)))
    .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!))
  return { follow_up_at: open[0]?.due_at ?? null, follow_up_note: open[0]?.message ?? null, follow_up_count: open.length }
}

export function matchesContactFollowUp(value: string | null | undefined, filter: string, now = new Date()): boolean {
  const due = value ? new Date(value) : null
  if (filter === 'none') return !due || !Number.isFinite(due.getTime())
  if (!due || !Number.isFinite(due.getTime())) return false
  if (filter === 'scheduled') return true
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const day = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()
  if (filter === 'overdue') return day < today
  if (filter === 'today') return day === today
  if (filter === 'upcoming') return day > today
  return false
}

/** Missing dates always sort last, in either direction. */
export function compareContactFollowUps(left?: string | null, right?: string | null, direction: 'asc' | 'desc' = 'asc') {
  const a = left ? Date.parse(left) : NaN, b = right ? Date.parse(right) : NaN
  if (!Number.isFinite(a)) return Number.isFinite(b) ? 1 : 0
  if (!Number.isFinite(b)) return -1
  return (a - b) * (direction === 'asc' ? 1 : -1)
}

/** Relationship reminder text is sortable independently; blanks stay last. */
export function compareContactFollowUpNotes(left?: string | null, right?: string | null, direction: 'asc' | 'desc' = 'asc') {
  const a = left?.trim() || '', b = right?.trim() || ''
  if (!a) return b ? 1 : 0
  if (!b) return -1
  const comparison = a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
  return comparison === 0 ? 0 : comparison * (direction === 'asc' ? 1 : -1)
}