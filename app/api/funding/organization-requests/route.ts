import { NextResponse } from 'next/server'
import { PERMISSIONS } from '@/lib/permissions'
import { authorizeFunding } from '@/lib/funding/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

function object(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export async function POST(request: Request) {
  try {
    const access = await authorizeFunding(request, PERMISSIONS.fundingManage)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const body = object(await request.json())
    const requestedName = typeof body.requested_name === 'string' ? body.requested_name.trim() : ''
    const context = typeof body.context === 'string' ? body.context.trim() : ''
    if (!requestedName) return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 })
    const { data, error } = await supabaseAdmin.from('funding_organization_requests').insert({
      tenant_id: access.tenantId,
      requested_name: requestedName,
      context: context || null,
      requested_by_membership_id: access.context.membershipId,
    }).select('id, requested_name, status, created_at').single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('[funding][organization-requests][create]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}