import type { SetupRecord } from '@/beta-source/app/content-studio-prototype/school-setup/setup-content'
import { validateTeacherExceptions } from '@/beta-source/app/content-studio-prototype/school-setup/setup-content'

export function workProfileForStaff(teachers: SetupRecord[], person: { id: string; first_name: string | null; last_name: string | null }, instructorId: string): SetupRecord {
  const matches = teachers.filter(record => record.values.personId === person.id)
  if (matches.length > 1) throw new Error('Multiple work profiles are linked to this staff member. No changes were made.')
  if (matches[0]) return matches[0]
  // An unlinked legacy profile must be explicitly reconciled, never matched by name.
  if (teachers.some(record => !record.values.personId)) throw new Error('Existing work profiles need explicit identity reconciliation before a new profile can be saved. No changes were made.')
  return { id: `staff:${instructorId}`, values: {
    personId: person.id, name: [person.first_name, person.last_name].filter(Boolean).join(' '),
    assignments: '[]', availability: '[]', availabilityWeeks: '[]', availabilityOverrides: '[]', timeOff: '[]',
    location: '', locationIds: '[]', canPerformAdmin: 'no', engineeringLevel: '0', days: '', from: '', to: '',
  } }
}

export function workProfileValuesError(values: unknown): string | null {
  if (!values || typeof values !== 'object' || Array.isArray(values) || Object.values(values).some(value => typeof value !== 'string')) return 'Invalid staff work profile.'
  const record = values as Record<string, string>
  const error = validateTeacherExceptions(record)
  if (error) return error
  try {
    for (const key of ['assignments', 'availability', 'availabilityWeeks', 'availabilityOverrides', 'timeOff', 'locationIds']) {
      if (!Array.isArray(JSON.parse(record[key] || '[]'))) return 'Invalid staff work profile lists.'
    }
    if (!['yes', 'no'].includes(record.canPerformAdmin)) return 'Choose administrative work eligibility.'
    if (!['0', '1', '2', '3'].includes(record.engineeringLevel || '0')) return 'Choose a valid engineering level.'
  } catch { return 'Invalid staff work profile lists.' }
  return null
}