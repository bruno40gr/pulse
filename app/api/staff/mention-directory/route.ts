import { NextResponse } from 'next/server'
import { PERMISSIONS } from '@/lib/permissions'
import { requirePermission } from '@/lib/request-context'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const tenantId = url.searchParams.get('tenant') || DEFAULT_TENANT_ID
    const permission = await requirePermission(request, tenantId, PERMISSIONS.notesRead)
    if (!permission.ok) return NextResponse.json({ error: permission.error }, { status: permission.status })
    const query = (url.searchParams.get('q') || '').trim().toLowerCase()

    const { data, error } = await supabaseAdmin
      .from('tenant_memberships')
      .select('id, status, person:people!inner(id, first_name, last_name, email)')
      .eq('tenant_id', tenantId)
      .in('status', ['unclaimed', 'invited', 'active'])
      .order('created_at', { ascending: true })
    if (error) throw error

    const members = (data || []).map((row) => {
      const personValue = row.person as unknown
      const person = (Array.isArray(personValue) ? personValue[0] : personValue) as { id: string; first_name: string | null; last_name: string | null; email: string | null } | null
      return {
        membership_id: row.id,
        person_id: person?.id || null,
        first_name: person?.first_name || null,
        last_name: person?.last_name || null,
        email: person?.email || null,
      }
    }).filter((member) => {
      if (!query) return true
      return `${member.first_name || ''} ${member.last_name || ''} ${member.email || ''}`.toLowerCase().includes(query)
    }).slice(0, 12)

    return NextResponse.json(members)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}