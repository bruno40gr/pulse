import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { bandWritesEnabled, bandWorkspaceEnabled } from '@/lib/band-feature'

const headers = { 'Cache-Control': 'private, no-store' }
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
    return Response.json({ groups }, { headers })
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