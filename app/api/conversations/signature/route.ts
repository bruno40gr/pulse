import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAccountAuditEvent } from '@/lib/account-audit'
import { requirePermission } from '@/lib/request-context'
import { personalEmailSignoff } from '@/lib/personal-email-signoff'

/** Only public signature fields; never expose communications credentials. */
export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsRead })
  const headers = { 'Cache-Control': 'private, no-store' }
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  if (!access.context) return NextResponse.json({ error: 'Sign in to load your email signature.' }, { status: 403, headers })
  try {
    const signoff = await personalEmailSignoff(access.tenantId, access.context.membershipId, access.context.personId)
    return NextResponse.json({ company: '', name: signoff.name, title: signoff.role, personal: true, logoUrl: signoff.logoUrl, phone: signoff.phone, setupRequired: !signoff.storageAvailable, storageAvailable: signoff.storageAvailable }, { headers })
  } catch {
    return NextResponse.json({ error: 'Your email sign-off could not be loaded.' }, { status: 503, headers })
  }
}

export async function PUT(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.tenantSettingsManage, allowDemo: false })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  const permission = await requirePermission(request, access.tenantId, PERMISSIONS.tenantSettingsManage)
  if (!permission.ok) return NextResponse.json({ error: permission.error }, { status: permission.status, headers })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Expected signature settings.' }, { status: 400, headers })
  const signature: Record<string, string> = {}
  for (const key of ['company', 'name', 'phone', 'logoUrl']) {
    if (typeof body[key] !== 'string' || body[key].length > (key === 'logoUrl' ? 2048 : 200)) return NextResponse.json({ error: `Invalid ${key}.` }, { status: 400, headers })
    signature[key] = body[key].trim()
  }
  if (body.title !== undefined && (typeof body.title !== 'string' || body.title.length > 200)) return NextResponse.json({ error: 'Invalid title.' }, { status: 400, headers })
  signature.title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!signature.phone) return NextResponse.json({ error: 'A public contact phone number is required.' }, { status: 400, headers })
  if (signature.logoUrl) {
    try {
      const url = new URL(signature.logoUrl)
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid URL')
    } catch {
      return NextResponse.json({ error: 'Use a public HTTPS URL for the black/dark email logo.' }, { status: 400, headers })
    }
  }
  const { error } = await supabaseAdmin.from('tenant_settings').upsert({ tenant_id: access.tenantId, email_signature: signature, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' })
  if (error) return NextResponse.json({ error: 'Signature settings could not be saved. Ensure Migration 025 is applied.' }, { status: 503, headers })
  await writeAccountAuditEvent({ tenantId: access.tenantId, actorMembershipId: permission.context.membershipId, eventType: 'tenant_settings.signature_updated', metadata: { changed_fields: ['email_signature'] } })
  return NextResponse.json(signature, { headers })
}