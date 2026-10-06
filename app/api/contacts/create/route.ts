import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: Request) {

  try {
    const body = await request.json()
    const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.contactsManage, body })
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const tenantId = access.tenantId
    const first_name = String(body.first_name ?? '').trim()
    const last_name = String(body.last_name ?? '').trim()

    if (!first_name || !last_name) {
      return NextResponse.json({ error: 'First and last name are required.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('people')
      .insert({
        tenant_id: tenantId,
        first_name,
        last_name,
        phone: body.phone ? String(body.phone).trim() : null,
        email: body.email ? String(body.email).trim() : null,
        custom_fields: {},
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
