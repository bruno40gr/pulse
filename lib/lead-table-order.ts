/** Source-independent default: manual and website inquiries are newest first. */
export function compareNewestLead(left: { created_at: string }, right: { created_at: string }) {
  const time = (value: string) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0
  return time(right.created_at) - time(left.created_at)
}