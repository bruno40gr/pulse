export type NoteStatusDecision = { status: 'contacted' | 'booked'; reason: string; evidence: string }
export type AutomaticStatusChange = {
  id: string
  previous_status: string
  next_status: 'contacted' | 'booked'
  reason: string
  evidence: string
  note_event_id: string
  changed_at: string
}
export type LeadStatusAutomation = { paused: boolean; last_change: AutomaticStatusChange | null }

export function readStatusAutomation(payload: Record<string, unknown> | null | undefined): LeadStatusAutomation {
  const value = payload?.status_automation
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { paused: false, last_change: null }
  const record = value as Record<string, unknown>
  const change = record.last_change as Partial<AutomaticStatusChange> | null
  const valid = change && typeof change.id === 'string' && ['new', 'contacted'].includes(change.previous_status || '')
    && ['contacted', 'booked'].includes(change.next_status || '') && typeof change.reason === 'string'
    && typeof change.evidence === 'string' && typeof change.note_event_id === 'string' && typeof change.changed_at === 'string'
  return { paused: record.paused === true, last_change: valid ? change as AutomaticStatusChange : null }
}

// Deliberately favors missed matches over false positives. Only completed actions
// in newly saved staff notes count; inquiries, future plans and negations do not.
export function detectNoteStatus(note: string): NoteStatusDecision | null {
  const text = note.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()
  if (!text || text.length > 10000) return null
  if (/\b(not|no|never|didn't|didnt|haven't|hasn't|wasn't|weren't|couldn't|can't|cannot|don't|doesn't|won't|wouldn't|shouldn't|isn't|isnt|aren't|unconfirmed|cancelled|canceled|tentative|maybe|if|whether|might|may|would|should|will|want|wants|wanted|need|needs|plan|plans|planning|hoping)\b/.test(text)
    || /\b(yet|previously|last week|last month|used to|history|example|quote|quoted|going to|trying to|attempted to|hopes to|hope to)\b/.test(text) || /[?"“”]/.test(text)) return null

  const booking = /\b(?:booked|scheduled|confirmed)\s+(?:(?:a|the|their|his|her|our|an)\s+)?(?:(?:trial|intro|introductory|first|piano|guitar|voice|drum|drums|violin)\s+)?(?:lesson|lessons|class|classes|session|trial|tour)\b/.test(text)
    || /\b(?:lesson|class|trial|tour|session)\s+(?:(?:is|was|has been)\s+)?(?:booked|scheduled|confirmed)\b/.test(text)
  if (booking) return { status: 'booked', reason: 'Confirmed lesson, trial, class or tour booking recorded', evidence: note.trim() }

  const outreach = /\bleft\s+(?:(?:a|the|them a)\s+)?(?:voicemail|voice mail|vm|message)\b/.test(text)
    || /\b(?:lvm|lmvm)\b/.test(text)
    || /\b(?:spoke|talked)\s+(?:to|with)\s+(?:(?:the|a)\s+)?(?:parent|guardian|mom|mum|dad|mother|father|student|contact|family)\b/.test(text)
  return outreach ? { status: 'contacted', reason: 'Completed outreach recorded', evidence: note.trim() } : null
}

export function canApplyNoteStatus(status: string, decision: NoteStatusDecision, payload: Record<string, unknown> | null): boolean {
  if (readStatusAutomation(payload).paused) return false
  return status === 'new' || (status === 'contacted' && decision.status === 'booked')
}