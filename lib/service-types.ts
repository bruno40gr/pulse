import { LESSON_INSTRUMENT_OPTIONS } from './lead-lesson-details'

/**
 * Lessons are assembled from dimensions, not from one enumerated label
 * (docs/service-catalogue-model.md): the lesson (instrument or branded program),
 * the service format (private, semi-private, group) and the level.
 *
 * Opus stores the same arrangement as a single fragmented string per enrolment —
 * "Piano - Level 1 (30 min) - Semi-Private", "Tiny Keys - Level 2 (Group) - SAT
 * 9:30 AM", or an ensemble's name with no service value at all. Each label is
 * decomposed back into those dimensions so filters can speak in the same terms
 * staff do.
 */
export type LessonFormat = 'private' | 'semi' | 'group'

export interface LessonService {
  lesson: string | null
  format: LessonFormat | null
  level: string | null
}

export const LESSON_FORMAT_OPTIONS: { value: LessonFormat; label: string }[] = [
  { value: 'private', label: 'Private' },
  { value: 'semi', label: 'Semi-private' },
  { value: 'group', label: 'Group' },
]

export const LESSON_LEVEL_OPTIONS = ['Level 1', 'Level 2', 'Level 3']

/** Group classes are programs in their own right, not instruments. */
const GROUP_PROGRAMS: { match: RegExp; lesson: string }[] = [
  { match: /\btiny keys\b|\bkids n keys\b/i, lesson: 'Tiny Keys' },
  { match: /\blittle rockers\b|\brock city\b/i, lesson: 'Little Rockers' },
  { match: /\bsongwriting\b/i, lesson: 'Songwriting' },
]

const INSTRUMENTS = LESSON_INSTRUMENT_OPTIONS.filter(option => option !== 'Other').sort((a, b) => b.length - a.length)

const INSTRUMENT_ALIASES: Record<string, string> = { voice: 'Voice', vocals: 'Voice', 'voice & vocals': 'Voice', singing: 'Voice', sax: 'Saxophone', keys: 'Piano', keyboard: 'Piano', 'bass guitar': 'Bass', trombone: 'Other', tuba: 'Other', viola: 'Violin' }

const DELIVERY_ONLY = new Set(['band', 'group', 'private', 'semi-private', 'semiprivate', 'semi private', 'lesson', 'lessons', 'makeup', 'make-up'])

