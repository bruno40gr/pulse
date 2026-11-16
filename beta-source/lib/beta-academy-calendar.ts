import type { FamilyPreviewData } from './academy-family-preview'
import type { AcademyGroup } from './academy-explorer'
import type { ExplorerEvent } from './event-explorer'
import { lessonOccurrenceId } from './academy-session'

/** One block on the academy calendar. */
export type CalendarOccurrence = {
  id: string
  kind: 'lesson' | 'band' | 'event' | 'studio' | 'rehearsal' | 'block' | 'front-desk' | 'admin'
  date: string
  start: string
  end: string
  title: string
  program: string
  serviceType: string
  serviceId?: string
  teacherIds?: string[]
  teacherNames?: string[]
  rooms?: string[]
  room: string
  teacherId?: string
  teacherName: string
  studentIds: string[]
  studentNames: string[]
  enrollmentId?: string
  participantLessonIds?: string[]
  groupId?: string
  eventId?: string
  status: string
  originalDate?: string
  locationId?: string
  notes?: string
  bookingId?: string
}

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`

/** Minutes since midnight for a preview `HH:MM` value. */
export const betaMinutes = minutes

/** The first date on or after `from` that falls on the named weekday. */
export function betaNextWeekday(dayName: string, from: string) {
  const target = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(dayName)
  if (target < 0) return ''
  const current = new Date(`${from}T12:00:00Z`).getUTCDay()
  return betaShiftDate(from, (target - current + 7) % 7)
}

/** The academy's preview day, matching the fictional November 2026 records. */
export const betaPreviewToday = '2026-11-04'

export function betaShiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function betaWeekdayName(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
}

/** The academy week, Monday first. */
export function betaWeekStart(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
  return betaShiftDate(date, -((weekday + 6) % 7))
}

/** Lessons already booked in the academy's own records. */
export function betaLessonOccurrences(data: FamilyPreviewData): CalendarOccurrence[] {
  const occurrences = new Map<string, CalendarOccurrence>()
  const owners = new Map(data.students.flatMap(student => student.enrollments.map(enrollment => [enrollment.id, { student, enrollment }] as const)))
  for (const lesson of data.lessons) {
    const owner = owners.get(lesson.enrollmentId)
    if (!owner) continue
    const { student, enrollment } = owner
    const id = lessonOccurrenceId(lesson)
    const previous = occurrences.get(id)
    if (previous) {
      if (previous.date !== lesson.date || previous.start !== lesson.time || previous.end !== clock(minutes(lesson.time) + enrollment.duration) || previous.room !== lesson.room || previous.teacherName !== (lesson.teacher || enrollment.teacher) || (previous.status === 'Cancelled') !== (lesson.status === 'Cancelled')) throw new Error('Shared session assignments disagree; review participant records.')
      previous.studentIds.push(student.id)
      previous.studentNames.push(`${student.firstName} ${student.lastName}`.trim())
      previous.participantLessonIds!.push(lesson.id)
      continue
    }
    const start = minutes(lesson.time)
    occurrences.set(id, {
      id, kind: 'lesson' as const, date: lesson.date, start: lesson.time, end: clock(start + enrollment.duration),
      title: enrollment.program, program: enrollment.program, serviceType: enrollment.service, room: lesson.room || '',
      teacherId: !lesson.teacher || lesson.teacher === enrollment.teacher ? enrollment.teacherId : undefined, teacherName: lesson.teacher || enrollment.teacher,
      studentIds: [student.id], studentNames: [`${student.firstName} ${student.lastName}`.trim()],
      serviceId: enrollment.serviceId, participantLessonIds: [lesson.id],
      enrollmentId: enrollment.id, status: lesson.status === 'Cancelled' ? 'Cancelled' : 'Scheduled', originalDate: lesson.originalDate,
    })
  }
  return [...occurrences.values()]
}

/** Band rehearsals, from the band's own weekly schedule. */
export function betaBandOccurrences(groups: readonly AcademyGroup[], data: FamilyPreviewData, dates: readonly string[]): CalendarOccurrence[] {
  return groups.flatMap(group => {
    // Linked service series already own their session occupancy and participant roster.
    const seriesId = group.seriesId || group.id
    if (data.students.some(student => student.enrollments.some(enrollment => enrollment.seriesId === seriesId))) return []
    const schedule = group.dailySchedule
    if (!schedule?.days?.length || !schedule.from || !schedule.to) return []
    const members = group.memberIds.map(id => data.students.find(student => student.id === id)).filter(Boolean)
    return dates.filter(date => schedule.days.includes(betaWeekdayName(date))).map(date => ({
      id: `${group.id}:${date}`, kind: 'band' as const, date, start: schedule.from, end: schedule.to,
      title: group.name, program: group.name, serviceType: 'Band', room: '',
      teacherName: group.leader || 'Staff team',
      studentIds: members.map(student => student!.id), studentNames: members.map(student => `${student!.firstName} ${student!.lastName}`.trim()),
      groupId: group.id, status: group.stage || 'Confirmed',
    }))
  })
}

/** Event sessions, from the event's own dates and daily schedule. */
export function betaEventOccurrences(events: readonly ExplorerEvent[], dates: readonly string[]): CalendarOccurrence[] {
  return events.flatMap(event => {
    if (!event.start) return []
    const days = event.dailySchedule?.days?.length ? event.dailySchedule.days : null
    const from = event.dailySchedule?.from || '09:00'
    const to = event.dailySchedule?.to || '12:00'
    const sessions = dates.filter(date => date >= event.start && (!event.end || date <= event.end) && (!days || days.includes(betaWeekdayName(date))))
    if (!sessions.length) return []
    const activities = event.activities.length ? event.activities : [{ id: 'event', name: event.name, teacher: '', room: event.location, schedule: '' }]
    return sessions.flatMap(date => activities.map(activity => ({
      id: `${event.id}:${activity.id}:${date}`, kind: 'event' as const, date, start: from, end: to,
      title: activity.name || event.name, program: event.name, serviceType: 'Event', room: activity.room || event.location || '',
      teacherName: activity.teacher || '', studentIds: [], studentNames: [], eventId: event.id, status: event.published ? 'Published' : 'Draft',
    })))
  })
}

/** Everything the academy has scheduled in the given week. */
export function betaCalendarOccurrences(data: FamilyPreviewData, groups: readonly AcademyGroup[], events: readonly ExplorerEvent[], dates: readonly string[]): CalendarOccurrence[] {
  const window = new Set(dates)
  const groupBySeries = new Map(groups.filter(group => group.seriesId).map(group => [group.seriesId!, group.id]))
  const seriesByEnrollment = new Map(data.students.flatMap(student => student.enrollments.map(enrollment => [enrollment.id, enrollment.seriesId] as const)))
  return [
    ...betaLessonOccurrences(data).filter(item => window.has(item.date)).map(item => ({ ...item, groupId: item.enrollmentId ? groupBySeries.get(seriesByEnrollment.get(item.enrollmentId) || '') : undefined })),
    ...betaBandOccurrences(groups, data, dates),
    ...betaEventOccurrences(events, dates),
    ...(data.calendarBookings || []).flatMap(booking => dates.filter(date => booking.status !== 'Cancelled' && (booking.repeat === 'weekly' ? date >= booking.date && date <= booking.until && new Date(`${date}T12:00:00Z`).getUTCDay() === new Date(`${booking.date}T12:00:00Z`).getUTCDay() : date === booking.date)).map(date => ({
      id: booking.id, bookingId: booking.id, kind: booking.kind === 'lesson' ? 'event' as const : booking.kind,
      date, start: booking.time, end: clock(minutes(booking.time) + booking.duration), title: booking.title,
      program: booking.title, serviceType: booking.kind, serviceId: booking.serviceId, locationId: booking.locationId, notes: booking.notes,
      room: booking.roomName || '', teacherId: booking.teacherId || undefined, teacherName: booking.teacherName || '', studentIds: booking.studentIds,
      studentNames: booking.studentIds.map(id => data.students.find(student => student.id === id)).filter(Boolean).map(student => `${student!.firstName} ${student!.lastName}`),
      groupId: booking.groupId || undefined, status: booking.status,
    }))),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.title.localeCompare(b.title))
}

/** The filter choices the calendar offers, taken from what is actually scheduled. */
export function betaCalendarChoices(occurrences: readonly CalendarOccurrence[]) {
  const staff = new Map<string, string>()
  const groups = new Map<string, string>()
  const rooms = new Set<string>()
  const services = new Set<string>()
  for (const item of occurrences) {
    if (item.teacherName) staff.set(item.teacherId || item.teacherName, item.teacherName)
    if (item.groupId) groups.set(item.groupId, item.title)
    if (item.room) rooms.add(item.room)
    if (item.serviceType) services.add(item.serviceType)
  }
  return {
    staff: [...staff].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    groups: [...groups].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    rooms: [...rooms].sort(),
    services: [...services].sort(),
  }
}

export function betaWeekDates(week: string) {
  const monday = betaWeekStart(week)
  return Array.from({ length: 7 }, (_, index) => betaShiftDate(monday, index))
}
