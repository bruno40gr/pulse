/** Source-independent default: manual and website inquiries are newest first. */
export function compareNewestLead(left: { created_at: string }, right: { created_at: string }) {
  const time = (value: string) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0
  return time(right.created_at) - time(left.created_at)
}

export const NEW_LEAD_WINDOW_MS = 24 * 60 * 60 * 1000
export const NEW_LEAD_ROW_BACKGROUND = '#EAF2FF'

/** Creation, not note/activity edits, starts the source-independent highlight. */
export function isNewLead(lead: { created_at: string }, now = Date.now()) {
  const age = now - Date.parse(lead.created_at)
  return Number.isFinite(age) && age >= 0 && age < NEW_LEAD_WINDOW_MS
}
