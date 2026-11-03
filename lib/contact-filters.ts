import { contactDestination, type ContactPresentation } from './contact-presentation'

export const DEFAULT_CONTACT_FILTERS: Record<string, string> = { client_status: 'active_students' }

type FilterContact = ContactPresentation & {
  first_name: string; last_name: string; client_status: string; last_attended: string | null
  funded?: boolean; instructor?: { person_id: string | null; name: string | null } | null
}

/** Applied filters only; editing a drawer draft never invokes a query. */
export function matchesContactFilters(contact: FilterContact, filters: Record<string, string>, now = Date.now()) {
  const destination = contactDestination(contact)
  const contains = (value: string | null | undefined, query: string) => (value || '').toLowerCase().includes(query.trim().toLowerCase())
  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue
    switch (key) {
      case 'name':
        if (!contains(`${contact.first_name} ${contact.last_name}`, value) && !contains(contact.account_holder_name, value)) return false
        break
      case 'client_status':
        if (value === 'active_students') {
          if (contact.client_status !== 'active' || !(contact.is_student === true || (contact.is_student !== false && contact.student_id))) return false
        } else if (contact.client_status !== value) return false
        break
      case 'email':
        if (!contains(destination.email, value)) return false
        break
      case 'email_availability':
      case 'phone_availability': {
        const available = Boolean((key === 'email_availability' ? destination.email : destination.phone)?.trim())
        if (available !== (value === 'present')) return false
        break
      }
      case 'last_active': {
        const attended = contact.last_attended ? Date.parse(contact.last_attended) : NaN
        if (value === 'never') { if (Number.isFinite(attended)) return false; break }
        const days = (now - attended) / 86400000
        if (!Number.isFinite(days) || days < 0) return false
        if (value === 'over_90' ? days <= 90 : days > Number(value)) return false
        break
      }
      case 'instructor':
        if (contact.instructor?.person_id !== value) return false
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