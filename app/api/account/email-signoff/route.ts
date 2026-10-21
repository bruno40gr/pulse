import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { personalEmailSignoff } from '@/lib/personal-email-signoff'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'

const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { allowDemo: false })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  if (!access.context) return NextResponse.json({ error: 'Sign in to edit your email sign-off.' }, { status: 403, headers })
  try {
    const connection = await crmSupabaseAdmin.from('gmail_connections').select('id').eq('tenant_id', access.tenantId).limit(1)
    if (connection.error) throw new Error('Business email status unavailable.')
    if (!connection.data?.length) return NextResponse.json({ connected: false }, { headers })
    return NextResponse.json({ ...await personalEmailSignoff(access.tenantId, access.context.membershipId, access.context.personId), connected: true }, { headers })
  } catch {
    return NextResponse.json({ error: 'Your email sign-off could not be loaded.' }, { status: 503, headers })
  }
}

export async function PUT(request: Request) {
  const access = await authorizeTenantRequest(request, { allowDemo: false })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  if (!access.context) return NextResponse.json({ error: 'Sign in to edit your email sign-off.' }, { status: 403, headers })
  const body = await request.json().catch(() => null)
  if (!body || typeof body.name !== 'string' || typeof body.role !== 'string' || body.name.length > 200 || body.role.length > 200) return NextResponse.json({ error: 'Use a name and role of up to 200 characters each.' }, { status: 400, headers })
  const signoff = { name: body.name.trim(), role: body.role.trim() }
  const { data, error } = await supabaseAdmin.from('tenant_memberships').update({ email_signoff: signoff }).eq('tenant_id', access.tenantId).eq('id', access.context.membershipId).select('id').maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Your email sign-off could not be saved. Please try again later.' }, { status: 503, headers })
  return NextResponse.json(signoff, { headers })
}