import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const tenantId = url.searchParams.get('tenant') || DEFAULT_TENANT_ID
  const q = (url.searchParams.get('q') || '').trim()

  if (!q) return NextResponse.json([])

  try {
    const { data, error } = await supabaseAdmin
      .from('people')
      .select('id, first_name, last_name, phone, email')
      .eq('tenant_id', tenantId)
      .or(`first_name.ilike.*${q}*,last_name.ilike.*${q}*,phone.ilike.*${q}*,email.ilike.*${q}*`)
      .order('last_name', { ascending: true })
      .limit(25)

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
