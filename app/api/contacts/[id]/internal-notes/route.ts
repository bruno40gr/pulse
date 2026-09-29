import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { persistMentions, validateMentionMembershipIds } from '@/lib/mentions'
import { resolveRequestTenant } from '@/lib/tenant-access'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status })
    if (!tenantAccess.context) return NextResponse.json({ error: 'Staff membership required.' }, { status: 403 })
    const { id } = await params
    const body = await request.json()
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text) return NextResponse.json({ error: 'Note cannot be empty.' }, { status: 400 })
    const mentionMembershipIds = await validateMentionMembershipIds(tenantAccess.tenantId, body.mention_membership_ids)

    const { data: person, error: findError } = await supabaseAdmin
      .from('people')
      .select('id, notes_history')
      .eq('id', id)
      .eq('tenant_id', tenantAccess.tenantId)
      .maybeSingle()
    if (findError) throw findError
    if (!person) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 })

    const note = {
      id: randomUUID(),
      text,
      timestamp: new Date().toISOString(),
      actor_name: tenantAccess.identity.displayName,
      actor_membership_id: tenantAccess.context.membershipId,
      completed_at: null,
    }
    const existingNotes = Array.isArray(person.notes_history) ? person.notes_history : []
    const { error: updateError } = await supabaseAdmin
      .from('people')
      .update({ notes_history: [note, ...existingNotes], updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantAccess.tenantId)
    if (updateError) throw updateError

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

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}