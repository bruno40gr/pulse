import { bandWritesEnabled, bandWorkspaceEnabled } from '@/lib/band-feature'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { supabaseAdmin } from '@/lib/supabase/admin'

const headers = { 'Cache-Control': 'private, no-store' }

/** Forming bands: their candidates are prospects, never confirmed members. */
export async function GET(request: Request) {
  if (!bandWorkspaceEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.leadsRead, allowDemo: false })
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status, headers })
  try {
    const groups: { id: string; name: string }[] = []
    for (let offset = 0; ; offset += 500) {
      const result = await crmSupabaseAdmin.from('band_tentative_groups').select('id,name').eq('tenant_id', access.tenantId).order('id').range(offset, offset + 499)
      if (result.error || !Array.isArray(result.data)) throw new Error('Groups unavailable')
      groups.push(...result.data)
      if (result.data.length < 500) break
    }

    // Candidates come from the linked opportunities, so a forming band holds the
    // same people as the opportunity they came from.
    const links: { band_id: string; lead_id: string }[] = []
    for (let offset = 0; ; offset += 500) {
      const result = await crmSupabaseAdmin.from('band_tentative_opportunities').select('band_id,lead_id')
        .eq('tenant_id', access.tenantId).order('band_id').range(offset, offset + 499)
      if (result.error || !Array.isArray(result.data)) throw new Error('Candidates unavailable')
      links.push(...result.data)
      if (result.data.length < 500) break
    }
    const leadIds = [...new Set(links.map(link => link.lead_id))]
    const personByLead = new Map<string, string>()
    for (let offset = 0; offset < leadIds.length; offset += 100) {
      const result = await crmSupabaseAdmin.from('lead_intakes').select('id,person_id')
        .eq('tenant_id', access.tenantId).in('id', leadIds.slice(offset, offset + 100))
      if (result.error || !Array.isArray(result.data)) throw new Error('Leads unavailable')
      for (const row of result.data) if (row.person_id) personByLead.set(row.id, row.person_id)
    }
    const personIds = [...new Set([...personByLead.values()])]
    const names = new Map<string, string>()
    for (let offset = 0; offset < personIds.length; offset += 100) {
      const result = await supabaseAdmin.from('people').select('id,first_name,last_name')
        .eq('tenant_id', access.tenantId).in('id', personIds.slice(offset, offset + 100))
      if (result.error || !Array.isArray(result.data)) throw new Error('People unavailable')
      for (const person of result.data) names.set(person.id, `${person.first_name || ''} ${person.last_name || ''}`.trim())
    }
    const members = new Map<string, { person_id: string; name: string }[]>()
    for (const link of links) {
      const personId = personByLead.get(link.lead_id)
      const name = personId ? names.get(personId) : null
      if (!personId || !name) continue
      const list = members.get(link.band_id) || []
      if (!list.some(member => member.person_id === personId)) list.push({ person_id: personId, name })
      members.set(link.band_id, list)
    }

    return Response.json({ groups: groups.map(group => ({
      ...group,
      member_count: (members.get(group.id) || []).length,
      members: (members.get(group.id) || []).sort((left, right) => left.name.localeCompare(right.name)),
    })) }, { headers })
  } catch { return Response.json({ error: 'Could not load tentative bands.' }, { status: 503, headers }) }
}

export async function POST(request: Request) {
  if (!bandWritesEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  let body: unknown
  try { body = await request.json() } catch { return Response.json({ error: 'Invalid request.' }, { status: 400, headers }) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'Invalid request.' }, { status: 400, headers })
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.leadsManage, allowDemo: false, body })
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status, headers })
  const name = (body as { name?: unknown }).name
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 200) return Response.json({ error: 'Enter a band name of up to 200 characters.' }, { status: 400, headers })
  try {
    const result = await crmSupabaseAdmin.from('band_tentative_groups').insert({ tenant_id: access.tenantId, name: name.trim() }).select('id,name').single()
    if (result.error?.code === '23505') return Response.json({ error: 'A tentative band with that name already exists. Reload the list to select it.' }, { status: 409, headers })
    if (result.error || !result.data?.id || !result.data?.name) throw new Error('Create failed')
    return Response.json({ group: result.data }, { status: 201, headers })
  } catch { return Response.json({ error: 'Could not create the tentative band.' }, { status: 503, headers }) }
}
