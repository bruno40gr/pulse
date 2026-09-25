import { NextResponse } from 'next/server'
import { getRequestActor } from '@/lib/access'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveRequestTenant } from '@/lib/tenant-access'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

async function getTenantNote(id: string, tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('notes')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status })

    const note = await getTenantNote(id, tenantAccess.tenantId)
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
    const actor = await getRequestActor(request)
    if (!actor) return NextResponse.json({ error: 'Pulse access required.' }, { status: 401 })

    const { body } = await request.json()
    const replyBody = typeof body === 'string' ? body.trim() : ''
    if (!replyBody) return NextResponse.json({ error: 'Reply cannot be empty.' }, { status: 400 })

    const note = await getTenantNote(id, tenantAccess.tenantId)
    if (!note) return NextResponse.json({ error: 'Note not found.' }, { status: 404 })

    const { data, error } = await supabaseAdmin
      .from('note_replies')
      .insert({
        tenant_id: tenantAccess.tenantId,
        note_id: id,
        body: replyBody,
        created_by: actor.displayName,
      })
      .select('id, body, created_by, created_at')
      .single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('[notes][replies][create] Error', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Could not save reply.' }, { status: 500 })
  }
}