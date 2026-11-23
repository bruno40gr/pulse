import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { validContactSelection } from '@/lib/communication-recipient-directory'

const headers = { 'Cache-Control': 'private, no-store' }

const SENSITIVE_KEYWORDS = [
  'dispute', 'complaint', 'angry', 'legal', 'refund', 'cancel',
  'upset', 'unhappy', 'threatening', 'no contact', 'no promotional',
  'requested no', 'do not contact', 'harassment'
]

export async function POST(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.contactsRead, allowDemo: false })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  if (!access.context || (access.context.roleKey !== 'owner'
    && !access.context.permissions.has(PERMISSIONS.notesRead) && !access.context.permissions.has(PERMISSIONS.notesManage))) {
    return NextResponse.json({ error: 'Contact notes access is required.' }, { status: 403, headers })
  }
  const body = await request.json().catch(() => null)
  if (!validContactSelection(body?.contact_ids)) return NextResponse.json({ error: 'Choose valid contacts.' }, { status: 400, headers })
  try {
    const contacts: Array<{ id: string; first_name: string | null; last_name: string | null; opted_out: boolean | null; notes_history: unknown }> = []
    for (let offset = 0; offset < body.contact_ids.length; offset += 100) {
      const { data, error } = await supabaseAdmin.from('people')
        .select('id, first_name, last_name, opted_out, notes_history')
        .eq('tenant_id', access.tenantId).in('id', body.contact_ids.slice(offset, offset + 100))
      if (error) throw error
      contacts.push(...(data || []))
    }
    // Never leak whether a missing ID belongs to another account.
    if (contacts.length !== body.contact_ids.length) return NextResponse.json({ error: 'Some contacts are unavailable. Refresh the selection.' }, { status: 409, headers })

    const opted_out = contacts
      .filter(c => c.opted_out)
      .map(c => ({ id: c.id, name: `${c.first_name} ${c.last_name}` }))

    const flagged = contacts
      .filter(c => {
        const lower = noteText(c).toLowerCase()
        return SENSITIVE_KEYWORDS.some(kw => lower.includes(kw))
      })
      .map(c => ({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`,
        note: noteText(c)
      }))

    return NextResponse.json({ flagged, opted_out }, { headers })
  } catch {
    return NextResponse.json({ error: 'Contact safety information is unavailable.' }, { status: 503, headers })
  }
}

function noteText(contact: { notes_history: unknown }) {
  const history = Array.isArray(contact.notes_history) ? contact.notes_history.flatMap((entry: unknown) =>
    entry && typeof entry === 'object' && 'text' in entry && typeof entry.text === 'string' ? [entry.text] : []) : []
  return history.filter(Boolean).join('\n')
}