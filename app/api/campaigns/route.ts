import { PERMISSIONS } from '@/lib/permissions'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsRead, allowDemo: true })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const tenantId = access.tenantId
  try {
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsSend, allowDemo: true, body })
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .insert({ ...body, tenant_id: access.tenantId })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
