import { supabaseAdmin } from '@/lib/supabase/admin'
import { formatTeacherDisplayName, type PulseActor } from '@/lib/access'

export const HEADLINER_TENANT_ID = '00000000-0000-0000-0000-000000000001'
const HEADLINER_TIME_ZONE = 'America/Los_Angeles'

/**
 * The sign-in roster is derived from the database (instructors joined to people),
 * never from a hardcoded name list. A name list silently drops a staff member the
 * moment their person row is edited — for example "Drew Johnson" stored as
 * first_name "Andrew" / last_name "Dylan Johnson" — which removes them from the
 * picker and locks them out of the product entirely.
 *
 * This map is the only override: staff who should not appear until a given date
 * (Headliner local time). Keys are normalized "first last". Anyone not listed here
 * is available immediately, so a data edit can never hide someone by accident.
 */
const TEACHER_START_DATES: Record<string, string> = {
  'alex bird': '2026-10-05',
}

function normalizeTeacherKey(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim().toLowerCase().replace(/\s+/g, ' ')
}

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
        key: normalizeTeacherKey(firstName, lastName),
        isActive: (person?.custom_fields?.staff_status ?? 'active') !== 'sunset',
      }
    })
    .filter((teacher) => {
      if (!teacher.isActive) return false
      const startsOn = TEACHER_START_DATES[teacher.key]
      return !startsOn || startsOn <= today
    })
    .map(teacher => ({
      instructorId: teacher.instructorId,
      personId: teacher.personId,
      fullName: teacher.fullName,
      displayName: teacher.displayName,
    }))
    .sort((left, right) => left.fullName.localeCompare(right.fullName))
}
