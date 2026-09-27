import { supabaseAdmin } from '@/lib/supabase/admin'
import { formatTeacherDisplayName, type PulseActor } from '@/lib/access'

export const HEADLINER_TENANT_ID = '00000000-0000-0000-0000-000000000001'
const HEADLINER_TIME_ZONE = 'America/Los_Angeles'

export const ACTIVE_TEACHERS = [
  { firstName: 'Alyssa', lastName: 'Abbott' },
  { firstName: 'Bruno', lastName: 'Wong' },
  { firstName: 'Cohen', lastName: 'Roden' },
  { firstName: 'Collin', lastName: 'Franks' },
  { firstName: 'David', lastName: 'James' },
  { firstName: 'Drew', lastName: 'Johnson' },
  { firstName: 'Isaias', lastName: 'Pallib' },
  { firstName: 'Jacob', lastName: 'Rogelstad' },
  { firstName: 'Jessica', lastName: 'Suase' },
  { firstName: 'Josh', lastName: 'Brent' },
  { firstName: 'Lorena', lastName: 'Rudha' },
  { firstName: 'Mae', lastName: 'Strider' },
  { firstName: 'Marshall', lastName: 'James-Solano' },
  { firstName: 'Mel', lastName: 'Solano-Rojas' },
  { firstName: 'Noah', lastName: 'Campos' },
  { firstName: 'Scott', lastName: 'Gaona' },
  { firstName: 'Vitto', lastName: 'Trinchese' },
  { firstName: 'Alex', lastName: 'Bird', startsOn: '2026-10-05' },
] as const

const teacherEligibilityByKey = new Map(ACTIVE_TEACHERS.map(teacher => [
  `${teacher.firstName.toLowerCase()}|${teacher.lastName.toLowerCase()}`,
  'startsOn' in teacher ? teacher.startsOn : null,
]))

function currentHeadlinerDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HEADLINER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

type InstructorRow = {
  id: string
  person_id: string
  person: { id: string, first_name: string | null, last_name: string | null, custom_fields?: Record<string, unknown> | null } | Array<{ id: string, first_name: string | null, last_name: string | null, custom_fields?: Record<string, unknown> | null }> | null
}

export async function getActiveTeachers(): Promise<PulseActor[]> {
  const today = currentHeadlinerDate()
  const { data, error } = await supabaseAdmin
    .from('instructors')
    .select('id, person_id, person:people(id, first_name, last_name, custom_fields)')
    .eq('tenant_id', HEADLINER_TENANT_ID)

  if (error) throw error

  return ((data || []) as InstructorRow[])
    .map((row) => {
      const person = Array.isArray(row.person) ? row.person[0] : row.person
      const firstName = person?.first_name?.trim() || ''
      const lastName = person?.last_name?.trim() || ''
      return {
        instructorId: row.id,
        personId: row.person_id,
        fullName: `${firstName} ${lastName}`.trim(),
        displayName: formatTeacherDisplayName(firstName, lastName),
        key: `${firstName.toLowerCase()}|${lastName.toLowerCase()}`,
        isActive: (person?.custom_fields?.staff_status ?? 'active') !== 'sunset',
      }
    })
    .filter((teacher) => {
      const startsOn = teacherEligibilityByKey.get(teacher.key)
      return startsOn !== undefined && teacher.isActive && (!startsOn || startsOn <= today)
    })
    .map(teacher => ({
      instructorId: teacher.instructorId,
      personId: teacher.personId,
      fullName: teacher.fullName,
      displayName: teacher.displayName,
    }))
    .sort((left, right) => left.fullName.localeCompare(right.fullName))
}
