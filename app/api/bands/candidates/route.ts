import { bandWorkspaceEnabled } from '@/lib/band-feature'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { supabaseAdmin } from '@/lib/supabase/admin'

const headers = { 'Cache-Control': 'private, no-store' }

/**
 * Students seeking a band: open Band opportunities about a real person. They are
 * prospects for any band, and for more than one band at a time.
 */
export async function GET(request: Request) {
  if (!bandWorkspaceEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.contactsRead, allowDemo: false })
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status, headers })
  try {
    const personIds: string[] = []
    for (let offset = 0; ; offset += 500) {
      const result = await crmSupabaseAdmin.from('lead_intakes')
        .select('person_id')
        .eq('tenant_id', access.tenantId)
        .eq('payload->>service_type', 'band')
        .not('person_id', 'is', null)
        .not('status', 'in', '(won,lost,ghosted_us,ghosted,spam)')
        .order('person_id')
        .range(offset, offset + 499)
      if (result.error || !Array.isArray(result.data)) throw new Error('Prospects unavailable')
      for (const row of result.data) if (row.person_id && !personIds.includes(row.person_id)) personIds.push(row.person_id)
      if (result.data.length < 500) break
    }
    const prospects: { person_id: string; name: string }[] = []
    for (let offset = 0; offset < personIds.length; offset += 100) {
      const result = await supabaseAdmin.from('people').select('id,first_name,last_name')
        .eq('tenant_id', access.tenantId).in('id', personIds.slice(offset, offset + 100))
      if (result.error || !Array.isArray(result.data)) throw new Error('People unavailable')
      for (const person of result.data) prospects.push({ person_id: person.id, name: `${person.first_name || ''} ${person.last_name || ''}`.trim() })
    }
    return Response.json({ prospects: prospects.filter(prospect => prospect.name).sort((left, right) => left.name.localeCompare(right.name)) }, { headers })
  } catch { return Response.json({ error: 'Could not load students seeking a band.' }, { status: 503, headers }) }
}
