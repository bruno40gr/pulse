import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRequestActor } from '@/lib/access'
import { resolveRequestTenant } from '@/lib/tenant-access'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function getTenantId(request: Request): string {
  const url = new URL(request.url)
  return url.searchParams.get('tenant') || DEFAULT_TENANT_ID
}

export async function GET(request: Request) {
  try {
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status })
    const tenantId = tenantAccess.tenantId
    const { data, error } = await supabaseAdmin
      .from('notes')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data || [])
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
    const actor = await getRequestActor(request)
    const body = await request.json()

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const noteBody = typeof body.body === 'string' ? body.body.trim() : ''
    if (!title && !noteBody) {
      return NextResponse.json({ error: 'Note is empty.' }, { status: 400 })
    }

    const color = typeof body.color === 'string' && body.color ? body.color : 'yellow'
    const pinned = body.pinned === true

    const { data, error } = await supabaseAdmin
      .from('notes')
      .insert({
        tenant_id: tenantId,
        title: title || null,
        body: noteBody,
        color,
        pinned,
        created_by: actor?.displayName || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('[notes][create] Error', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
