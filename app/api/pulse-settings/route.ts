import { authorizeTenantRequest } from '@/lib/tenant-request'
import { NextResponse } from 'next/server'
import { writeAccountAuditEvent } from '@/lib/account-audit'
import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/request-context'
import { supabaseAdmin } from '@/lib/supabase/admin'

const FOCUS_OPTIONS = ['retention', 'billing', 'growth']

const DEFAULTS = {
  highlight_threshold: 3,
  focus_areas: FOCUS_OPTIONS,
  base_font_size: 16,
}

function isMissingTableError(error: unknown): boolean {
  const databaseError = error as { code?: string; message?: string } | null
  const code = databaseError?.code
  const msg = databaseError?.message || ''
  return (
    code === 'PGRST116' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    code === '42P01' ||
    /schema cache|does not exist|relation .* does not exist/i.test(msg)
  )
}

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.tenantSettingsRead, allowDemo: true })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const tenantId = access.tenantId
  try {

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
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.tenantSettingsManage, allowDemo: false })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const tenantId = access.tenantId
  try {
    const permission = await requirePermission(request, tenantId, PERMISSIONS.tenantSettingsManage)
    if (!permission.ok) return NextResponse.json({ error: permission.error }, { status: permission.status })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Expected a Pulse settings object.' }, { status: 400 })
    }

    const highlight_threshold = Math.min(5, Math.max(1, Number(body.highlight_threshold) || 3))
    const base_font_size = Math.min(20, Math.max(14, Number(body.base_font_size) || 16))
    const focus_areas = (Array.isArray(body.focus_areas)
      ? body.focus_areas.filter((value: unknown): value is string => typeof value === 'string' && FOCUS_OPTIONS.includes(value))
      : FOCUS_OPTIONS)

    const { data, error } = await supabaseAdmin
      .from('tenant_settings')
      .upsert(
        { tenant_id: tenantId, highlight_threshold, focus_areas, base_font_size, updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id' }
      )
      .select('highlight_threshold, focus_areas, base_font_size')
      .single()

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json({ error: 'Tenant settings are unavailable until Migration 012 is applied.' }, { status: 503 })
      }
      throw error
    }

    const auditRecorded = await writeAccountAuditEvent({
      tenantId,
      actorMembershipId: permission.context.membershipId,
      eventType: 'tenant_settings.pulse_updated',
      metadata: {
        changed_fields: ['highlight_threshold', 'focus_areas', 'base_font_size'],
      },
    })

    return NextResponse.json({ ...data, auditRecorded })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
