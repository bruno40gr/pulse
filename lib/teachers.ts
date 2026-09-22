import { supabaseAdmin } from '@/lib/supabase/admin'
import { formatTeacherDisplayName, type PulseActor } from '@/lib/access'

export const HEADLINER_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export const ACTIVE_TEACHERS = [
  ['Alyssa', 'Abbott'],
  ['Bruno', 'Wong'],
  ['Cohen', 'Roden'],
  ['Collin', 'Franks'],
  ['David', 'James'],
  ['Drew', 'Johnson'],
  ['Isaias', 'Pallib'],
  ['Jacob', 'Rogelstad'],
  ['Jessica', 'Suase'],
  ['Josh', 'Brent'],
  ['Lorena', 'Rudha'],
  ['Marshall', 'James-Solano'],
  ['Mel', 'Solano-Rojas'],
  ['Noah', 'Campos'],
  ['Scott', 'Gaona'],
  ['Vitto', 'Trinchese'],
] as const

const activeTeacherKeys = new Set(ACTIVE_TEACHERS.map(([firstName, lastName]) => `${firstName.toLowerCase()}|${lastName.toLowerCase()}`))

type InstructorRow = {
  id: string
  person_id: string
  person: { id: string, first_name: string | null, last_name: string | null, custom_fields?: Record<string, unknown> | null } | Array<{ id: string, first_name: string | null, last_name: string | null, custom_fields?: Record<string, unknown> | null }> | null
}

export async function getActiveTeachers(): Promise<PulseActor[]> {
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
    .filter((teacher) => activeTeacherKeys.has(teacher.key) && teacher.isActive)
    .map(({ key, isActive, ...teacher }) => teacher)
    .sort((left, right) => left.fullName.localeCompare(right.fullName))
}