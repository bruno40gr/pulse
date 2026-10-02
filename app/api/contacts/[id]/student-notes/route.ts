import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { appendContactNote, toggleContactNoteCompletion } from '@/lib/contact-note-history'
import { resolveRequestTenant } from '@/lib/tenant-access'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status })
    const { id } = await params
    const body = await request.json()
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text) return NextResponse.json({ error: 'Note cannot be empty.' }, { status: 400 })

    const note = {
      id: randomUUID(),
      text,
      timestamp: new Date().toISOString(),
      actor_name: tenantAccess.identity.displayName,
      actor_membership_id: tenantAccess.context?.membershipId || null,
      completed_at: null,
    }
    const result = await appendContactNote({
      tenantId: tenantAccess.tenantId,
      contactId: id,
      field: 'student_notes_history',
      note,
    })
    if (!result) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 })
    return NextResponse.json({ note: result.note, student_notes_history: result.history }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status })
    const { id } = await params
    const body = await request.json()
    const noteId = typeof body.note_id === 'string' ? body.note_id : undefined
    const timestamp = typeof body.timestamp === 'string' ? body.timestamp : undefined
    if (!noteId && !timestamp) return NextResponse.json({ error: 'A note identifier is required.' }, { status: 400 })

    const result = await toggleContactNoteCompletion({
      tenantId: tenantAccess.tenantId,
      contactId: id,
      field: 'student_notes_history',
      noteId,
      timestamp,
    })
    if (!result) return NextResponse.json({ error: 'Contact note not found.' }, { status: 404 })
    return NextResponse.json({ note: result.note, student_notes_history: result.history })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
