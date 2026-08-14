import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ensureTenantSettingsTable } from '@/lib/ensure-tenant-settings'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function getTenantId(request: Request): string {
  const url = new URL(request.url)
  return url.searchParams.get('tenant') || DEFAULT_TENANT_ID
}

const FOCUS_OPTIONS = ['retention', 'billing', 'growth']

const DEFAULTS = {
  highlight_threshold: 3,
  focus_areas: FOCUS_OPTIONS,
  base_font_size: 16,
}

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
      .select('highlight_threshold, focus_areas, base_font_size')
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
    const body = await request.json()
    await ensureTenantSettingsTable()

    const highlight_threshold = Math.min(5, Math.max(1, Number(body.highlight_threshold) || 3))
    const base_font_size = Math.min(20, Math.max(14, Number(body.base_font_size) || 16))
    const focus_areas = (Array.isArray(body.focus_areas)
      ? body.focus_areas.filter((f: string) => FOCUS_OPTIONS.includes(f))
      : FOCUS_OPTIONS)

    const { data, error } = await supabaseAdmin
      .from('tenant_settings')
      .upsert(
        { tenant_id: tenantId, highlight_threshold, focus_areas, base_font_size, updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id' }
      )
      .select('highlight_threshold, focus_areas, base_font_size')
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}