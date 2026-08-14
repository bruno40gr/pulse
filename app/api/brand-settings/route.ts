import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ensureTenantSettingsTable } from '@/lib/ensure-tenant-settings'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function getTenantId(request: Request): string {
  const url = new URL(request.url)
  return url.searchParams.get('tenant') || DEFAULT_TENANT_ID
}

const DEFAULTS = { logo_url: null, brand_voice: null, brand_markdown: null }

function isMissingTableError(error: any): boolean {
  const code = error?.code
  const msg = error?.message || ''
  return (
    code === 'PGRST116' ||
    code === 'PGRST204' ||
    code === '42P01' ||
    /schema cache|does not exist|relation .* does not exist/i.test(msg)
  )
}

export async function GET(request: Request) {
  try {
    const tenantId = getTenantId(request)
    await ensureTenantSettingsTable()

    const { data, error } = await supabaseAdmin
      .from('tenant_settings')
      .select('logo_url, brand_voice, brand_markdown')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error && !isMissingTableError(error)) throw error
    return NextResponse.json(data || DEFAULTS)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const tenantId = getTenantId(request)
    const { logo_url, brand_voice, brand_markdown } = await request.json()
    await ensureTenantSettingsTable()

    const { data, error } = await supabaseAdmin
      .from('tenant_settings')
      .upsert(
        { tenant_id: tenantId, logo_url, brand_voice, brand_markdown, updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id' }
      )
      .select('logo_url, brand_voice, brand_markdown')
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}