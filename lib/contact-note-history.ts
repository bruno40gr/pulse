import { supabaseAdmin } from '@/lib/supabase/admin'

export type ContactNoteEntry = {
  id?: string
  text: string
  timestamp: string
  actor_name?: string | null
  actor_membership_id?: string | null
  completed_at?: string | null
}

export type ContactNoteHistoryField = 'notes_history' | 'student_notes_history'

type ContactNoteMutationResult = {
  note: ContactNoteEntry
  history: ContactNoteEntry[]
}

const MAX_UPDATE_ATTEMPTS = 5

function normalizeHistory(value: unknown): ContactNoteEntry[] {
  return Array.isArray(value) ? value.filter((entry): entry is ContactNoteEntry => Boolean(entry && typeof entry === 'object')) : []
}

async function updateHistory(
  tenantId: string,
  contactId: string,
  field: ContactNoteHistoryField,
  mutate: (history: ContactNoteEntry[]) => ContactNoteMutationResult | null,
): Promise<ContactNoteMutationResult | null> {
  for (let attempt = 0; attempt < MAX_UPDATE_ATTEMPTS; attempt += 1) {
    const { data: person, error: findError } = await supabaseAdmin
      .from('people')
      .select(`id, updated_at, ${field}`)
      .eq('id', contactId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (findError) throw findError
    if (!person) return null

    const personRecord = person as {
      id: string
      updated_at: string
      notes_history?: unknown
      student_notes_history?: unknown
    }
    const result = mutate(normalizeHistory(personRecord[field]))
    if (!result) return null

    const currentUpdatedAt = new Date(personRecord.updated_at).getTime()
    const nextUpdatedAt = new Date(Math.max(Date.now(), currentUpdatedAt + 1)).toISOString()
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('people')
      .update({ [field]: result.history, updated_at: nextUpdatedAt })
      .eq('id', contactId)
      .eq('tenant_id', tenantId)
      .eq('updated_at', personRecord.updated_at)
      .select('id')
      .maybeSingle()
    if (updateError) throw updateError
    if (updated) return result
  }

  throw new Error('The notes changed while you were saving. Please try again.')
}

export async function appendContactNote(input: {
  tenantId: string
  contactId: string
  field: ContactNoteHistoryField
  note: ContactNoteEntry
}) {
  return updateHistory(input.tenantId, input.contactId, input.field, (history) => ({
    note: input.note,
    history: [input.note, ...history],
  }))
}

export async function toggleContactNoteCompletion(input: {
  tenantId: string
  contactId: string
  field: ContactNoteHistoryField
  noteId?: string
  timestamp?: string
}) {
  return updateHistory(input.tenantId, input.contactId, input.field, (history) => {
    const noteIndex = history.findIndex((note) =>
      input.noteId ? note.id === input.noteId : Boolean(input.timestamp && note.timestamp === input.timestamp),
    )
    if (noteIndex < 0) return null

    const note = {
      ...history[noteIndex],
      completed_at: history[noteIndex].completed_at ? null : new Date().toISOString(),
    }
    const nextHistory = [...history]
    nextHistory[noteIndex] = note
    return { note, history: nextHistory }
  })
}
