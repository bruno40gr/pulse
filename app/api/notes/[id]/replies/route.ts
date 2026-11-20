import { NextResponse } from 'next/server'
import { createReplyNotification, persistMentions, validateMentionMembershipIds } from '@/lib/mentions'
import { addPrivateNoteParticipants, canAccessNote, type NotePrivacyRecord } from '@/lib/note-privacy'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveRequestTenant } from '@/lib/tenant-access'
import type { MembershipRequestContext } from '@/lib/request-context'
import { validateBandNoteRecipients } from '@/lib/band-note-access'
import { NoteTaskError } from '@/lib/note-task-access'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

async function getAccessibleNote(id: string, tenantId: string, context: MembershipRequestContext | null, write = false) {
  const { data, error } = await supabaseAdmin
    .from('notes')
    .select('id, tenant_id, is_private, created_by_membership_id, band_name')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) throw error
  if (!data || !await canAccessNote(data as NotePrivacyRecord, context?.membershipId, context, write)) return null
  return data
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status })
    const note = await getAccessibleNote(id, tenantAccess.tenantId, tenantAccess.context)
    if (!note) return NextResponse.json({ error: 'Note not found.' }, { status: 404 })

    const { data, error } = await supabaseAdmin
      .from('note_replies')
      .select('id, body, created_by, created_at')
      .eq('tenant_id', tenantAccess.tenantId)
      .eq('note_id', id)
      .order('created_at', { ascending: true })
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('[notes][replies][list] Error', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Could not load replies.' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status })
    const requestBody = await request.json()
    const replyBody = typeof requestBody.body === 'string' ? requestBody.body.trim() : ''
    if (!replyBody) return NextResponse.json({ error: 'Reply cannot be empty.' }, { status: 400 })
    const mentionMembershipIds = tenantAccess.context
      ? await validateMentionMembershipIds(tenantAccess.tenantId, requestBody.mention_membership_ids)
      : []

    const note = await getAccessibleNote(id, tenantAccess.tenantId, tenantAccess.context, true)
    if (!note) return NextResponse.json({ error: 'Note not found.' }, { status: 404 })
    if (note.band_name) await validateBandNoteRecipients(tenantAccess.tenantId, mentionMembershipIds)

    let participantCount: number | undefined = note.is_private ? undefined : 0
    if (note.is_private && tenantAccess.context) {
      participantCount = await addPrivateNoteParticipants({
        tenantId: tenantAccess.tenantId,
        noteId: id,
        membershipIds: mentionMembershipIds,
      })
    }

    const { data, error } = await supabaseAdmin.from('note_replies').insert({
      tenant_id: tenantAccess.tenantId,
      note_id: id,
      body: replyBody,
      created_by: tenantAccess.identity.displayName,
      created_by_membership_id: tenantAccess.context?.membershipId || null,
    }).select('id, body, created_by, created_at').single()
    if (error) throw error

    if (tenantAccess.context) {
      try {
        await persistMentions({
          tenantId: tenantAccess.tenantId,
          actorMembershipId: tenantAccess.context.membershipId,
          membershipIds: mentionMembershipIds,
          entityType: 'note_reply',
          entityId: data.id,
          parentEntityId: id,
          title: `${tenantAccess.identity.displayName} mentioned you in a reply`,
          body: replyBody,
          link: `/dashboard/notes?note=${encodeURIComponent(id)}`,
        })
        if (!note.created_by_membership_id || !mentionMembershipIds.includes(note.created_by_membership_id)) {
          // A former staff author must not receive new internal previews after
          // losing access. Skip their notification rather than block the reply.
          let notifyAuthor = true
          if (note.band_name && note.created_by_membership_id) {
            try { await validateBandNoteRecipients(tenantAccess.tenantId, [note.created_by_membership_id]) }
            catch { notifyAuthor = false }
          }
          if (notifyAuthor) await createReplyNotification({
            tenantId: tenantAccess.tenantId,
            actorMembershipId: tenantAccess.context.membershipId,
            recipientMembershipId: note.created_by_membership_id,
            noteId: id,
            replyId: data.id,
            body: replyBody,
          })
        }
      } catch (notificationError) {
        console.error('[notes][replies][create] Reply saved but notifications could not be persisted', {
          noteId: id,
          replyId: data.id,
          error: notificationError instanceof Error ? notificationError.message : notificationError,
        })
      }
    }
    return NextResponse.json({ ...data, participant_count: participantCount }, { status: 201 })
  } catch (error) {
    if (error instanceof NoteTaskError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[notes][replies][create] Error', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Could not save reply.' }, { status: 500 })
  }
}