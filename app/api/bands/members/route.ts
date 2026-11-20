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

const MEMBERSHIPS = new Set(['prospect', 'pending', 'confirmed'])
function cleanMembership(value: unknown): string {
  return typeof value === 'string' && MEMBERSHIPS.has(value.trim()) ? value.trim() : 'confirmed'
}

function cleanInstruments(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const list = value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(item => item && item.length <= 60)
  return [...new Set(list)]
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
  const requestedMembership = typeof body?.membership === 'string' ? body.membership.trim() : null
  if (requestedMembership && !MEMBERSHIPS.has(requestedMembership)) return Response.json({ error: 'Choose a valid membership state.' }, { status: 400, headers })
  try {
    const person = await supabaseAdmin.from('people').select('id').eq('tenant_id', auth.tenantId).eq('id', auth.personId).maybeSingle()
    if (person.error || !person.data) return Response.json({ error: 'Choose an existing student.' }, { status: 400, headers })
    const instruments = cleanInstruments(body?.instruments)
    const single = cleanInstrument(body?.instrument) ?? instruments?.[0] ?? null
    const result = await supabaseAdmin.from('band_memberships')
      .upsert({ tenant_id: auth.tenantId, band_name: auth.band, person_id: auth.personId, instrument: single, instruments: instruments ?? (single ? [single] : null), membership: cleanMembership(body?.membership), source: 'staff added' }, { onConflict: 'tenant_id,band_name,person_id' })
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
  const requestedMembership = typeof body?.membership === 'string' ? body.membership.trim() : null
  if (requestedMembership && !MEMBERSHIPS.has(requestedMembership)) return Response.json({ error: 'Choose a valid membership state.' }, { status: 400, headers })
  const membershipValue = requestedMembership
  try {
    const instruments = cleanInstruments(body?.instruments)
    const patch: Record<string, unknown> = { instrument: instruments ? (instruments[0] ?? null) : instrument }
    if (instruments) patch.instruments = instruments
    if (membershipValue) patch.membership = membershipValue
    const membership = await supabaseAdmin.from('band_memberships')
      .update(patch).eq('tenant_id', auth.tenantId).eq('band_name', auth.band).eq('person_id', auth.personId).select('person_id')
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

/**
 * Remove a member from a band. This is destructive and deliberate: an explicit
 * membership is deleted and the band enrollment for this band is ended, so the
 * member leaves the band programme rather than only the list.
 */
export async function DELETE(request: Request) {
  if (!bandWorkspaceEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  const body = await readBody(request)
  const auth = await authorize(request, body)
  if (!auth.ok) return auth.response
  try {
    const membership = await supabaseAdmin.from('band_memberships').delete()
      .eq('tenant_id', auth.tenantId).eq('band_name', auth.band).eq('person_id', auth.personId).select('person_id')
    if (membership.error) throw membership.error
    let ended = 0

    const student = await supabaseAdmin.from('students').select('id').eq('tenant_id', auth.tenantId).eq('person_id', auth.personId).maybeSingle()
    if (student.error) throw student.error
    if (student.data) {
      const enrollments = await supabaseAdmin.from('enrollments')
        .select('id,custom_fields,instructor_person_id')
        .eq('tenant_id', auth.tenantId).eq('student_id', student.data.id).eq('service_type', 'band')
      if (enrollments.error) throw enrollments.error
      for (const row of enrollments.data || []) {
        const fields = row.custom_fields || {}
        if ((fields.band_name || '') !== auth.band) continue
        if (String(fields.status || '').toLowerCase() === 'ended') continue
        const result = await supabaseAdmin.from('enrollments')
          .update({ custom_fields: { ...fields, status: 'ended', ended_source: 'removed from band', ended_at: new Date().toISOString() } })
          .eq('id', row.id)
        if (result.error) throw result.error
        ended += 1
      }
    }

    if (!membership.data?.length && ended === 0) return Response.json({ error: 'That person is not in this band.' }, { status: 404, headers })
    return Response.json({ removed: true, endedEnrollments: ended }, { headers })
  } catch { return Response.json({ error: 'Could not remove that member.' }, { status: 503, headers }) }
}
