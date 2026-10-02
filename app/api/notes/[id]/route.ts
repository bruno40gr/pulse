import { NextResponse } from 'next/server'
import { persistMentions, validateMentionMembershipIds } from '@/lib/mentions'
import { addPrivateNoteParticipants, canAccessNote, type NotePrivacyRecord } from '@/lib/note-privacy'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveRequestTenant } from '@/lib/tenant-access'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function isDateValue(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

async function getNote(id: string, tenantId: string) {
  const { data, error } = await supabaseAdmin.from('notes').select('*').eq('id', id).eq('tenant_id', tenantId).maybeSingle()
  if (error) throw error
  return data
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status })
    const tenantId = tenantAccess.tenantId
    const existingNote = await getNote(id, tenantId)
    if (!existingNote || !await canAccessNote(existingNote as NotePrivacyRecord, tenantAccess.context?.membershipId)) {
      return NextResponse.json({ error: 'Note not found.' }, { status: 404 })
    }

    const body = await request.json()
    const mentionMembershipIds = 'body' in body && tenantAccess.context
      ? await validateMentionMembershipIds(tenantId, body.mention_membership_ids)
      : []
    const updates: Record<string, unknown> = {}
    if ('title' in body) updates.title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null
    if ('body' in body) updates.body = typeof body.body === 'string' ? body.body : ''
    if ('color' in body) updates.color = typeof body.color === 'string' && body.color ? body.color : 'yellow'
    if ('pinned' in body) updates.pinned = body.pinned === true
    if ('completed_at' in body) updates.completed_at = typeof body.completed_at === 'string' ? body.completed_at : null
    if ('note_date' in body) {
      if (!isDateValue(body.note_date)) return NextResponse.json({ error: 'A valid note date is required.' }, { status: 400 })
      updates.note_date = body.note_date
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })

    updates.updated_at = new Date().toISOString()
    const { data, error } = await supabaseAdmin.from('notes').update(updates).eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw error

    let participantCount: number | undefined = existingNote.is_private ? undefined : 0
    if ('body' in body && tenantAccess.context) {
      if (existingNote.is_private) participantCount = await addPrivateNoteParticipants({ tenantId, noteId: id, membershipIds: mentionMembershipIds })
      try {
        await persistMentions({
          tenantId,
          actorMembershipId: tenantAccess.context.membershipId,
          membershipIds: mentionMembershipIds,
          entityType: 'dashboard_note',
          entityId: id,
          title: `${tenantAccess.identity.displayName} mentioned you in a note`,
          body: typeof body.body === 'string' ? body.body : '',
          link: `/dashboard/notes?note=${encodeURIComponent(id)}`,
        })
      } catch (mentionError) {
        console.error('[notes][update] Note saved but mentions could not be persisted', {
          noteId: id,
          error: mentionError instanceof Error ? mentionError.message : mentionError,
        })
      }
    }
    return NextResponse.json({ ...data, participant_count: participantCount })
  } catch (error) {
    console.error('[notes][update] Error', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status })
    const note = await getNote(id, tenantAccess.tenantId)
    if (!note || !await canAccessNote(note as NotePrivacyRecord, tenantAccess.context?.membershipId)) {
      return NextResponse.json({ error: 'Note not found.' }, { status: 404 })
    }
    const { error } = await supabaseAdmin.from('notes').delete().eq('id', id).eq('tenant_id', tenantAccess.tenantId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[notes][delete] Error', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}