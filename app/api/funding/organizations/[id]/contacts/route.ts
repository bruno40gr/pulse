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
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Contact name is required.' }, { status: 400 })
    const { data: organization, error: organizationError } = await supabaseAdmin
      .from('funding_organizations').select('id').eq('tenant_id', access.tenantId).eq('id', id).is('archived_at', null).maybeSingle()
    if (organizationError) throw organizationError
    if (!organization) return NextResponse.json({ error: 'Funding organization not found.' }, { status: 404 })
    const { data, error } = await supabaseAdmin.from('funding_organization_contacts').insert({
      tenant_id: access.tenantId,
      funding_organization_id: id,
      name,
      role: typeof body.role === 'string' ? body.role.trim() || null : null,
      email: typeof body.email === 'string' ? body.email.trim() || null : null,
      phone: typeof body.phone === 'string' ? body.phone.trim() || null : null,
      notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
      contact_type: 'tenant_program_contact',
      created_by_membership_id: access.context.membershipId,
    }).select('id, name, role, email, phone').single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('[funding][organization-contacts][create]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}