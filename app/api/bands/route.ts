import { bandWorkspaceEnabled } from '@/lib/band-feature'
import { assembleBandRoster, type RosterRow } from '@/lib/band-roster'
import { isCurrentEnrollment } from '@/lib/current-enrollment'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'

const headers = { 'Cache-Control': 'private, no-store' }
const pageSize = 500

type EnrollmentRow = {
  id: string
  student_id: string
  service_type: string | null
  session_name: string | null
  custom_fields: Record<string, unknown> | null
  instructor_person_id: string | null
  instrument: string | null
}

/** Read-only roster: enrolled band members (including instructors who play), separate from tentative candidacies. */
export async function GET(request: Request) {
  if (!bandWorkspaceEnabled()) return Response.json({ error: 'Not found.' }, { status: 404, headers })
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.contactsRead, allowDemo: false })
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status, headers })
  try {
    const enrollments: EnrollmentRow[] = []
    for (let offset = 0; ; offset += pageSize) {
      const result = await supabaseAdmin.from('enrollments')
        .select('id,student_id,service_type,session_name,custom_fields,instructor_person_id,instrument')
        .eq('tenant_id', access.tenantId).eq('service_type', 'band')
        .order('id').range(offset, offset + pageSize - 1)
      if (result.error || !Array.isArray(result.data)) throw new Error('Enrollments unavailable')
      enrollments.push(...result.data)
      if (result.data.length < pageSize) break
    }

    const activeEnrollments = enrollments.filter(row => isCurrentEnrollment(row))
    const studentIds = [...new Set(activeEnrollments.map(row => row.student_id).filter(Boolean))]
    const students: { id: string; person_id: string; client_status: string | null }[] = []
    for (let offset = 0; offset < studentIds.length; offset += 100) {
      const result = await supabaseAdmin.from('students').select('id,person_id,client_status')
        .eq('tenant_id', access.tenantId).in('id', studentIds.slice(offset, offset + 100))
      if (result.error || !Array.isArray(result.data)) throw new Error('Students unavailable')
      students.push(...result.data)
    }

    // Members, coaches and staff all resolve to person rows.
    const personIds = new Set<string>()
    for (const student of students) if (student.person_id) personIds.add(student.person_id)
    for (const enrollment of enrollments) if (enrollment.instructor_person_id) personIds.add(enrollment.instructor_person_id)
    for (let offset = 0; ; offset += 500) {
      const result = await supabaseAdmin.from('band_memberships').select('person_id').eq('tenant_id', access.tenantId).order('person_id').range(offset, offset + 499)
      if (result.error || !Array.isArray(result.data)) throw new Error('Memberships unavailable')
      for (const row of result.data) if (row.person_id) personIds.add(row.person_id)
      if (result.data.length < 500) break
    }
    const people: { id: string; first_name: string | null; last_name: string | null }[] = []
    const personIdList = [...personIds]
    for (let offset = 0; offset < personIdList.length; offset += 100) {
      const result = await supabaseAdmin.from('people').select('id,first_name,last_name')
        .eq('tenant_id', access.tenantId).in('id', personIdList.slice(offset, offset + 100))
      if (result.error || !Array.isArray(result.data)) throw new Error('People unavailable')
      people.push(...result.data)
    }
    if (students.length !== studentIds.length || people.length !== personIdList.length) throw new Error('Incomplete roster')

    const staffPersonIds = new Set<string>()
    for (let offset = 0; ; offset += 500) {
      const result = await supabaseAdmin.from('instructors').select('person_id').eq('tenant_id', access.tenantId).order('id').range(offset, offset + 499)
      if (result.error || !Array.isArray(result.data)) throw new Error('Instructors unavailable')
      for (const row of result.data) if (row.person_id) staffPersonIds.add(row.person_id)
      if (result.data.length < 500) break
    }

    const studentById = new Map(students.map(row => [row.id, row]))
    const personById = new Map(people.map(row => [row.id, row]))
    const displayName = (id: string | null) => {
      const person = id ? personById.get(id) : undefined
      return person ? `${person.first_name || ''} ${person.last_name || ''}`.trim() || null : null
    }

    const rows: RosterRow[] = activeEnrollments.map(enrollment => {
      const student = studentById.get(enrollment.student_id)
      const memberId = student?.person_id ?? null
      const labelled = enrollment.custom_fields?.band_name
      return {
        band_name: typeof labelled === 'string' ? labelled : null,
        session_name: enrollment.session_name,
        member_id: memberId,
        member_name: displayName(memberId),
        member_status: student?.client_status ?? null,
        member_instruments: Array.isArray(enrollment.custom_fields?.band_instruments)
          ? (enrollment.custom_fields.band_instruments as string[])
          : typeof enrollment.custom_fields?.band_instrument === 'string' ? [enrollment.custom_fields.band_instrument]
            : enrollment.instrument ? [enrollment.instrument] : [],
        member_membership: 'confirmed',
        member_source: 'enrollment' as const,
        member_is_staff: Boolean(memberId && staffPersonIds.has(memberId)),
        coach_id: enrollment.instructor_person_id,
        coach_name: displayName(enrollment.instructor_person_id),
      }
    })

    // Explicit memberships cover people no enrollment row captures.
    const explicit: RosterRow[] = []
    for (let offset = 0; ; offset += 500) {
      const result = await supabaseAdmin.from('band_memberships').select('band_name,person_id,instrument,instruments,membership')
        .eq('tenant_id', access.tenantId).order('band_name').range(offset, offset + 499)
      if (result.error || !Array.isArray(result.data)) throw new Error('Memberships unavailable')
      for (const row of result.data) {
        const name = displayName(row.person_id)
        if (!name) throw new Error('Membership person missing')
        explicit.push({ band_name: row.band_name, session_name: row.band_name, member_id: row.person_id, member_name: name, member_status: null, member_instruments: Array.isArray(row.instruments) && row.instruments.length ? row.instruments : (row.instrument ? [row.instrument] : []), member_membership: row.membership || 'confirmed', member_source: 'membership' as const, coach_id: null, coach_name: null })
      }
      if (result.data.length < 500) break
    }

    // Rehearsal-space clients name their booking and are not academy ensembles;
    // archived bands keep their history but leave the working roster.
    type ProfileRow = { band_name: string; status: string; schedule: string | null; image_url: string | null; coach_person_id?: string | null }
    const profiles = new Map<string, { status: string; schedule: string | null; image_url: string | null; coachPersonId: string | null }>()
    let profileRead: { data: unknown; error: { message?: string } | null } = await supabaseAdmin.from('band_profiles').select('band_name,status,schedule,image_url,coach_person_id').eq('tenant_id', access.tenantId)
    // The coach column ships with its migration; the roster still loads without it.
    if (profileRead.error) profileRead = await supabaseAdmin.from('band_profiles').select('band_name,status,schedule,image_url').eq('tenant_id', access.tenantId)
    const profileRows = (!profileRead.error && Array.isArray(profileRead.data) ? profileRead.data : []) as ProfileRow[]
    const coachIds = [...new Set(profileRows.map(row => row.coach_person_id).filter(Boolean))] as string[]
    const coachNames = new Map<string, string>()
    if (coachIds.length) {
      const coaches = await supabaseAdmin.from('people').select('id,first_name,last_name').eq('tenant_id', access.tenantId).in('id', coachIds)
      if (!coaches.error && Array.isArray(coaches.data)) for (const person of coaches.data) {
        const name = `${person.first_name || ''} ${person.last_name || ''}`.trim()
        if (name) coachNames.set(person.id, name)
      }
    }
    for (const row of profileRows) profiles.set(row.band_name, { status: row.status, schedule: row.schedule ?? null, image_url: row.image_url ?? null, coachPersonId: row.coach_person_id ?? null })

    const bands = assembleBandRoster([...rows, ...explicit])
      .filter(band => !['external', 'archived'].includes(profiles.get(band.name)?.status || 'active'))
      .map(band => ({
        ...band,
        // An enrolment instructor is the teacher; the band assignment covers a band without lessons.
        coach: band.coach || coachNames.get(profiles.get(band.name)?.coachPersonId || '') || null,
        status: profiles.get(band.name)?.status || 'active',
        schedule: profiles.get(band.name)?.schedule ?? null,
        image_url: profiles.get(band.name)?.image_url ?? null,
      }))

    // A band with no members yet is not in the assembled roster, so its profile is
    // the only record of it. Drafts and newly created bands both stay visible.
    const known = new Set(bands.map(band => band.name))
    for (const [name, profile] of profiles) {
      if (known.has(name) || ['external', 'archived'].includes(profile.status)) continue
      bands.push({ name, coach: coachNames.get(profile.coachPersonId || '') || null, members: [], status: profile.status, schedule: profile.schedule, image_url: profile.image_url })
    }
    bands.sort((left, right) => left.name.localeCompare(right.name))
    return Response.json({ bands }, { headers })
  } catch {
    return Response.json({ error: 'Could not load bands.' }, { status: 503, headers })
  }
}
