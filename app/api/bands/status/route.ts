import { bandWritesEnabled, bandWorkspaceEnabled } from '@/lib/band-feature'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'

const headers = { 'Cache-Control': 'private, no-store' }
const allowed = new Set(['active', 'forming', 'external', 'archived'])

/** Archive or restore a band. History is never deleted. */
export async function POST(request: Request) {
  if (!bandWorkspaceEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  if (!bandWritesEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  let body: Record<string, unknown> | null = null
  try { const parsed = await request.json(); body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null } catch { body = null }
  if (!body) return Response.json({ error: 'Invalid request.' }, { status: 400, headers })
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.contactsManage, allowDemo: false, body })
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status, headers })
  const band = typeof body.band === 'string' ? body.band.trim() : ''
  const status = typeof body.status === 'string' ? body.status.trim() : ''
  if (!band || band.length > 200 || !allowed.has(status)) return Response.json({ error: 'Choose a band and a status.' }, { status: 400, headers })
  try {
    const result = await supabaseAdmin.from('band_profiles').upsert({ tenant_id: access.tenantId, band_name: band, status, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id,band_name' })
    if (result.error) throw result.error
    return Response.json({ saved: true }, { headers })
  } catch { return Response.json({ error: 'Could not update that band.' }, { status: 503, headers }) }
}
