import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function getTenantId(request: Request): string {
  const url = new URL(request.url)
  return url.searchParams.get('tenant') || DEFAULT_TENANT_ID
}

export async function GET(request: Request) {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_fields')
      .select('*')
      .eq('tenant_id', getTenantId(request))
      .order('sort_order', { ascending: true })
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const fields = await request.json()
    if (!Array.isArray(fields)) return NextResponse.json({ error: 'Expected array of fields' }, { status: 400 })
    const { error } = await supabaseAdmin
      .from('tenant_fields')
      .upsert(
        fields.map((f: any) => ({ ...f, tenant_id: getTenantId(request) })),
        { onConflict: 'tenant_id,field_key' }
      )
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}