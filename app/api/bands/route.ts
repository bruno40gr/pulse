import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { bandWorkspaceEnabled } from '@/lib/band-feature'

const headers = { 'Cache-Control': 'private, no-store' }
const pageSize = 500

type EnrollmentRow = { id: string; student_id: string; service_type: string | null; session_name: string | null; custom_fields: Record<string, unknown> | null }

function bandName(enrollment: EnrollmentRow) {
  const labelled = enrollment.custom_fields?.band_name
  const name = typeof labelled === 'string' && labelled.trim() ? labelled.trim() : (enrollment.session_name || '').trim()
  // A band enrollment without a name is roster data we cannot attribute safely.
  return name || null
}

/** Read-only roster: enrolled band members, separate from tentative candidacies. */
export async function GET(request: Request) {
  if (!bandWorkspaceEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.contactsRead, allowDemo: false })
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status, headers })
  try {
    const enrollments: EnrollmentRow[] = []
    for (let offset = 0; ; offset += pageSize) {
      const result = await supabaseAdmin.from('enrollments')
        .select('id,student_id,service_type,session_name,custom_fields')
        .eq('tenant_id', access.tenantId).eq('service_type', 'band')
        .order('id').range(offset, offset + pageSize - 1)
      if (result.error || !Array.isArray(result.data)) throw new Error('Enrollments unavailable')
      enrollments.push(...result.data)
      if (result.data.length < pageSize) break
    }
    const studentIds = [...new Set(enrollments.map(row => row.student_id).filter(Boolean))]
    const students: { id: string; person_id: string; client_status: string | null }[] = []
    for (let offset = 0; offset < studentIds.length; offset += 100) {
      const result = await supabaseAdmin.from('students').select('id,person_id,client_status')
        .eq('tenant_id', access.tenantId).in('id', studentIds.slice(offset, offset + 100))
      if (result.error || !Array.isArray(result.data)) throw new Error('Students unavailable')
      students.push(...result.data)
    }
    const personIds = [...new Set(students.map(row => row.person_id).filter(Boolean))]
    const people: { id: string; first_name: string | null; last_name: string | null }[] = []
    for (let offset = 0; offset < personIds.length; offset += 100) {
      const result = await supabaseAdmin.from('people').select('id,first_name,last_name')
        .eq('tenant_id', access.tenantId).in('id', personIds.slice(offset, offset + 100))
      if (result.error || !Array.isArray(result.data)) throw new Error('People unavailable')
      people.push(...result.data)
    }
    if (students.length !== studentIds.length || people.length !== personIds.length) throw new Error('Incomplete roster')

    // Instructors can be band members in their own right, coached by another
    // instructor (for example La Paz). Staff are labelled, never filtered out.
    const staffPersonIds = new Set<string>()
    for (let offset = 0; ; offset += 500) {
      const result = await supabaseAdmin.from('instructors').select('person_id').eq('tenant_id', access.tenantId).order('id').range(offset, offset + 499)
      if (result.error || !Array.isArray(result.data)) throw new Error('Instructors unavailable')
      for (const row of result.data) if (row.person_id) staffPersonIds.add(row.person_id)
      if (result.data.length < 500) break
    }

    const studentById = new Map(students.map(row => [row.id, row]))
    const personById = new Map(people.map(row => [row.id, row]))
    const bands = new Map<string, { name: string; members: { person_id: string; name: string; client_status: string | null; is_staff: boolean }[] }>()
    for (const enrollment of enrollments) {
      const name = bandName(enrollment)
      const student = studentById.get(enrollment.student_id)
      const person = student ? personById.get(student.person_id) : undefined
      if (!name || !student || !person) continue
      const band = bands.get(name) || { name, members: [] }
      if (!band.members.some(member => member.person_id === person.id)) {
        band.members.push({ person_id: person.id, name: `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unnamed member', client_status: student.client_status, is_staff: staffPersonIds.has(person.id) })
      }
      bands.set(name, band)
    }
    const result = [...bands.values()]
      .map(band => ({ ...band, members: band.members.sort((left, right) => left.name.localeCompare(right.name)) }))
      .sort((left, right) => left.name.localeCompare(right.name))
    return Response.json({ bands: result }, { headers })
  } catch {
    return Response.json({ error: 'Could not load bands.' }, { status: 503, headers })
  }
}
