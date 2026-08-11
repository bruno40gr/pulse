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
      .from('twilio_config')
      .select('id, phone_number, registration_status, created_at')
      .eq('tenant_id', getTenantId(request))
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return NextResponse.json(data || null)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { account_sid, auth_token, phone_number } = await request.json()
    if (!account_sid || !auth_token) {
      return NextResponse.json({ error: 'Account SID and Auth Token are required' }, { status: 400 })
    }
    const { data: existing } = await supabaseAdmin
      .from('twilio_config')
      .select('id')
      .eq('tenant_id', getTenantId(request))
      .single()

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('twilio_config')
        .update({ account_sid, auth_token, phone_number, registration_status: 'configured' })
        .eq('tenant_id', getTenantId(request))
        .select('id, phone_number, registration_status')
        .single()
      if (error) throw error
      return NextResponse.json(data)
    } else {
      const { data, error } = await supabaseAdmin
        .from('twilio_config')
        .insert({ tenant_id: getTenantId(request), account_sid, auth_token, phone_number, registration_status: 'configured' })
        .select('id, phone_number, registration_status')
        .single()
      if (error) throw error
      return NextResponse.json(data)
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}