/** Sample schedules for the local enrollment screen. Times are Los Angeles wall
 * times; no hosted calendar, slot reservation or real availability is involved. */
import { type EnrollmentPerson, type LessonChoice } from './academy-staff-enrollment'

export const sampleWeek = '2026-11-02'
export const scheduleTeachers = [
  { name: 'Jordan Vale', instruments: ['Piano', 'Violin'], days: [1, 2, 3, 4], from: 14 * 60, to: 18 * 60, maxGapMinutes: 60 },
  { name: 'Robin Ellis', instruments: ['Piano', 'Guitar', 'Voice', 'Drums'], days: [2, 3, 4, 5], from: 15 * 60, to: 19 * 60, maxGapMinutes: 90 },
  { name: 'Maya Chen', instruments: ['Piano', 'Flute', 'Tiny Keys'], days: [1, 2, 4], from: 14 * 60, to: 18 * 60, maxGapMinutes: 90 },
  { name: 'Leo Brooks', instruments: ['Guitar', 'Bass', 'Ukulele', 'Little Rockers', 'Band Program'], days: [1, 3, 5], from: 14 * 60, to: 19 * 60, maxGapMinutes: 90 },
  { name: 'Nina Patel', instruments: ['Violin', 'Cello', 'Piano', 'Tiny Keys'], days: [2, 3, 5], from: 14 * 60, to: 18 * 60, maxGapMinutes: 60 },
  { name: 'Owen Reed', instruments: ['Drums', 'Guitar', 'Little Rockers', 'Band Program'], days: [1, 2, 4], from: 15 * 60, to: 19 * 60, maxGapMinutes: 90 },
  { name: 'Zoe Williams', instruments: ['Voice', 'Saxophone', 'Clarinet', 'Trumpet', 'Piano', 'Little Rockers'], days: [3, 4, 5], from: 14 * 60, to: 19 * 60, maxGapMinutes: 90 },
] as const
/** Recurring fictional group starts, not interchangeable private availability. */
export const sampleGroupSessions = [
  { program: 'Tiny Keys', teacher: 'Maya Chen', day: 1, time: '14:00', duration: 45 },
  { program: 'Tiny Keys', teacher: 'Maya Chen', day: 2, time: '15:00', duration: 45 },
  { program: 'Tiny Keys', teacher: 'Nina Patel', day: 5, time: '14:30', duration: 45 },
  { program: 'Little Rockers', teacher: 'Leo Brooks', day: 1, time: '16:00', duration: 45 },
  { program: 'Little Rockers', teacher: 'Owen Reed', day: 4, time: '16:15', duration: 45 },
  { program: 'Little Rockers', teacher: 'Zoe Williams', day: 5, time: '15:30', duration: 45 },
  { program: 'Band Program', teacher: 'Leo Brooks', day: 3, time: '17:00', duration: 60 },
  { program: 'Band Program', teacher: 'Owen Reed', day: 2, time: '17:30', duration: 60 },
] as const
export type ScheduleAppointment = {
  id: string; studentId: string; managerId: string | null; studentName: string
  teacher: string; instrument: string; date: string; time: string; duration: number
}
export const sampleAppointments: readonly ScheduleAppointment[] = [
  { id: 'sample-1', studentId: 'demo-riley', managerId: 'demo-jamie', studentName: 'Riley Park', teacher: 'Jordan Vale', instrument: 'Piano', date: '2026-11-03', time: '15:00', duration: 60 },
  { id: 'sample-2', studentId: 'demo-avery', managerId: null, studentName: 'Avery Lane', teacher: 'Robin Ellis', instrument: 'Guitar', date: '2026-11-04', time: '17:00', duration: 30 },
  { id: 'sample-3', studentId: 'demo-other', managerId: null, studentName: 'Casey Bell', teacher: 'Jordan Vale', instrument: 'Violin', date: '2026-11-02', time: '16:00', duration: 60 },
  { id: 'sample-4', studentId: 'demo-other-2', managerId: null, studentName: 'Alex Moss', teacher: 'Robin Ellis', instrument: 'Voice', date: '2026-11-05', time: '15:30', duration: 30 },
  { id: 'sample-5', studentId: 'demo-lily', managerId: null, studentName: 'Lily Nguyen', teacher: 'Maya Chen', instrument: 'Flute', date: '2026-11-02', time: '15:15', duration: 45 },
  { id: 'sample-6', studentId: 'demo-mateo', managerId: null, studentName: 'Mateo Garcia', teacher: 'Leo Brooks', instrument: 'Ukulele', date: '2026-11-04', time: '15:00', duration: 45 },
  { id: 'sample-7', studentId: 'demo-noah', managerId: null, studentName: 'Noah Wilson', teacher: 'Nina Patel', instrument: 'Cello', date: '2026-11-03', time: '14:15', duration: 60 },
  { id: 'sample-8', studentId: 'demo-ruby', managerId: null, studentName: 'Ruby Davis', teacher: 'Owen Reed', instrument: 'Drums', date: '2026-11-05', time: '15:00', duration: 45 },
  { id: 'sample-9', studentId: 'demo-aria', managerId: null, studentName: 'Aria Brown', teacher: 'Zoe Williams', instrument: 'Saxophone', date: '2026-11-06', time: '17:00', duration: 30 },
]
export const scheduleTimes = Array.from({ length: 20 }, (_, index) => `${14 + Math.floor(index / 4)}:${String(index % 4 * 15).padStart(2, '0')}`)
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
export function overlap(a: string, aDuration: number, b: string, bDuration: number) {
  return minutes(a) < minutes(b) + bDuration && minutes(b) < minutes(a) + aDuration
}
export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
export function weekStart(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay()
  return shiftDate(date, -((day + 6) % 7))
}
export function weekDates(date: string) {
  return Array.from({ length: 6 }, (_, index) => shiftDate(weekStart(date), index))
}
export function formatScheduleDate(date: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
}
export function formatScheduleTime(time: string) {
  const hour = Number(time.slice(0, 2))
  return `${hour % 12 || 12}:${time.slice(3)} ${hour >= 12 ? 'pm' : 'am'}`
}
export function lessonOccursOn(lesson: LessonChoice, date: string) {
  if (!lesson.start || !lesson.time || !lesson.teacher || date < lesson.start) return false
  const days = Math.round((new Date(`${date}T12:00:00Z`).getTime() - new Date(`${lesson.start}T12:00:00Z`).getTime()) / 86400000)
  if (lesson.frequency === 'Weekly' || lesson.frequency === 'Monthly subscription') return days % 7 === 0
  if (lesson.frequency === 'Every other week') return days % 14 === 0
  return days === 0
}
export function familyAppointments(student: EnrollmentPerson | null, manager: EnrollmentPerson | null) {
  return sampleAppointments.filter(event => event.studentId === student?.id || Boolean(manager && (event.managerId === manager.id || event.studentId === manager.id)))
}
/** A proposed lesson must connect to the teacher's existing day within their
 * configured gap limit. Empty days may start with any in-hours lesson. */
