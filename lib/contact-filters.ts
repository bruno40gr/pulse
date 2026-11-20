import { contactDestination, type ContactPresentation } from './contact-presentation'
import { matchesClientTypes } from './contact-client-types'

export const DEFAULT_CONTACT_FILTERS: Record<string, string> = { active_only: 'true' }

type FilterContact = ContactPresentation & {
  first_name: string; last_name: string; client_status: string; last_attended: string | null
  funded?: boolean; instructor?: { person_id: string | null; name: string | null } | null
  status_class?: 'active' | 'inactive' | 'unknown'
  profile_enrollments?: { service_type?: string | null; instrument?: string | null; session_name?: string | null; appointment_class_name?: string | null; instructor_person_id?: string | null }[]
}

/** Applied filters only; editing a drawer draft never invokes a query. */
export function matchesContactFilters(contact: FilterContact, filters: Record<string, string>, now = Date.now()) {
  const destination = contactDestination(contact)
  const contains = (value: string | null | undefined, query: string) => (value || '').toLowerCase().includes(query.trim().toLowerCase())
  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue
    switch (key) {
      case 'client_types':
        // Imported lesson enrollments are a separate source from explicitly recorded service types.
        if (!matchesClientTypes(contact.custom_fields?.client_types, value) &&
          !(value.split('|').includes('Lessons') && contact.is_student !== false &&
            contact.profile_enrollments?.some(enrollment => ['private', 'semi-private', 'group', 'band'].includes((enrollment.service_type || '').trim().toLowerCase())))) return false
        break
      case 'name':
        if (!contains(`${contact.first_name} ${contact.last_name}`, value) && !contains(contact.account_holder_name, value)) return false
        break
      case 'client_status':
        if (contact.client_status !== value) return false
        break
      case 'active_only':
        if (value === 'true' && ((contact.status_class ?? (['active', 'member'].includes(contact.client_status.trim().toLowerCase()) ? 'active' : 'inactive')) !== 'active'
          || !(contact.is_student === true || (contact.is_student !== false && contact.student_id)))) return false
        break
      case 'email':
        if (!contains(destination.email, value)) return false
        break
      case 'last_active': {
        const attended = contact.last_attended ? Date.parse(contact.last_attended) : NaN
        if (value === 'never') { if (Number.isFinite(attended)) return false; break }
        const days = (now - attended) / 86400000
        if (!Number.isFinite(days) || days < 0) return false
        if (value === 'over_90' ? days <= 90 : days > Number(value)) return false
        break
      }
      case 'instructor':
        if (contact.instructor?.person_id !== value && !contact.profile_enrollments?.some(enrollment => enrollment.instructor_person_id === value)) return false
        break
      case 'program':
        if (!['program', 'instrument'].some(key => contact.custom_fields?.[key] === value) && !contact.profile_enrollments?.some(enrollment => enrollment.instrument === value)) return false
        break
      case 'service_class':
        if (!['service_type', 'session_name', 'appointment_class_name'].some(key => contact.custom_fields?.[key] === value) &&
          !contact.profile_enrollments?.some(enrollment => [enrollment.service_type, enrollment.session_name, enrollment.appointment_class_name].includes(value))) return false
        break
      case 'funded':
        if (Boolean(contact.funded) !== (value === 'yes')) return false
        break
      default:
        if (contact.custom_fields?.[key] !== value) return false
    }
  }
  return true
}