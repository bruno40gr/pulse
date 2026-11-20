import { bandWritesEnabled, bandWorkspaceEnabled } from '@/lib/band-feature'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'

const headers = { 'Cache-Control': 'private, no-store' }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const bandName = /^[\s\S]{1,200}$/

async function readBody(request: Request) {
  try { const body = await request.json(); return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null } catch { return null }
}

async function authorize(request: Request, body: Record<string, unknown> | null) {
  if (!bandWritesEnabled()) return { ok: false as const, response: Response.json({ error: 'Not found.' }, { status: 404, headers }) }
  if (!body) return { ok: false as const, response: Response.json({ error: 'Invalid request.' }, { status: 400, headers }) }
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.contactsManage, allowDemo: false, body })
  if (!access.ok) return { ok: false as const, response: Response.json({ error: access.error }, { status: access.status, headers }) }
  const band = body.band
  const personId = body.person_id
  if (typeof band !== 'string' || !bandName.test(band) || !band.trim() || typeof personId !== 'string' || !uuid.test(personId)) {
    return { ok: false as const, response: Response.json({ error: 'Choose a band and a student.' }, { status: 400, headers }) }
  }
  return { ok: true as const, tenantId: access.tenantId, band: band.trim(), personId }
}

function cleanInstrument(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text && text.length <= 60 ? text : null
}

/** Add a member to a band. Enrolled members keep their lesson instrument. */
export async function POST(request: Request) {
  if (!bandWorkspaceEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  const body = await readBody(request)
  const auth = await authorize(request, body)
  if (!auth.ok) return auth.response
  try {
    const person = await supabaseAdmin.from('people').select('id').eq('tenant_id', auth.tenantId).eq('id', auth.personId).maybeSingle()
    if (person.error || !person.data) return Response.json({ error: 'Choose an existing student.' }, { status: 400, headers })
    const result = await supabaseAdmin.from('band_memberships')
      .upsert({ tenant_id: auth.tenantId, band_name: auth.band, person_id: auth.personId, instrument: cleanInstrument(body?.instrument), membership: 'confirmed', source: 'staff added' }, { onConflict: 'tenant_id,band_name,person_id' })
    if (result.error) throw result.error
    return Response.json({ added: true }, { status: 201, headers })
  } catch { return Response.json({ error: 'Could not add that member.' }, { status: 503, headers }) }
}

/** Set the instrument a member plays in this band. */
export async function PATCH(request: Request) {
  if (!bandWorkspaceEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  const body = await readBody(request)
  const auth = await authorize(request, body)
  if (!auth.ok) return auth.response
  const instrument = cleanInstrument(body?.instrument)
  try {
    const membership = await supabaseAdmin.from('band_memberships')
      .update({ instrument }).eq('tenant_id', auth.tenantId).eq('band_name', auth.band).eq('person_id', auth.personId).select('person_id')
    if (membership.error) throw membership.error
    if (!membership.data?.length) {
      // An enrolled member has no explicit row: store the band instrument on the enrollment.
      const student = await supabaseAdmin.from('students').select('id').eq('tenant_id', auth.tenantId).eq('person_id', auth.personId).maybeSingle()
      if (student.error || !student.data) return Response.json({ error: 'Member not found in this band.' }, { status: 404, headers })
      const enrollment = await supabaseAdmin.from('enrollments').select('id,custom_fields').eq('tenant_id', auth.tenantId).eq('student_id', student.data.id).eq('service_type', 'band')
      if (enrollment.error || !enrollment.data?.length) return Response.json({ error: 'Member not found in this band.' }, { status: 404, headers })
      const row = enrollment.data.find(entry => (entry.custom_fields?.band_name || '') === auth.band) || enrollment.data[0]
      const updated = await supabaseAdmin.from('enrollments')
        .update({ custom_fields: { ...(row.custom_fields || {}), band_instrument: instrument } }).eq('id', row.id)
      if (updated.error) throw updated.error
    }
    return Response.json({ saved: true }, { headers })
  } catch { return Response.json({ error: 'Could not save that instrument.' }, { status: 503, headers }) }
}

/** Remove an explicit membership. Enrollments are never deleted here. */
export async function DELETE(request: Request) {
  if (!bandWorkspaceEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  const body = await readBody(request)
  const auth = await authorize(request, body)
  if (!auth.ok) return auth.response
  try {
    const result = await supabaseAdmin.from('band_memberships').delete()
      .eq('tenant_id', auth.tenantId).eq('band_name', auth.band).eq('person_id', auth.personId).select('person_id')
    if (result.error) throw result.error
    if (!result.data?.length) return Response.json({ error: 'An enrolled member is removed from their enrollment, not from this list.' }, { status: 409, headers })
    return Response.json({ removed: true }, { headers })
  } catch { return Response.json({ error: 'Could not remove that member.' }, { status: 503, headers }) }
}
