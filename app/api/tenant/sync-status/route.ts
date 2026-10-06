import { PERMISSIONS } from '@/lib/permissions'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.tenantSettingsRead, allowDemo: true })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const tenantId = access.tenantId
  try {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('last_synced_at, is_demo')
      .eq('id', tenantId)
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
