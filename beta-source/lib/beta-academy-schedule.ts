import type { SetupRecord } from '../app/content-studio-prototype/school-setup/setup-content'
import type { PreviewLesson, PreviewStudent } from './academy-student-preview'
import { teacherAvailabilityForDate, teacherWeekAvailability, type TeacherAvailability, type TeacherDateOverride, type TeacherTimeOff, type TeacherWeekSchedule } from '../app/content-studio-prototype/school-setup/setup-content'
import { readSchedulingPolicy, teachingPolicyReason } from './academy-scheduling-policy'

/** A member of the academy's own staff, as configured in School Setup. */
export type BetaAcademyTeacher = {
  id: string
  name: string
  /** Raw School Setup values, so the teacher workspace can reuse the setup editors. */
  values: Record<string, string>
  instruments: string[]
  location: string
  blocks: { day: number; from: number; to: number }[]
  availabilityValues?: Record<string, string>
  policyValues?: Record<string, string>
  blockedTimes?: { date: string; time: string; duration: number; repeat: string; until: string; publicOnly: boolean; status: string }[]
}

/** Teaching already booked, used to keep a slot free. */
export type BetaTeachingLoad = {
  teacherId?: string
  teacher: string
  date: string
  time: string
  duration: number
  studentId: string
  room?: string
}

export type BetaAcademyRoom = { id: string; name: string; location: string }

/** School Setup service names and the enrollment wizard's program names. */
const programAlias: Record<string, string> = { 'Voice & Vocals': 'Voice', Band: 'Band Program' }

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed as T : fallback } catch { return fallback }
}

/** School Setup availability counts Monday as day 0; the calendar uses 1 (Monday). */
export function betaWeekday(setupDay: number) {
  return (setupDay + 1) % 7
}

/** The academy's staff, with the programs they teach and the hours they keep. */
export function betaAcademyTeachers(setup: Record<string, SetupRecord[]>): BetaAcademyTeacher[] {
  const services = setup.services || []
  const programFor = (serviceId: string) => {
    const service = services.find(record => record.id === serviceId)
    const name = service?.values.name || ''
    return programAlias[name] || name
  }
  return (setup.teachers || []).flatMap(record => {
    const name = (record.values.name || '').trim()
    if (!name) return []
    const assignments = parseJson<{ serviceId?: string }[]>(record.values.assignments, [])
    const availability = parseJson<{ day?: number; from?: number; to?: number }[]>(record.values.availability, [])
    const instruments = [...new Set(assignments.map(item => item.serviceId ? programFor(item.serviceId) : '').filter(Boolean))]
    const blocks = availability.flatMap(block => {
      if (typeof block.day !== 'number' || typeof block.from !== 'number' || typeof block.to !== 'number') return []
      return [{ day: betaWeekday(block.day), from: block.from, to: block.to }]
    })
    const blockedTimes = (setup.resourceBlocks || []).flatMap(item => {
      const booking = parseJson<{ teacherId: string; date: string; time: string; duration: number; repeat: string; until: string; publicOnly: boolean; status: string } | null>(item.values.booking, null)
      return booking?.teacherId === record.id ? [booking] : []
    })
    return [{ id: record.id, name, values: record.values, instruments, location: record.values.location || '', blocks, availabilityValues: record.values, policyValues: setup.policies?.[0]?.values || {}, blockedTimes }]
  })
}

/** The academy's rooms, from its configured locations. */
export function betaAcademyRooms(setup: Record<string, SetupRecord[]>): BetaAcademyRoom[] {
  return (setup.locations || []).flatMap(location => (location.rooms || []).map(room => ({ id: room.id, name: room.name, location: location.values.name || '' })))
}

