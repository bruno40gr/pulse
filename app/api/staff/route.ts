import { PERMISSIONS } from '@/lib/permissions'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.staffRead, allowDemo: true })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const tenantId = access.tenantId
  try {
    // Actual schema: instructors table (id, tenant_id, person_id, specialty)
    const { data, error } = await supabaseAdmin
      .from('instructors')
      .select(`
        id, specialty, created_at,
        person:people (
          id, first_name, last_name, phone, email, date_of_birth, custom_fields
        )
      `)
      .eq('tenant_id', tenantId)

    if (error) throw error

    const staff = (data || []).map((s: any) => {
      const person = Array.isArray(s.person) ? s.person[0] : s.person
      return {
        id: s.id,
        role: 'instructor',
        is_active: (person?.custom_fields?.staff_status ?? 'active') !== 'sunset',
        created_at: s.created_at,
        person_id: person?.id ?? null,
        first_name: person?.first_name ?? null,
        last_name: person?.last_name ?? null,
        phone: person?.phone ?? null,
        email: person?.email ?? null,
        date_of_birth: person?.date_of_birth ?? null,
      }
    })

    return NextResponse.json(staff)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
