import { supabaseAdmin } from '@/lib/supabase/admin'

export type NotePrivacyRecord = {
  id: string
  tenant_id: string
  is_private: boolean
  created_by_membership_id: string | null
}

export async function getPrivateNoteParticipantIds(tenantId: string, noteIds: string[]): Promise<Map<string, Set<string>>> {
  const participants = new Map<string, Set<string>>()
  if (noteIds.length === 0) return participants

  const { data, error } = await supabaseAdmin
    .from('note_participants')
    .select('note_id, membership_id')
    .eq('tenant_id', tenantId)
    .in('note_id', noteIds)
  if (error) throw error

  for (const row of data || []) {
    const noteParticipants = participants.get(row.note_id) || new Set<string>()
    noteParticipants.add(row.membership_id)
    participants.set(row.note_id, noteParticipants)
  }
  return participants
}

export async function canAccessNote(note: NotePrivacyRecord, membershipId: string | null | undefined): Promise<boolean> {
  if (!note.is_private) return true
  if (!membershipId) return false

  const { data, error } = await supabaseAdmin
    .from('note_participants')
    .select('note_id')
    .eq('tenant_id', note.tenant_id)
    .eq('note_id', note.id)
    .eq('membership_id', membershipId)
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

export async function addPrivateNoteParticipants(input: {
  tenantId: string
  noteId: string
  membershipIds: string[]
}): Promise<number> {
  const membershipIds = [...new Set(input.membershipIds)]
  if (membershipIds.length > 0) {
    const { error } = await supabaseAdmin.from('note_participants').upsert(
      membershipIds.map((membershipId) => ({
        tenant_id: input.tenantId,
        note_id: input.noteId,
        membership_id: membershipId,
      })),
      { onConflict: 'note_id,membership_id', ignoreDuplicates: true },
    )
    if (error) throw error
  }

  const { count, error: countError } = await supabaseAdmin
    .from('note_participants')
    .select('note_id', { count: 'exact', head: true })
    .eq('tenant_id', input.tenantId)
    .eq('note_id', input.noteId)
  if (countError) throw countError
  return count || 0
}