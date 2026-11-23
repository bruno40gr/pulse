type Teacher = {
  first_name?: string | null
  last_name?: string | null
  custom_fields?: Record<string, unknown> | null
}

/** A historical name is not evidence of a current teaching assignment. */
export function currentSubscriptionTeacher(teacher: Teacher | null | undefined): string | null {
  if (!teacher) return null
  const status = String(teacher.custom_fields?.staff_status ?? 'active').trim().toLowerCase()
  if (['sunset', 'inactive', 'ended', 'archived'].includes(status)) return null
  return [teacher.first_name, teacher.last_name].filter(Boolean).join(' ').trim() || null
}