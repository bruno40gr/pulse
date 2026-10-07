type SignalLead = {
  status: string
  created_at: string
  updated_at?: string | null
  last_activity_at?: string | null
  last_inbound_at?: string | null
  follow_up_at?: string | null
  payload?: Record<string, unknown> | null
  last_status_change?: { previous_status: string; next_status: string; created_at: string } | null
}

// Count weekdays, not elapsed 24-hour periods: a Friday lead must not become
// cold simply because the team was away for the weekend.
export function businessDaysSince(value: string | null | undefined, now: Date): number | null {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || date > now) return null
  const start = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const end = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((end - start) / 86400000)
  let result = Math.floor(days / 7) * 5
  for (let offset = 1; offset <= days % 7; offset += 1) {
    const weekday = (date.getDay() + offset) % 7
    if (weekday !== 0 && weekday !== 6) result += 1
  }
  return result
}

export function getLeadSignal(lead: SignalLead, now = new Date()): { emoji: string; label: string } {
  const status = lead.status.trim().toLowerCase()
  if (status === 'won' || status === 'hired') return { emoji: '🏆', label: status === 'won' ? 'Won' : 'Hired' }
  if (status === 'lost' || status === 'rejected' || status === 'withdrew') return { emoji: '💀', label: 'Closed opportunity' }
  if (status === 'ghosted_us' || status === 'ghosted') return { emoji: '👻', label: 'Ghosted us' }
  if (status === 'spam') return { emoji: '🗑️', label: 'Spam' }
  if (status === 'processing') return { emoji: '⏳', label: 'Enrolling — check the scheduled follow-up' }
  if (['booked', 'audition_scheduled', 'audition_completed', 'offer_sent'].includes(status)) {
    return { emoji: '🔥🔥', label: 'Booking or next step confirmed — active opportunity' }
  }

  const followUp = lead.follow_up_at || (typeof lead.payload?.follow_up_at === 'string' ? lead.payload.follow_up_at : null)
  if (followUp) {
    const due = new Date(followUp)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (Number.isFinite(due.getTime()) && due >= today) {
      return { emoji: '🔥🧊', label: 'Follow-up scheduled — opportunity remains active' }
    }
  }

  const inboundAge = businessDaysSince(lead.last_inbound_at, now)
  if (inboundAge !== null && inboundAge <= 3) return { emoji: '🔥🔥', label: 'Recent reply — engaged lead' }

  const ages = [lead.created_at, lead.updated_at, lead.last_activity_at, lead.last_status_change?.created_at, lead.last_inbound_at]
    .map(value => businessDaysSince(value, now)).filter((age): age is number => age !== null)
  const inactivity = ages.length ? Math.min(...ages) : null
  if (inactivity === null) return { emoji: '🔥🧊', label: 'Activity timing unavailable — review lead' }
  if (inactivity <= 3) return {
    emoji: '🔥🔥', label: status === 'new' ? 'Fresh inquiry — needs follow-up' : 'Recent activity — awaiting engagement',
  }
  if (inactivity <= 7) return { emoji: '🔥🧊', label: 'Cooling — follow up to keep momentum' }
  return { emoji: '🧊🧊', label: 'No recent activity for more than seven business days — re-engage' }
}