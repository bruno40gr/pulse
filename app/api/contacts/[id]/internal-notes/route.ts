import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { appendContactNote, toggleContactNoteCompletion } from '@/lib/contact-note-history'
import { persistMentions, validateMentionMembershipIds } from '@/lib/mentions'
import { resolveRequestTenant } from '@/lib/tenant-access'
import { PERMISSIONS } from '@/lib/permissions'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID, { permission: PERMISSIONS.notesManage })
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status })
    if (!tenantAccess.context) return NextResponse.json({ error: 'Staff membership required.' }, { status: 403 })
    const { id } = await params
    const body = await request.json()
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text) return NextResponse.json({ error: 'Note cannot be empty.' }, { status: 400 })
    let mentionMembershipIds: string[] = []
    try {
      mentionMembershipIds = await validateMentionMembershipIds(tenantAccess.tenantId, body.mention_membership_ids)
    } catch (mentionError) {
      console.error('[contact-notes] Could not validate mentions', mentionError instanceof Error ? mentionError.message : mentionError)
    }

    const note = {
      id: randomUUID(),
      text,
      timestamp: new Date().toISOString(),
      actor_name: tenantAccess.identity.displayName,
      actor_membership_id: tenantAccess.context.membershipId,
      completed_at: null,
    }
    const result = await appendContactNote({
      tenantId: tenantAccess.tenantId,
      contactId: id,
      field: 'notes_history',
      note,
    })
    if (!result) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 })

    try {
      await persistMentions({
        tenantId: tenantAccess.tenantId,
        actorMembershipId: tenantAccess.context.membershipId,
        membershipIds: mentionMembershipIds,
        entityType: 'contact_internal_note',
        entityId: note.id,
        parentEntityId: id,
        title: `${tenantAccess.identity.displayName} mentioned you on a contact`,
        body: text,
        link: `/dashboard/contacts?contact=${encodeURIComponent(id)}&notes=internal`,
      })
    } catch (mentionError) {
      console.error('[contact-notes] Note saved but mentions could not be persisted', {
        contactId: id,
        noteId: note.id,
        error: mentionError instanceof Error ? mentionError.message : mentionError,
      })
    }

    return NextResponse.json({ note: result.note, notes_history: result.history }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID, { permission: PERMISSIONS.notesManage })
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status })
    if (!tenantAccess.context) return NextResponse.json({ error: 'Staff membership required.' }, { status: 403 })
    const { id } = await params
    const body = await request.json()
    const noteId = typeof body.note_id === 'string' ? body.note_id : undefined
    const timestamp = typeof body.timestamp === 'string' ? body.timestamp : undefined
    if (!noteId && !timestamp) return NextResponse.json({ error: 'A note identifier is required.' }, { status: 400 })

    const result = await toggleContactNoteCompletion({
      tenantId: tenantAccess.tenantId,
      contactId: id,
      field: 'notes_history',
      noteId,
      timestamp,
    })
    if (!result) return NextResponse.json({ error: 'Contact note not found.' }, { status: 404 })
    return NextResponse.json({ note: result.note, notes_history: result.history })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
