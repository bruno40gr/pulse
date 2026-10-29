type NoteEvent = {
  id: string
  event_type: string
  payload: Record<string, unknown> | null
  created_at: string
}

/** Names are not proof of authorship. Unknown/imported authors stay read-only. */
export function isLeadNoteAuthor(actor: unknown, viewer: { personId: string; membershipId?: string | null }) {
  if (!actor || typeof actor !== 'object') return false
  const identity = actor as { personId?: unknown; membershipId?: unknown }
  if (typeof identity.personId === 'string' && identity.personId) return identity.personId === viewer.personId
  return Boolean(viewer.membershipId && identity.membershipId === viewer.membershipId)
}

// Creation messages are stored in the inquiry payload, not contact-wide notes.
// Expose them without a backfill or a second, non-transactional database write.
export function getLeadNotesHistory(
  events: NoteEvent[],
  lead: { id: string, created_at: string, intake_type?: string, payload: Record<string, unknown> | null },
) {
  const notes = events.filter(event => event.event_type === 'note_added').map(event => {
    const actor = event.payload?.actor
    return {
      id: event.id,
      text: typeof event.payload?.text === 'string' ? event.payload.text : '',
      timestamp: event.created_at,
      editable: false,
      edited_at: typeof event.payload?.edited_at === 'string' ? event.payload.edited_at : null,
      actor_name: actor && typeof actor === 'object' && 'displayName' in actor && typeof actor.displayName === 'string'
        ? actor.displayName : null,
    }
  })
  const message = typeof lead.payload?.message === 'string' ? lead.payload.message.trim() : ''
  if (message) {
    notes.push({ id: `intake-message-${lead.id}`, text: message, timestamp: lead.created_at, actor_name: null, editable: false, edited_at: typeof lead.payload?.message_edited_at === 'string' ? lead.payload.message_edited_at : null })
  }
  if (lead.intake_type === 'tour_request') {
    notes.push({ id: `tour-request-${lead.id}`, text: 'Tour request', timestamp: lead.created_at, actor_name: null, editable: false, edited_at: null })
  }
  return notes.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
}