export function fitsTeacherGap(time: string, duration: number, appointments: readonly { time: string; duration: number }[], maxGapMinutes: number) {
  if (!appointments.length) return true
  const start = minutes(time)
  const end = start + duration
  return appointments.some(event => Math.max(minutes(event.time) - end, start - (minutes(event.time) + event.duration), 0) <= maxGapMinutes)
}
export function availableScheduleTeachers(lesson: LessonChoice, date: string, time: string, student: EnrollmentPerson | null, lessons: readonly LessonChoice[]) {
  const duration = Number(lesson.duration)
  const day = new Date(`${date}T12:00:00Z`).getUTCDay()
  if (sampleAppointments.some(event => event.studentId === student?.id && event.date === date && overlap(time, duration, event.time, event.duration))) return []
  const otherLessons = lessons.filter(other => other.id !== lesson.id && lessonOccursOn(other, date))
  if (otherLessons.some(other => (other.studentId || student?.id) === (lesson.studentId || student?.id) && overlap(time, duration, other.time, Number(other.duration)))) return []
  return scheduleTeachers.filter(teacher =>
    teacher.instruments.some(instrument => instrument === lesson.instrument) &&
    (lesson.service !== 'Group' || sampleGroupSessions.some(session => session.program === lesson.instrument && session.teacher === teacher.name && session.day === day && session.time === time && session.duration === duration)) &&
    !sampleGroupSessions.some(session => session.teacher === teacher.name && session.day === day && overlap(time, duration, session.time, session.duration) && !(lesson.service === 'Group' && session.program === lesson.instrument && session.time === time && session.duration === duration)) &&
    teacher.days.some(value => value === day) && minutes(time) >= teacher.from && minutes(time) + duration <= teacher.to &&
    !sampleAppointments.some(event => event.teacher === teacher.name && event.date === date && overlap(time, duration, event.time, event.duration)),
  ).filter(teacher =>
    !otherLessons.some(other => other.teacher === teacher.name && overlap(time, duration, other.time, Number(other.duration)) && !(lesson.service === 'Group' && other.service === 'Group' && other.instrument === lesson.instrument && other.time === time && other.duration === lesson.duration)) &&
    fitsTeacherGap(time, duration, [
      ...sampleAppointments.filter(event => event.teacher === teacher.name && event.date === date),
      ...otherLessons.filter(other => other.teacher === teacher.name).map(other => ({ time: other.time, duration: Number(other.duration) })),
    ], teacher.maxGapMinutes),
  )
}
export function selectScheduleSlot(lesson: LessonChoice, date: string, time: string, teacher: string): LessonChoice {
  return { ...lesson, start: date, time, teacher, day: formatScheduleDate(date, { weekday: 'long' }) }
}