import { bandWritesEnabled, bandWorkspaceEnabled } from '@/lib/band-feature'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'

const headers = { 'Cache-Control': 'private, no-store' }
const allowed = new Set(['draft', 'active', 'forming', 'external', 'archived'])

async function guard(request: Request) {
  if (!bandWorkspaceEnabled() || !bandWritesEnabled()) return { ok: false as const, response: Response.json({ error: 'Not found.' }, { status: 404, headers }) }
  let body: Record<string, unknown> | null = null
  try { const parsed = await request.json(); body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null } catch { body = null }
  if (!body) return { ok: false as const, response: Response.json({ error: 'Invalid request.' }, { status: 400, headers }) }
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.contactsManage, allowDemo: false, body })
  if (!access.ok) return { ok: false as const, response: Response.json({ error: access.error }, { status: access.status, headers }) }
  const band = typeof body.band === 'string' ? body.band.trim() : ''
  if (!band || band.length > 200) return { ok: false as const, response: Response.json({ error: 'Choose a band.' }, { status: 400, headers }) }
  return { ok: true as const, tenantId: access.tenantId, band, body }
}

const text = (value: unknown, limit: number) => {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed && trimmed.length <= limit ? trimmed : null
}

/** Edit band details; renaming also moves memberships and band enrollments. */
export async function PATCH(request: Request) {
  const guardResult = await guard(request)
  if (!guardResult.ok) return guardResult.response
  const { tenantId, band, body } = guardResult
  const requestedName = text(body.name, 200)
  const status = typeof body.status === 'string' ? body.status.trim() : null
  if (status && !allowed.has(status)) return Response.json({ error: 'Choose a valid status.' }, { status: 400, headers })
  try {
    let currentBand = band
    if (requestedName && requestedName.toLowerCase() !== band.toLowerCase()) {
      const renamed = await supabaseAdmin.rpc('rename_band', { p_tenant: tenantId, p_old: band, p_new: requestedName })
      if (renamed.error) {
        const message = String(renamed.error.message || '')
        return Response.json({ error: message.includes('already exists') ? 'A band with that name already exists.' : 'Could not rename that band.' }, { status: message.includes('already exists') ? 409 : 503, headers })
      }
      currentBand = requestedName
    }
    const patch: Record<string, unknown> = { tenant_id: tenantId, band_name: currentBand, updated_at: new Date().toISOString() }
    if (status) patch.status = status
    if ('schedule' in body) patch.schedule = text(body.schedule, 400)
    if ('image_url' in body) patch.image_url = text(body.image_url, 2000)
    const saved = await supabaseAdmin.from('band_profiles').upsert(patch, { onConflict: 'tenant_id,band_name' })
    if (saved.error) throw saved.error
    return Response.json({ band: currentBand }, { headers })
  } catch { return Response.json({ error: 'Could not save that band.' }, { status: 503, headers }) }
}

/** Deleting a band archives it; enrollment history is never destroyed. */
export async function DELETE(request: Request) {
  const guardResult = await guard(request)
  if (!guardResult.ok) return guardResult.response
  const { tenantId, band } = guardResult
  try {
    const result = await supabaseAdmin.from('band_profiles')
      .upsert({ tenant_id: tenantId, band_name: band, status: 'archived', updated_at: new Date().toISOString() }, { onConflict: 'tenant_id,band_name' })
    if (result.error) throw result.error
    return Response.json({ archived: true }, { headers })
  } catch { return Response.json({ error: 'Could not delete that band.' }, { status: 503, headers }) }
}
