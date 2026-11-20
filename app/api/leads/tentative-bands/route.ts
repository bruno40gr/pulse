import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { bandWritesEnabled, bandWorkspaceEnabled } from '@/lib/band-feature'

const headers = { 'Cache-Control': 'private, no-store' }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  if (!bandWorkspaceEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.leadsRead, allowDemo: false })
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status, headers })
  const ids = new URL(request.url).searchParams.getAll('lead_id')
  if (!ids.length || ids.length > 100 || new Set(ids).size !== ids.length || ids.some(id => !uuid.test(id))) {
    return Response.json({ error: 'Select up to 100 distinct opportunities.' }, { status: 400, headers })
  }
  try {
    const links: { lead_id: string; band_id: string }[] = []
    for (let offset = 0; ; offset += 500) {
      const result = await crmSupabaseAdmin.from('band_tentative_opportunities').select('lead_id,band_id').eq('tenant_id', access.tenantId).in('lead_id', ids).order('lead_id').order('band_id').range(offset, offset + 499)
      if (result.error || !Array.isArray(result.data)) throw new Error('Associations unavailable')
      links.push(...result.data)
      if (result.data.length < 500) break
    }
    const bandIds: string[] = [...new Set<string>(links.map(row => row.band_id))]
    if (!bandIds.length) return Response.json({ associations: [] }, { headers })
    const names = new Map<string, string>()
    for (let offset = 0; offset < bandIds.length; offset += 100) {
      const groups = await crmSupabaseAdmin.from('band_tentative_groups').select('id,name').eq('tenant_id', access.tenantId).in('id', bandIds.slice(offset, offset + 100))
      if (groups.error || !Array.isArray(groups.data)) throw new Error('Groups unavailable')
      for (const row of groups.data) names.set(row.id, row.name)
    }
    if (bandIds.some(id => !names.has(id))) throw new Error('Incomplete groups')
    return Response.json({ associations: links.map(row => ({ lead_id: row.lead_id, band_id: row.band_id, name: names.get(row.band_id) })) }, { headers })
  } catch {
    return Response.json({ error: 'Could not load tentative bands.' }, { status: 503, headers })
  }
}

export async function PUT(request: Request) {
  if (!bandWritesEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  let body: unknown
  try { body = await request.json() } catch { return Response.json({ error: 'Invalid request.' }, { status: 400, headers }) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'Invalid request.' }, { status: 400, headers })
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.leadsManage, allowDemo: false, body })
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status, headers })
  const { lead_id: leadId, band_ids: bandIds } = body as { lead_id?: unknown; band_ids?: unknown }
  if (typeof leadId !== 'string' || !uuid.test(leadId) || !Array.isArray(bandIds) || bandIds.length > 100 || new Set(bandIds).size !== bandIds.length || bandIds.some(id => typeof id !== 'string' || !uuid.test(id))) {
    return Response.json({ error: 'Invalid opportunity or band selection.' }, { status: 400, headers })
  }
  try {
    const result = await crmSupabaseAdmin.rpc('set_band_tentative_opportunities', { p_tenant: access.tenantId, p_lead: leadId, p_band_ids: bandIds })
    if (result.error || result.data !== bandIds.length) throw new Error('Update failed')
    return Response.json({ saved: result.data }, { headers })
  } catch {
    return Response.json({ error: 'Could not update tentative bands.' }, { status: 503, headers })
  }
}