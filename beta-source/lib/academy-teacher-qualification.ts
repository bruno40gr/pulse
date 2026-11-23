/** Teaching qualifications belong to School Setup, never to availability windows. */
export function teacherQualificationReason(values: Record<string, string>, serviceId: string, level = 1): string | null {
  if (!Number.isInteger(level) || level < 1) return 'Choose a valid teaching level.'
  try {
    const legacyLevels: unknown = JSON.parse(values.levelIds || '[]')
    const legacyMaximum = Array.isArray(legacyLevels) ? Math.max(1, legacyLevels.length) : 1
    const assignments: unknown = values.assignments
      ? JSON.parse(values.assignments)
      : [{ serviceId: values.service, maxLevel: legacyMaximum }]
    if (!Array.isArray(assignments)) return 'Check this teacher’s teaching assignments in School Setup.'
    const assignment = assignments.find(item => item && item.serviceId === serviceId)
    if (!assignment) return 'This teacher does not teach the selected service.'
    // Older assignments without a maximum must not imply unlimited qualification.
    const maximum = assignment.maxLevel ?? legacyMaximum
    if (!Number.isInteger(maximum) || maximum < 1) return 'Check this teacher’s maximum teaching level in School Setup.'
    if (level > maximum) return 'This teacher is not qualified for the selected teaching level.'
    return null
  } catch {
    return 'Check this teacher’s teaching assignments in School Setup.'
  }
}