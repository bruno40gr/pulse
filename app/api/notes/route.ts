import { NextResponse } from 'next/server'
import { persistMentions, validateMentionMembershipIds } from '@/lib/mentions'
import { addPrivateNoteParticipants, getPrivateNoteParticipantIds } from '@/lib/note-privacy'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveRequestTenant } from '@/lib/tenant-access'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function isDateValue(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

export async function GET(request: Request) {
  try {
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status })
    const tenantId = tenantAccess.tenantId
    const url = new URL(request.url)
    const noteDate = url.searchParams.get('date')
    if (noteDate && !isDateValue(noteDate)) return NextResponse.json({ error: 'A valid note date is required.' }, { status: 400 })
    const dateFrom = url.searchParams.get('date_from')
    const dateTo = url.searchParams.get('date_to')
    if ((dateFrom && !isDateValue(dateFrom)) || (dateTo && !isDateValue(dateTo)) || (dateFrom && dateTo && dateFrom > dateTo)) {
      return NextResponse.json({ error: 'A valid chronological date range is required.' }, { status: 400 })
    }
    const showDone = url.searchParams.get('show_done') === 'true'

    let query = supabaseAdmin
      .from('notes')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    if (noteDate) query = query.eq('note_date', noteDate)
    if (dateFrom) query = query.gte('note_date', dateFrom)
    if (dateTo) query = query.lte('note_date', dateTo)
    if (!showDone) query = query.is('completed_at', null)

    const { data, error } = await query
    if (error) throw error
    const notes = data || []
    if (notes.length === 0) return NextResponse.json([])

    const privateNoteIds = notes.filter((note) => note.is_private).map((note) => note.id)
    const participantsByNote = await getPrivateNoteParticipantIds(tenantId, privateNoteIds)
    const membershipId = tenantAccess.context?.membershipId
    const visibleNotes = notes.filter((note) => !note.is_private || Boolean(membershipId && participantsByNote.get(note.id)?.has(membershipId)))
    if (visibleNotes.length === 0) return NextResponse.json([])

    const { data: replyRows, error: replyError } = await supabaseAdmin
      .from('note_replies')
      .select('note_id')
      .eq('tenant_id', tenantId)
      .in('note_id', visibleNotes.map((note) => note.id))
    if (replyError) throw replyError

    const replyCounts = new Map<string, number>()
    for (const reply of replyRows || []) replyCounts.set(reply.note_id, (replyCounts.get(reply.note_id) || 0) + 1)
    return NextResponse.json(visibleNotes.map((note) => ({
      ...note,
      reply_count: replyCounts.get(note.id) || 0,
      participant_count: note.is_private ? participantsByNote.get(note.id)?.size || 0 : 0,
    })))
  } catch (error) {
    console.error('[notes][list] Error', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status })
    const tenantId = tenantAccess.tenantId
    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const noteBody = typeof body.body === 'string' ? body.body.trim() : ''
    if (!title && !noteBody) return NextResponse.json({ error: 'Note is empty.' }, { status: 400 })

    const isPrivate = body.is_private === true
    const noteDate = typeof body.note_date === 'string' ? body.note_date : new Date().toISOString().slice(0, 10)
    if (!isDateValue(noteDate)) return NextResponse.json({ error: 'A valid note date is required.' }, { status: 400 })
    if (isPrivate && !tenantAccess.context) return NextResponse.json({ error: 'A staff account is required to create a private note.' }, { status: 403 })
    const mentionMembershipIds = tenantAccess.context
      ? await validateMentionMembershipIds(tenantId, body.mention_membership_ids)
      : []

    const { data, error } = await supabaseAdmin.from('notes').insert({
      tenant_id: tenantId,
      title: title || null,
      body: noteBody,
      color: typeof body.color === 'string' && body.color ? body.color : 'yellow',
      pinned: body.pinned === true,
      is_private: isPrivate,
      note_date: noteDate,
      created_by: tenantAccess.identity.displayName,
      created_by_membership_id: tenantAccess.context?.membershipId || null,
    }).select().single()
    if (error) throw error

    let participantCount = 0
    if (isPrivate && tenantAccess.context) {
      try {
        participantCount = await addPrivateNoteParticipants({
          tenantId,
          noteId: data.id,
          membershipIds: [tenantAccess.context.membershipId, ...mentionMembershipIds],
        })
      } catch (privacyError) {
        await supabaseAdmin.from('notes').delete().eq('id', data.id).eq('tenant_id', tenantId)
        throw privacyError
      }
    }
    if (tenantAccess.context) {
      try {
        await persistMentions({
          tenantId,
          actorMembershipId: tenantAccess.context.membershipId,
          membershipIds: mentionMembershipIds,
          entityType: 'dashboard_note',
          entityId: data.id,
          title: `${tenantAccess.identity.displayName} mentioned you in a note`,
          body: noteBody,
          link: `/dashboard/notes?note=${encodeURIComponent(data.id)}`,
        })
      } catch (mentionError) {
        console.error('[notes][create] Note saved but mentions could not be persisted', {
          noteId: data.id,
          error: mentionError instanceof Error ? mentionError.message : mentionError,
        })
      }
    }
    return NextResponse.json({ ...data, participant_count: participantCount, reply_count: 0 })
  } catch (error) {
    console.error('[notes][create] Error', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}