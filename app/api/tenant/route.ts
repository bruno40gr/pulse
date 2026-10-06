import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { authorizeTenantRequest } from '@/lib/tenant-request'

export async function GET(request: Request) {
  try {
    const access = await authorizeTenantRequest(request, { allowDemo: true })
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, name, is_demo')
      .eq('id', access.tenantId)
      .order('name', { ascending: true })
    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}