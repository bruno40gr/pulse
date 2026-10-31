/** Presentation only. Never infer a family from a name, email or phone number. */
export function groupContactFamilies<T extends {
  id: string; account_id?: string | null; account_holder_name?: string | null
  custom_fields?: Record<string, unknown>; staff_id?: string | null
}>(contacts: T[]): { id: string; holder: string | null; members: T[] }[] {
  const groups = new Map<string, { id: string; holder: string | null; members: T[] }>()
  for (const contact of contacts) {
    const linked = contact.account_id && !contact.staff_id
      && !['booking', 'instructor'].includes(String(contact.custom_fields?.contact_kind || ''))
    const id = linked ? `account:${contact.account_id}` : `contact:${contact.id}`
    const group = groups.get(id) || { id, holder: linked ? contact.account_holder_name?.trim() || 'Account holder' : null, members: [] }
    group.members.push(contact)
    groups.set(id, group)
  }
  return [...groups.values()]
}

export type InquiryStudent = { id: string; name: string; program: string; self: boolean }
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const records = (value: unknown): Record<string, unknown>[] => Array.isArray(value)
  ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item))) : []

/** Inquiry children are not person IDs and must never become extra recipients. */
export function inquiryStudents(payload: Record<string, unknown>, contactName: string): InquiryStudent[] {
  if (Array.isArray(payload.student_requests)) {
    return records(payload.student_requests).flatMap((student, index) => {
      const self = student.classes_for_myself === true
      const name = self ? contactName.trim() : text(student.name) || text(student.student_name)
      return name ? [{ id: `student:${index}`, name, program: text(student.program) || text(student.instrument_interest), self }] : []
    })
  }
  const name = payload.classes_for_myself === true ? contactName.trim() : text(payload.student_name)
  return [
    ...(name ? [{ id: 'student:primary', name, program: text(payload.instrument) || text(payload.program), self: payload.classes_for_myself === true }] : []),
    ...records(payload.family_members ?? payload.siblings).flatMap((student, index) => {
      const name = text(student.name)
      return name ? [{ id: `student:sibling:${index}`, name, program: text(student.instrument_interest), self: false }] : []
    }),
  ]
}