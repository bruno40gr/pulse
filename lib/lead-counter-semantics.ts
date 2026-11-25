export const NEW_LEAD_WINDOW_MS = 48 * 60 * 60 * 1000
type Candidate = { id: string; contact_id?: string | null; intake_type: string; created_at: string }
type Event = { lead_intake_id?: string | null; contact_id?: string | null; event_type: string; payload?: Record<string, unknown> | null }
/** Persisted outbound contact/history survives reopening an intake as New. */
export function netNewLeadCounts(leads: Candidate[], events: Event[]) {
  const contactedLeads = new Set<string>(), contactedPeople = new Set<string>()
  for (const event of events) {
    const next = event.payload?.next_status
    if (!['outbound_sms', 'outbound_email', 'call_started'].includes(event.event_type)
      && !['contacted', 'booked', 'processing', 'won'].includes(String(next || ''))) continue
    if (event.lead_intake_id) contactedLeads.add(event.lead_intake_id)
    if (event.contact_id) contactedPeople.add(event.contact_id)
  }
  // Propagate lead-only history to every intake of the same saved contact identity.
  for (const lead of leads) if (contactedLeads.has(lead.id) && lead.contact_id) contactedPeople.add(lead.contact_id)
  const seen = new Set<string>(), counts = { lesson_inquiry: 0, service_inquiry: 0 }
  for (const lead of [...leads].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))) {
    const identity = lead.contact_id || `intake:${lead.id}`
    if (seen.has(identity) || contactedLeads.has(lead.id) || contactedPeople.has(identity)) continue
    seen.add(identity)
    counts[lead.intake_type === 'service_inquiry' ? 'service_inquiry' : 'lesson_inquiry']++
  }
  return counts
}