import { readLeadStudents } from './lead-students'

// Search is presentation-only: it never links people or changes recipients.
export function matchesLeadInquirySearch(lead: {
  contact?: { full_name?: string | null; email?: string | null; phone?: string | null } | null
  payload?: Record<string, unknown> | null
  program_label?: string | null
}, query: string): boolean {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const text = [lead.contact?.full_name, lead.contact?.email, lead.contact?.phone,
    ...readLeadStudents(lead.payload || {}, lead.program_label || null).map(student => student.name),
  ].filter(Boolean).join(' ').toLocaleLowerCase()
  return terms.every(term => text.includes(term))
}