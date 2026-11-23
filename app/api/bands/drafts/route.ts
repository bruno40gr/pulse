import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { bandWorkspaceEnabled, bandWritesEnabled } from '@/lib/band-feature'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { validBandCreationDraft } from '@/lib/band-creation-draft'

const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
  if (!bandWorkspaceEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.contactsRead, allowDemo: false })
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status, headers })
  const drafts = []
  for (let offset = 0; ; offset += 500) {
    const result = await supabaseAdmin.from('band_creation_drafts').select('id,revision,state')
      .eq('tenant_id', access.tenantId).is('completed_at', null).order('id').range(offset, offset + 499)
    if (result.error) return Response.json({ error: 'Band draft storage is unavailable. Apply the band drafts migration before creating bands.' }, { status: 503, headers })
    if ((result.data || []).some(row => !validBandCreationDraft(row.state))) return Response.json({ error: 'A saved band draft needs review before it can be opened.' }, { status: 503, headers })
    drafts.push(...(result.data || []))
    if ((result.data || []).length < 500) break
  }
  return Response.json({ drafts }, { headers })
}

export async function PUT(request: Request) {
  if (!bandWritesEnabled()) return Response.json({ error: 'Band writes are disabled.' }, { status: 404, headers })
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.contactsManage, allowDemo: false })
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status, headers })
  const raw = await request.text()
  if (raw.length > 200000) return Response.json({ error: 'Band draft is too large.' }, { status: 413, headers })
  let body
  try { body = JSON.parse(raw) } catch { return Response.json({ error: 'Invalid band draft.' }, { status: 400, headers }) }
  if (!validBandCreationDraft(body?.draft) || !Number.isSafeInteger(body.revision) || body.revision < 0
    || typeof body.complete !== 'boolean' || (body.complete && !body.draft.data.name.trim())) {
    return Response.json({ error: 'Invalid band draft or revision.' }, { status: 400, headers })
  }
  const result = await supabaseAdmin.rpc('save_band_creation_draft', { p_tenant: access.tenantId,
    p_actor: access.context!.membershipId, p_revision: body.revision, p_state: body.draft, p_complete: body.complete })
  if (result.error) return Response.json({ error: 'Band changes could not be saved. Check migrations, selected students and teacher; your draft remains open.' }, { status: 503, headers })
  if (result.data?.conflict) return Response.json({ error: 'Another staff member changed this draft. Reload before saving.' }, { status: 409, headers })
  return Response.json(result.data, { headers })
}