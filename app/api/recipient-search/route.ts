import { PERMISSIONS } from '@/lib/permissions'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.contactsRead, allowDemo: true })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const tenantId = access.tenantId
  const url = new URL(request.url)
  const q = (url.searchParams.get('q') || '').trim()
  const staffOnly = url.searchParams.get('staff') === '1' || url.searchParams.get('staff') === 'true'

  try {
    let query = supabaseAdmin
      .from('people')
      .select('id, first_name, last_name, phone, email')
      .eq('tenant_id', tenantId)

    if (staffOnly) {
      // Instructors are `people` rows linked via the `instructors` table.
      const { data: instructorRows } = await supabaseAdmin
        .from('instructors')
        .select('person_id')
        .eq('tenant_id', tenantId)
      const personIds = (instructorRows || []).map((i: any) => i.person_id).filter(Boolean)
      if (personIds.length === 0) return NextResponse.json([])
      query = query
        .in('id', personIds)
        .or('custom_fields->>staff_status.is.null,custom_fields->>staff_status.neq.sunset')
    }

    if (q) {
      query = query
        .or(`first_name.ilike.*${q}*,last_name.ilike.*${q}*,phone.ilike.*${q}*,email.ilike.*${q}*`)
        .limit(50)
    } else {
      query = query.order('last_name', { ascending: true }).limit(500)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
