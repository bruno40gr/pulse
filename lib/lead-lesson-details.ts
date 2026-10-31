// Shared payload vocabulary for website submissions, manual entry and editing.
export const LESSON_LEAD_TYPES = ['lesson_inquiry', 'tour_request']
export const LESSON_INSTRUMENT_OPTIONS = ['Piano', 'Voice', 'Guitar', 'Violin', 'Drums', 'Ukulele', 'Bass', 'Cello', 'Saxophone', 'Flute', 'Clarinet', 'Trumpet', 'Other']
export const LESSON_PROGRAM_GROUPS = [
  { label: 'Private lessons', options: LESSON_INSTRUMENT_OPTIONS.map(instrument => `Private · ${instrument}`) },
  { label: 'Semi-private lessons', options: LESSON_INSTRUMENT_OPTIONS.map(instrument => `Semi-private · ${instrument}`) },
  { label: 'Group programs', options: ['Tiny Keys', 'Little Rockers', 'Band'] },
]
export const LESSON_PROGRAM_OPTIONS = LESSON_PROGRAM_GROUPS.flatMap(group => group.options)

export function isLessonLead(intakeType: string | undefined) {
  return !!intakeType && LESSON_LEAD_TYPES.includes(intakeType)
}

export function leadBelongsToTab(
  lead: { intake_type: string; status?: string; category?: string | null; source_form?: string | null },
  tab: string,
): boolean {
  if (tab === 'winback') {
    return lead.status !== 'won' && (lead.category === 'winback' || lead.source_form === '2026-disenrollment-import')
  }
  const inquiry = isLessonLead(lead.intake_type) || lead.intake_type === 'service_inquiry'
  if (tab === 'enrolled') return inquiry && lead.status === 'won'
  if (tab === 'lost') return inquiry && ['lost', 'ghosted_us', 'ghosted'].includes(lead.status || '') && lead.source_form !== '2026-disenrollment-import' && lead.category !== 'winback'
  if (inquiry && ['won', 'lost', 'ghosted_us', 'ghosted'].includes(lead.status || '')) return false
  if (lead.category === 'winback' || lead.source_form === '2026-disenrollment-import') return false
  if (tab === 'lesson_inquiry') return isLessonLead(lead.intake_type)
  return lead.intake_type === tab
}

export type LessonRequestFields = {
  studentName: string
  studentAge: string
  studentBirthday: string
  experience: string
  preferredDays: string
  preferredTimes: string
  preferredDate: string
  timeWindow: string
}

function text(value: unknown): string {
  if (Array.isArray(value)) return value.filter(v => typeof v === 'string').join(', ')
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

export function readLessonRequestFields(payload: Record<string, unknown> | null | undefined): LessonRequestFields {
  // A deliberately cleared canonical field must not resurrect an older website alias.
  const field = (key: string, ...aliases: string[]) => {
    for (const name of [key, ...aliases]) {
      if (payload && Object.prototype.hasOwnProperty.call(payload, name)) return payload[name]
    }
    return undefined
  }
  return {
    studentName: text(payload?.student_name),
    studentAge: text(field('age', 'student_age', 'child_age', 'prospect_age')),
    studentBirthday: text(field('date_of_birth', 'birth_date')),
    experience: text(field('experience', 'experience_level')),
    preferredDays: text(field('preferred_days', 'days_available')),
    preferredTimes: text(field('preferred_times', 'preferred_time')),
    preferredDate: text(payload?.preferred_date),
    timeWindow: text(payload?.time_window),
  }
}

export function lessonRequestPayload(fields: LessonRequestFields): Record<string, unknown> {
  const list = (value: string) => value.split(',').map(v => v.trim()).filter(Boolean)
  return {
    student_name: fields.studentName.trim() || null,
    age: fields.studentAge.trim() || null,
    date_of_birth: fields.studentBirthday || null,
    experience: fields.experience.trim() || null,
    preferred_days: list(fields.preferredDays),
    preferred_times: list(fields.preferredTimes),
    preferred_date: fields.preferredDate || null,
    time_window: fields.timeWindow.trim() || null,
  }
}