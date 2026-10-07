export const LEAD_STATUSES = ['new', 'contacted', 'booked', 'processing', 'won', 'lost', 'spam', 'ghosted_us']
export const LEAD_PIPELINE = ['new', 'contacted', 'booked', 'processing', 'won']

export function formatLeadStatus(value: string): string {
  if (value === 'processing') return 'Enrolling'
  return value.replace(/[_-]/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}