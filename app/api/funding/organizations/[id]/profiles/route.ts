import { NextResponse } from 'next/server'
import { PERMISSIONS } from '@/lib/permissions'
import { authorizeFunding } from '@/lib/funding/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

function object(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await authorizeFunding(request, PERMISSIONS.fundingManage)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const { id } = await params
    const body = object(await request.json())
    const changeNote = typeof body.change_note === 'string' ? body.change_note.trim() : ''
    if (!changeNote) return NextResponse.json({ error: 'Explain what changed in this profile version.' }, { status: 400 })
    const { data, error } = await supabaseAdmin.rpc('odeon_create_funding_profile_version', {
      p_tenant_id: access.tenantId,
      p_funding_organization_id: id,
      p_profile: object(body.profile),
      p_change_note: changeNote,
      p_membership_id: access.context.membershipId,
    })
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('[funding][profiles][create]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}