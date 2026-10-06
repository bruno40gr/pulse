import { authorizeTenantRequest } from '@/lib/tenant-request'
import { NextResponse } from 'next/server'
import { writeAccountAuditEvent } from '@/lib/account-audit'
import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/request-context'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULTS = { logo_url: null, brand_voice: null, brand_markdown: null }

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
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.tenantSettingsManage, allowDemo: false })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const tenantId = access.tenantId
  try {
    const permission = await requirePermission(request, tenantId, PERMISSIONS.tenantSettingsManage)
    if (!permission.ok) return NextResponse.json({ error: permission.error }, { status: permission.status })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Expected a brand settings object.' }, { status: 400 })
    }
    const logo_url = typeof body?.logo_url === 'string' ? body.logo_url.trim() || null : null
    const brand_voice = typeof body?.brand_voice === 'string' ? body.brand_voice.trim() || null : null
    const brand_markdown = typeof body?.brand_markdown === 'string' ? body.brand_markdown.trim() || null : null
    if ((logo_url?.length || 0) > 2048 || (brand_voice?.length || 0) > 10000 || (brand_markdown?.length || 0) > 50000) {
      return NextResponse.json({ error: 'One or more brand settings are too long.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('tenant_settings')
      .upsert(
        { tenant_id: tenantId, logo_url, brand_voice, brand_markdown, updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id' }
      )
      .select('logo_url, brand_voice, brand_markdown')
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
      eventType: 'tenant_settings.brand_updated',
      metadata: {
        changed_fields: ['logo_url', 'brand_voice', 'brand_markdown'],
      },
    })

    return NextResponse.json({ ...data, auditRecorded })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
