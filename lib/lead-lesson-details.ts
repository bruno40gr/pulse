// Shared payload vocabulary for website submissions, manual entry and editing.
export const LESSON_LEAD_TYPES = ['lesson_inquiry', 'tour_request']
export const LESSON_PROGRAM_OPTIONS = ['Piano', 'Voice', 'Guitar', 'Violin', 'Drums', 'Ukulele', 'Bass', 'Cello', 'Saxophone', 'Flute', 'Clarinet', 'Trumpet', 'Little Rockers', 'Tiny Keys', 'Other']

export function isLessonLead(intakeType: string | undefined) {
  return !!intakeType && LESSON_LEAD_TYPES.includes(intakeType)
}

export type LessonRequestFields = {
  studentName: string
  studentAge: string
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
    experience: fields.experience.trim() || null,
    preferred_days: list(fields.preferredDays),
    preferred_times: list(fields.preferredTimes),
    preferred_date: fields.preferredDate || null,
    time_window: fields.timeWindow.trim() || null,
  }
}