function withoutSchedule(label: string) {
  // "— SAT 9:30 AM", "- Wednesday @ 5:00 PM", "(Group) - WED 2:30 PM"
  return label.replace(/\s*[-–—]\s*(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\b.*$/i, '')
    .replace(/\s*[-–—]\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b.*$/i, '').trim()
}

function withoutDuration(label: string) {
  // "(30 min)", "- 60 minutes": another axis, not part of the service.
  return label.replace(/\(\s*\d+\s*min(ute)?s?\s*\)/gi, '').replace(/\s*[-–—]\s*\d+\s*min(ute)?s?\b/gi, '').trim()
}

function tidy(raw: string) {
  return withoutDuration(withoutSchedule(raw.replace(/\s+/g, ' ').trim()))
}

function readFormat(label: string, serviceType?: string | null): LessonFormat | null {
  const text = `${serviceType || ''} ${label}`.toLowerCase()
  if (/semi[- ]?private/.test(text)) return 'semi'
  if (/\bprivate\b/.test(text)) return 'private'
  if (/\bgroup\b|\bband\b|\bensemble\b/.test(text)) return 'group'
  return null
}

function readLevel(label: string): string | null {
  const match = label.match(/\blevel\s*([1-9])\b/i)
  // The school teaches three levels; a fourth label is the same rung, renamed.
  return match ? `Level ${Math.min(Number(match[1]), LESSON_LEVEL_OPTIONS.length)}` : null
}

function readLesson(label: string): string | null {
  if (!label) return null
  const program = GROUP_PROGRAMS.find(entry => entry.match.test(label))
  if (program) return program.lesson
  const alias = Object.keys(INSTRUMENT_ALIASES).sort((a, b) => b.length - a.length)
    .find(key => new RegExp(`(^|[^a-z])${key}([^a-z]|$)`, 'i').test(label))
  if (alias) return INSTRUMENT_ALIASES[alias]
  const instrument = INSTRUMENTS.find(option => new RegExp(`(^|[^a-z])${option.toLowerCase()}([^a-z]|$)`, 'i').test(label))
  return instrument || null
}

/** True when the label is the bare delivery mode, e.g. "semi-private". */
export function isFormatOnly(label?: string | null) {
  return Boolean(label && DELIVERY_ONLY.has(tidy(label).toLowerCase()))
}

/**
 * Decompose one stored label. `serviceType` is the row's own service type when
 * the label came from a session or class column, so "band" there makes a band
 * name a Band group rather than an unrecognised proper noun.
 */
export function parseLessonService(raw?: string | null, serviceType?: string | null): LessonService | null {
  const label = raw ? tidy(raw) : ''
  const type = serviceType ? tidy(serviceType) : ''
  const typeIsBand = /^(band|ensemble)$/i.test(type)
  const lesson = typeIsBand ? 'Band' : readLesson(label) || readLesson(type)
  const format = readFormat(label, type) || (lesson && (GROUP_PROGRAMS.some(entry => entry.lesson === lesson) || lesson === 'Band') ? 'group' : null)
  const level = readLevel(label) || readLevel(type)
  if (!lesson && !format && !level) return null
  return { lesson, format, level }
}

/** One enrolment carries the same lesson across its service, session and class fields. */
export function lessonServiceFor(enrollment: { service_type?: string | null; session_name?: string | null; appointment_class_name?: string | null; instrument?: string | null }) {
  if (!enrollment) return null
  const parts = [enrollment.session_name, enrollment.appointment_class_name].filter(Boolean) as string[]
  const parsed = parts.map(part => parseLessonService(part, enrollment.service_type)).filter(Boolean) as LessonService[]
  const fromService = parseLessonService(enrollment.service_type, enrollment.service_type)
  if (fromService) parsed.push(fromService)
  if (!parsed.length) {
    const instrument = readLesson(enrollment.instrument || '')
    return instrument ? { lesson: instrument, format: null, level: null } : null
  }
  return {
    lesson: parsed.find(item => item.lesson)?.lesson ?? null,
    format: parsed.find(item => item.format)?.format ?? null,
    level: parsed.find(item => item.level)?.level ?? null,
  }
}

export function matchesLesson(service: LessonService | null, lesson: string) {
  return service?.lesson === lesson
}

export function matchesFormat(service: LessonService | null, format: string) {
  return service?.format === format
}

export function matchesLevel(service: LessonService | null, level: string) {
  return service?.level === level
}

/** Every dimension present in the data, so filters only offer what exists. */
export function lessonServiceOptions(services: (LessonService | null)[]) {
  const lessons = new Set<string>()
  const levels = new Set<string>()
  for (const service of services) {
    if (!service) continue
    if (service.lesson) lessons.add(service.lesson)
    if (service.level) levels.add(service.level)
  }
  return {
    lessons: [...lessons].sort((a, b) => a.localeCompare(b)),
    formats: LESSON_FORMAT_OPTIONS,
    levels: LESSON_LEVEL_OPTIONS.filter(level => levels.has(level)),
  }
}

/** The lesson alone, for callers that only need the service being taught. */
export function canonicalServiceType(raw?: string | null): string | null {
  return parseLessonService(raw)?.lesson ?? null
}

/** Every lesson a contact carries, from recorded fields and imported enrolments. */
export function lessonServicesForContact(contact: { custom_fields?: Record<string, unknown> | null; profile_enrollments?: { service_type?: string | null; session_name?: string | null; appointment_class_name?: string | null; instrument?: string | null }[] | null }) {
  const services: LessonService[] = []
  for (const key of ['service_type', 'session_name', 'appointment_class_name'] as const) {
    const value = contact.custom_fields?.[key]
    if (typeof value === 'string' && value.trim()) {
      const parsed = parseLessonService(value, key === 'service_type' ? value : null)
      if (parsed) services.push(parsed)
    }
  }
  for (const enrollment of contact.profile_enrollments || []) {
    const parsed = lessonServiceFor(enrollment)
    if (parsed) services.push(parsed)
  }
  return services
}

/** Group classes are listed before Band, in the order staff read them. */
export const GROUP_CLASS_ORDER = ['Little Rockers', 'Tiny Keys', 'Songwriting']

/**
 * Lesson options for a filter, grouped the way the school's programme list reads:
 * instruments first, then the group classes, then Band.
 */
export function lessonFilterOptions(lessons: string[]) {
  const present = new Set(lessons)
  const instruments = LESSON_INSTRUMENT_OPTIONS.filter(option => present.has(option)).map(option => ({ value: option, label: option, group: 'Instruments' }))
  const others = [...present].filter(lesson => !LESSON_INSTRUMENT_OPTIONS.includes(lesson) && lesson !== 'Band')
  const classes = GROUP_CLASS_ORDER.filter(lesson => present.has(lesson))
    .concat(others.filter(lesson => !GROUP_CLASS_ORDER.includes(lesson)).sort((a, b) => a.localeCompare(b)))
    .map(lesson => ({ value: lesson, label: lesson, group: 'Group classes' }))
  const band = present.has('Band') ? [{ value: 'Band', label: 'Band', group: 'Band' }] : []
  return [...instruments, ...classes, ...band]
}