/** Teaching already booked in the academy's own records. */
export function betaTeachingLoad(students: readonly PreviewStudent[], lessons: readonly PreviewLesson[]): BetaTeachingLoad[] {
  const load: BetaTeachingLoad[] = []
  const owners = new Map(students.flatMap(student => student.enrollments.map(enrollment => [enrollment.id, { student, enrollment }] as const)))
  for (const lesson of lessons) {
    if (lesson.status === 'Cancelled') continue
    const owner = owners.get(lesson.enrollmentId)
    if (!owner) continue
    const { student, enrollment } = owner
    const teacher = lesson.teacher || enrollment.teacher
    load.push({ teacherId: teacher === enrollment.teacher ? enrollment.teacherId : undefined, teacher, date: lesson.date, time: lesson.time, duration: enrollment.duration, studentId: student.id, room: lesson.room })
  }
  return load
}

function overlaps(a: string, aDuration: number, b: string, bDuration: number) {
  return minutes(a) < minutes(b) + bDuration && minutes(b) < minutes(a) + aDuration
}

/** Whether a teacher can take this lesson in this slot. */
export function betaTeacherAvailable(teacher: BetaAcademyTeacher, lesson: { instrument: string; duration: number }, date: string, time: string, load: readonly BetaTeachingLoad[], studentId: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
  if (teacher.instruments.length && !teacher.instruments.includes(programAlias[lesson.instrument] || lesson.instrument)) return false
  const values = teacher.availabilityValues
  const base = values ? parseJson<TeacherAvailability[]>(values.availability, teacher.blocks.map((block, index) => ({ id: String(index), day: (block.day + 6) % 7, from: block.from, to: block.to }))) : []
  const actual = values ? teacherAvailabilityForDate(teacherWeekAvailability(base, parseJson<TeacherWeekSchedule[]>(values.availabilityWeeks, []), date), parseJson<TeacherDateOverride[]>(values.availabilityOverrides, []), parseJson<TeacherTimeOff[]>(values.timeOff, []), date) : teacher.blocks.filter(block => block.day === weekday)
  const withinHours = actual.some(block => minutes(time) >= block.from && minutes(time) + lesson.duration <= block.to)
  if (!withinHours) return false
  if (teacher.blockedTimes?.some(block => block.status !== 'Cancelled' && !block.publicOnly && (block.repeat === 'weekly' ? date >= block.date && date <= block.until && new Date(`${date}T12:00:00Z`).getUTCDay() === new Date(`${block.date}T12:00:00Z`).getUTCDay() : block.date === date) && overlaps(time, lesson.duration, block.time, block.duration))) return false
  const busy = load.filter(item => (item.teacherId ? item.teacherId === teacher.id : item.teacher === teacher.name) && item.date === date)
  if (busy.some(item => overlaps(time, lesson.duration, item.time, item.duration))) return false
  if (load.some(item => item.date === date && item.studentId === studentId && overlaps(time, lesson.duration, item.time, item.duration))) return false
  const shift = actual.find(block => minutes(time) >= block.from && minutes(time) + lesson.duration <= block.to)
  if (values && teachingPolicyReason(busy.filter(item => !shift || (minutes(item.time) >= shift.from && minutes(item.time) + item.duration <= shift.to)), time, lesson.duration, readSchedulingPolicy(teacher.policyValues, values))) return false
  return true
}

/** The academy's teachers who can take this lesson, in slot order. */
export function betaAvailableTeachers(teachers: readonly BetaAcademyTeacher[], lesson: { instrument: string; duration: number }, date: string, time: string, load: readonly BetaTeachingLoad[], studentId: string) {
  return teachers.filter(teacher => betaTeacherAvailable(teacher, lesson, date, time, load, studentId))
}

/** A free room at the teacher's own location, falling back to any academy room. */
export function betaRoomFor(rooms: readonly BetaAcademyRoom[], teacher: { location?: string } | undefined, date: string, time: string, duration: number, load: readonly BetaTeachingLoad[]) {
  const preferred = rooms.filter(room => !teacher?.location || room.location === teacher.location)
  const options = preferred.length ? preferred : rooms
  const busy = load.filter(item => item.date === date && item.room)
  for (const room of options) {
    if (!busy.some(item => item.room === room.name && overlaps(time, duration, item.time, item.duration))) return room.name
  }
  return ''
}
