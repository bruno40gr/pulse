type NoteEvent = {
  id: string
  event_type: string
  payload: Record<string, unknown> | null
  created_at: string
}

// Creation messages are stored in the inquiry payload, not contact-wide notes.
// Expose them without a backfill or a second, non-transactional database write.
export function getLeadNotesHistory(
  events: NoteEvent[],
  lead: { id: string, created_at: string, payload: Record<string, unknown> | null },
) {
  const notes = events.filter(event => event.event_type === 'note_added').map(event => {
    const actor = event.payload?.actor
    return {
      id: event.id,
      text: typeof event.payload?.text === 'string' ? event.payload.text : '',
      timestamp: event.created_at,
      actor_name: actor && typeof actor === 'object' && 'displayName' in actor && typeof actor.displayName === 'string'
        ? actor.displayName : null,
    }
  })
  const message = typeof lead.payload?.message === 'string' ? lead.payload.message.trim() : ''
  if (message) {
    notes.push({ id: `intake-message-${lead.id}`, text: message, timestamp: lead.created_at, actor_name: null })
  }
  return notes.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
}