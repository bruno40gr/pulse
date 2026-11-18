export const CONTACT_PROFILE_FIELDS = ['first_name', 'last_name', 'phone', 'email', 'date_of_birth'] as const
export type ContactProfileField = typeof CONTACT_PROFILE_FIELDS[number]
export type ContactProfile = Partial<Record<ContactProfileField, string | null>>
export type ContactProfileDraft = Record<ContactProfileField, string>

export function contactProfileDraft(profile: ContactProfile): ContactProfileDraft {
  return Object.fromEntries(CONTACT_PROFILE_FIELDS.map(field => [field, profile[field] ?? ''])) as ContactProfileDraft
}

export function changedContactProfile(original: ContactProfileDraft, draft: ContactProfileDraft): ContactProfile {
  return Object.fromEntries(CONTACT_PROFILE_FIELDS.flatMap(field => {
    const value = draft[field].trim()
    return value === original[field].trim() ? [] : [[field, value || null]]
  }))
}

export function validateContactProfile(input: unknown, today = new Date().toISOString().slice(0, 10)):
  { ok: true; fields: ContactProfile } | { ok: false; error: string } {
  const invalid = (error: string) => ({ ok: false as const, error })
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid('Invalid contact details.')
  const entries = Object.entries(input)
  if (!entries.length) return invalid('No contact changes were submitted.')
  const fields: ContactProfile = {}
  for (const [key, raw] of entries) {
    if (!CONTACT_PROFILE_FIELDS.some(field => field === key)) return invalid('Only personal contact fields can be updated here.')
    if (raw !== null && typeof raw !== 'string') return invalid('Invalid contact field value.')
    const value = typeof raw === 'string' ? raw.trim() || null : null
    const field = key as ContactProfileField
    if (field === 'first_name' || field === 'last_name') {
      if (!value || value.length > 120 || /[\r\n\t]/.test(value)) return invalid('Enter a valid first and last name.')
    } else if (field === 'email' && value && (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
      return invalid('Enter a valid email address.')
    } else if (field === 'phone' && value) {
      const number = value.replace(/\s*(?:ext\.?|x)\s*\d{1,8}$/i, '')
      const digits = number.replace(/\D/g, '').length
      if (value.length > 48 || !/^\+?[\d().\s-]+$/.test(number) || digits < 7 || digits > 15 || /[\r\n\t]/.test(value)) return invalid('Enter a valid phone number.')
    } else if (field === 'date_of_birth' && value) {
      const date = new Date(`${value}T00:00:00.000Z`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01' || value > today || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        return invalid('Enter a valid date of birth that is not in the future.')
      }
    }
    fields[field] = value
  }
  return { ok: true, fields }
}