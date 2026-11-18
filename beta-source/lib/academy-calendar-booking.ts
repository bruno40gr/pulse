import type { FamilyPreviewData } from './academy-family-preview'
import type { AcademyGroup } from './academy-explorer'
import type { SetupRecord } from '../app/content-studio-prototype/school-setup/setup-content'
import { teacherAvailabilityForDate, teacherWeekAvailability, type TeacherAvailability, type TeacherDateOverride, type TeacherTimeOff, type TeacherWeekSchedule } from '../app/content-studio-prototype/school-setup/setup-content'
import { betaCalendarOccurrences, type CalendarOccurrence } from './beta-academy-calendar'
import { expandPreviewCalendar } from './academy-makeup-preview'
import { betaAcademyTeachers } from './beta-academy-schedule'
import { readSchedulingPolicy, teachingPolicyReason, timeMinutes } from './academy-scheduling-policy'
import { projectBetaEnrollment } from './beta-workflow-projection'
import { lessonPrice, lessonStudent, type StaffEnrollment, type LessonChoice } from './academy-staff-enrollment'
import { lessonOccursOn } from './academy-enrollment-schedule'

export type CalendarBookingKind = 'lesson' | 'studio' | 'rehearsal' | 'event' | 'block' | 'front-desk' | 'admin'
export type CalendarBooking = {
  id: string; kind: CalendarBookingKind; title: string; date: string; time: string; duration: number
  serviceId: string; teacherId: string; roomId: string; studentIds: string[]; participantIds?: string[]; groupId: string
  repeat: 'once' | 'weekly'; until: string; publicOnly: boolean; status: 'Scheduled' | 'Cancelled'
  roomName?: string; teacherName?: string
  arrangement?: 'À-la-carte' | 'Monthly subscription'
  locationId?: string
  notes?: string
  requiredCapacity?: number
}
export const isStaffDuty = (kind: string) => kind === 'front-desk' || kind === 'admin'
export const staffDutyLabel = (kind: string) => kind === 'front-desk' ? 'Front desk' : 'Admin'
export function dutyEligible(values: Record<string, string>, kind: string) { return values[kind === 'front-desk' ? 'canCoverFrontDesk' : 'canPerformAdmin'] === 'yes' }
export type BookingContext = { data: FamilyPreviewData; setup: Record<string, SetupRecord[]>; groups: readonly AcademyGroup[]; occurrences: readonly CalendarOccurrence[]; audience?: 'staff' | 'public' }
export function parseSchedule<T>(value: string | undefined, fallback: T): T { try { return value ? JSON.parse(value) as T : fallback } catch { return fallback } }
export function bookingOnDate(booking: CalendarBooking, date: string) {
  if (booking.status === 'Cancelled') return false
  if (booking.repeat !== 'weekly') return booking.date === date
  return date >= booking.date && date <= booking.until && new Date(`${date}T12:00:00Z`).getUTCDay() === new Date(`${booking.date}T12:00:00Z`).getUTCDay()
}
export function configuredBlocks(setup: Record<string, SetupRecord[]>): CalendarBooking[] {
  return (setup.resourceBlocks || []).map(record => parseSchedule<CalendarBooking | null>(record.values.booking, null)).filter((item): item is CalendarBooking => Boolean(item))
}
export function roomRecords(setup: Record<string, SetupRecord[]>) {
  return (setup.locations || []).flatMap(location => (location.rooms || []).map(room => ({ ...room, locationId: location.id })))
}
export function teacherHours(setup: Record<string, SetupRecord[]>, teacherId: string, date: string) {
  const record = setup.teachers?.find(item => item.id === teacherId)
  if (!record) return []
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const base = parseSchedule<TeacherAvailability[]>(record.values.availability, days.flatMap((day, index) => record.values.days?.includes(day) ? [{ id: `legacy:${index}`, day: index, from: timeMinutes(record.values.from || '09:00'), to: timeMinutes(record.values.to || '21:00') }] : []))
  return teacherAvailabilityForDate(teacherWeekAvailability(base, parseSchedule<TeacherWeekSchedule[]>(record.values.availabilityWeeks, []), date), parseSchedule<TeacherDateOverride[]>(record.values.availabilityOverrides, []), parseSchedule<TeacherTimeOff[]>(record.values.timeOff, []), date)
}
const overlap = (from: number, to: number, start: number, end: number) => from < end && start < to
export function bookingParticipants(booking: CalendarBooking, groups: readonly AcademyGroup[]) {
  return [...new Set([...booking.studentIds, ...(booking.participantIds || []), ...(groups.find(group => group.id === booking.groupId)?.memberIds || [])])]
}
/** Occupancy is the planned activity size, not just the currently enrolled roster. */
export function bookingCapacity(context: BookingContext, booking: CalendarBooking) {
  const service = context.setup.services?.find(item => item.id === booking.serviceId)
  const groupFormat = parseSchedule<string[]>(service?.values.formats, []).some(format => ['group', 'semi'].includes(format))
  const configured = Number(service?.values.capacity)
  return Math.max(bookingParticipants(booking, context.groups).length, booking.requiredCapacity || 0, groupFormat ? (configured > 0 ? configured : Infinity) : 1)
}

export function roomSupportsBooking(context: BookingContext, booking: CalendarBooking, room: ReturnType<typeof roomRecords>[number]) {
  if (booking.kind === 'block' || isStaffDuty(booking.kind)) return true
  if (bookingCapacity(context, booking) > Number(room.capacity)) return false
  if (booking.kind === 'lesson') return Boolean(room.allServices || room.serviceIds.includes(booking.serviceId))
  // Studio hire belongs to rooms the school lists for it, not to every bookable space.
  if (booking.kind === 'rehearsal' || booking.kind === 'event' || booking.kind === 'studio') return Boolean(room.allServices || context.setup.services?.some(service => service.values.bookingKind === (booking.kind === 'studio' ? 'room' : booking.kind) && room.serviceIds.includes(service.id)))
  return true
}
/** One decision for drawing, modal choices, final save, and public preview. */
export function bookingReason(context: BookingContext, booking: CalendarBooking, validateFields = true): string | null {
  const { data, setup, groups, occurrences, audience = 'staff' } = context
  const duty = isStaffDuty(booking.kind)
  const from = timeMinutes(booking.time), to = from + booking.duration
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.date) || !Number.isFinite(Date.parse(booking.date)) || new Date(booking.date).toISOString().slice(0, 10) !== booking.date) return 'Choose a valid date.'
  // Configured services may teach 45-minute classes; their duration must still align to 15 minutes.
  const configuredDurations = (booking.serviceId ? setup.services?.find(item => item.id === booking.serviceId)?.values.durations || '' : '').split(',').map(value => Number(value.trim())).filter(value => Number.isFinite(value) && value > 0)
  const offeredDuration = configuredDurations.includes(booking.duration)
  const duration = Number.isInteger(booking.duration) && booking.duration >= 30 && (booking.duration % 30 === 0 || (booking.duration % 15 === 0 && offeredDuration))
  if (!/^(?:[01]\d|2[0-3]):(?:00|30)$/.test(booking.time) || !duration || from < 360 || to > 1320) return 'Choose 30-minute increments between 6am and 10pm.'
  if (booking.repeat === 'weekly' && (!booking.until || booking.until < booking.date || booking.until > shiftBookingDate(booking.date, 364))) return 'Choose an end date within one year for the weekly block.'
  const teacher = setup.teachers?.find(item => item.id === booking.teacherId)
  const room = roomRecords(setup).find(item => item.id === booking.roomId)
  const service = setup.services?.find(item => item.id === booking.serviceId)
  const studentIds = bookingParticipants(booking, groups)
  if (booking.teacherId && !teacher) return 'Choose an available teacher.'
  if (booking.roomId && !room) return 'Choose an available room.'
  if (booking.groupId && !groups.some(group => group.id === booking.groupId)) return 'Choose an existing band.'
  if (studentIds.some(id => !data.students.some(student => student.id === id))) return 'A participant is no longer in the academy.'
  if (duty) {
    if (audience === 'public') return 'Staff duties are internal and cannot be self-booked.'
    if (!teacher || !dutyEligible(teacher.values, booking.kind)) return 'Choose a staff member eligible for this duty in teacher setup.'
    if (!setup.locations?.some(location => location.id === booking.locationId)) return 'Choose a location for this duty.'
    const locations = parseSchedule<string[]>(teacher.values.locationIds, teacher.values.location ? [teacher.values.location] : [])
    if (!locations.includes(booking.locationId!)) return 'The staff member is not assigned to this location.'
    if (room && room.locationId !== booking.locationId) return 'Choose a room at the duty location.'
    if (booking.studentIds.length || booking.groupId || booking.serviceId || booking.publicOnly) return 'Staff duties cannot contain participants, services or public availability.'
  } else if (booking.kind === 'block') {
    if (!teacher && !room) return 'Choose a teacher or room to block.'
    if (booking.studentIds.length || booking.groupId) return 'Blocks cannot contain participants or a band.'
  } else if (validateFields) {
    if (booking.kind === 'lesson' && !service) return 'Choose a service.'
    if (booking.kind === 'event' && (!Number.isInteger(booking.requiredCapacity) || Number(booking.requiredCapacity) < 1)) return 'Enter the required event capacity.'
    if (!room) return 'Choose a room.'
    if (booking.kind === 'lesson' && (!teacher || studentIds.length !== 1 || !(configuredDurations.length ? configuredDurations : [30, 60]).includes(booking.duration))) return 'Lessons need one student, a teacher, and a length this service offers.'
    if (booking.repeat !== 'once') return 'Use a single booking here. Weekly recurrence is available for blocks.'
  }
  if (teacher && booking.kind !== 'block') {
    if (!teacherHours(setup, teacher.id, booking.date).some(block => from >= block.from && to <= block.to)) return 'The teacher is unavailable during this time.'
    if (booking.kind === 'lesson' && service) {
      const assignments = parseSchedule<{ serviceId: string }[]>(teacher.values.assignments, [{ serviceId: teacher.values.service }])
      if (!assignments.some(item => item.serviceId === service.id)) return 'This teacher does not teach the selected service.'
    }
    if (room && teacher.values.locationIds && !parseSchedule<string[]>(teacher.values.locationIds, []).includes(room.locationId)) return 'The teacher is not assigned to this location.'
    if (room && !teacher.values.locationIds && teacher.values.location && teacher.values.location !== room.locationId) return 'The teacher is not assigned to this location.'
  }
  if (room && booking.kind !== 'block' && !duty) {
    if (bookingCapacity(context, booking) > Number(room.capacity)) return 'The required participant capacity exceeds room capacity.'
    if (booking.kind === 'lesson' && service && !room.allServices && !room.serviceIds.includes(service.id)) return 'This room is not configured for that lesson service.'
    if ((booking.kind === 'rehearsal' || booking.kind === 'event') && !roomSupportsBooking(context, booking, room)) return `This room is not configured for ${booking.kind === 'rehearsal' ? 'band rehearsal' : 'events'}.`
  }
  const policy = setup.policies?.[0]?.values || {}
  const closureLocation = booking.locationId || room?.locationId
  const closures = parseSchedule<{ start: string; end: string; location: string }[]>(policy.closures, [])
  if (booking.kind !== 'block' && (closures.some(item => booking.date >= item.start && booking.date <= item.end && (!closureLocation || item.location === 'all' || item.location === closureLocation)) || (policy.start && policy.end && booking.date >= policy.start && booking.date <= policy.end))) return 'The academy or location is closed.'
  const blocked = [...configuredBlocks(setup), ...(data.calendarBookings || []).filter(item => item.kind === 'block')]
  if (blocked.some(item => item.id !== booking.id && bookingOnDate(item, booking.date) && (!item.publicOnly || audience === 'public') && ((item.teacherId && item.teacherId === booking.teacherId) || (item.roomId && item.roomId === booking.roomId)) && overlap(from, to, timeMinutes(item.time), timeMinutes(item.time) + item.duration))) return 'This time is blocked for the teacher or room.'
  const dutyConflicts = (data.calendarBookings || []).filter(item => item.id !== booking.id && isStaffDuty(item.kind) && bookingOnDate(item, booking.date) && overlap(from, to, timeMinutes(item.time), timeMinutes(item.time) + item.duration))
  if (dutyConflicts.some(item => (booking.teacherId && item.teacherId === booking.teacherId) || (booking.roomId && item.roomId === booking.roomId))) return 'The staff member or room is already assigned to a duty.'
  const conflicts = occurrences.filter(item => item.id !== booking.id && item.date === booking.date && item.status !== 'Cancelled' && item.kind !== 'block' && overlap(from, to, timeMinutes(item.start), timeMinutes(item.end)))
  for (const item of conflicts) {
    if (teacher && ((item.teacherIds || [item.teacherId]).includes(teacher.id) || (item.teacherNames || [item.teacherName]).includes(teacher.values.name))) return 'The teacher already has a booking.'
    if (room && (item.rooms || [item.room]).includes(room.name)) return 'The room already has an exclusive booking.'
    if (studentIds.some(id => item.studentIds.includes(id))) return 'A participant already has a booking at this time.'
  }
  if (teacher && booking.kind !== 'block' && !duty) {
    const rules = readSchedulingPolicy(policy, teacher.values)
    if (audience === 'public' && (!rules.publicEnabled || from < timeMinutes(rules.publicFrom) || to > timeMinutes(rules.publicTo))) return 'This time is not offered for public self-booking.'
    const teaching = occurrences.filter(item => item.date === booking.date && item.status !== 'Cancelled' && item.kind !== 'block' && !isStaffDuty(item.kind) && ((item.teacherIds || [item.teacherId]).includes(teacher.id) || (item.teacherNames || [item.teacherName]).includes(teacher.values.name)))
    const shift = teacherHours(setup, teacher.id, booking.date).find(block => from >= block.from && to <= block.to)
    const sameShift = teaching.filter(item => !shift || (timeMinutes(item.start) >= shift.from && timeMinutes(item.end) <= shift.to))
    const reason = teachingPolicyReason(sameShift.map(item => ({ time: item.start, duration: timeMinutes(item.end) - timeMinutes(item.start) })), booking.time, booking.duration, rules)
    if (reason) return reason
  }
  if (audience === 'public' && !teacher) {
    const rules = readSchedulingPolicy(policy)
    if (!rules.publicEnabled || from < timeMinutes(rules.publicFrom) || to > timeMinutes(rules.publicTo)) return 'This time is not offered for public self-booking.'
  }
  return null
}
export function shiftBookingDate(date: string, days: number) { const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + days); return next.toISOString().slice(0, 10) }
export function bookingDates(booking: CalendarBooking) {
  if (booking.repeat !== 'weekly') return [booking.date]
  const dates: string[] = []
  for (let date = booking.date; date <= booking.until && dates.length < 53; date = shiftBookingDate(date, 7)) dates.push(date)
  return dates
}
export function saveCalendarBooking(context: BookingContext, booking: CalendarBooking): FamilyPreviewData {
  if (booking.kind === 'lesson') throw new Error('Continue to enrollment to review lesson pricing, payer and payment before booking.')
  if ((context.data.calendarBookings || []).some(item => item.id === booking.id)) throw new Error('This booking has already been saved.')
  const dates = bookingDates(booking)
  if (!dates.length) throw new Error('Choose booking dates.')
  const expanded = expandPreviewCalendar(context.data, dates[dates.length - 1])
  for (const date of dates) {
    const occurrences = betaCalendarOccurrences(expanded, context.groups, [], [date]).map(item => {
      const stored = expanded.calendarBookings?.find(booking => booking.id === item.bookingId)
      return stored ? { ...item, room: roomRecords(context.setup).find(room => room.id === stored.roomId)?.name || '', teacherName: context.setup.teachers.find(teacher => teacher.id === stored.teacherId)?.values.name || '' } : item
    })
    const external = context.occurrences.filter(item => item.kind === 'event' && item.date === date)
    const reason = bookingReason({ ...context, data: expanded, occurrences: [...occurrences, ...external] }, { ...booking, date })
    if (reason) throw new Error(`${date}: ${reason}`)
  }
  return { ...expanded, calendarBookings: [...(expanded.calendarBookings || []), { ...booking, title: isStaffDuty(booking.kind) ? staffDutyLabel(booking.kind) : booking.title, roomName: roomRecords(context.setup).find(item => item.id === booking.roomId)?.name || '', teacherName: context.setup.teachers.find(item => item.id === booking.teacherId)?.values.name || '', studentIds: bookingParticipants(booking, context.groups) }] }
}

/** A calendar selection is a proposal for the existing enrollment UI, not a booking. */
export function calendarEnrollmentLesson(context: BookingContext, booking: CalendarBooking): Partial<LessonChoice> {
  const reason = bookingReason(context, booking)
  if (reason) throw new Error(reason)
  const service = context.setup.services.find(item => item.id === booking.serviceId)!
  const teacher = context.setup.teachers.find(item => item.id === booking.teacherId)!
  return { service: ['Tiny Keys', 'Little Rockers', 'Band'].includes(service.values.name) ? 'Group' : 'Private', instrument: service.values.name === 'Voice & Vocals' ? 'Voice' : service.values.name === 'Band' ? 'Band Program' : service.values.name, teacher: teacher.values.name, start: booking.date, time: booking.time, day: new Date(`${booking.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }), duration: String(booking.duration), studentId: booking.studentIds[0], frequency: booking.arrangement || 'À-la-carte', roomId: booking.roomId, serviceId: booking.serviceId }
}

function enrollmentProbe(context: BookingContext, lesson: LessonChoice, date: string, time: string, teacherId: string): CalendarBooking {
  const service = context.setup.services.find(item => item.id === lesson.serviceId) || context.setup.services.find(item => item.values.name === (lesson.instrument === 'Voice' ? 'Voice & Vocals' : lesson.instrument === 'Band Program' ? 'Band' : lesson.instrument))
  return { id: `enrollment-probe:${lesson.id}`, kind: 'lesson', title: lesson.instrument, date, time, duration: Number(lesson.duration), serviceId: service?.id || '', teacherId, roomId: lesson.roomId || '', studentIds: [lesson.studentId || ''], groupId: '', repeat: 'once', until: date, publicOnly: false, status: 'Scheduled' }
}

function enrollmentRooms(context: BookingContext, probe: CalendarBooking) {
  return roomRecords(context.setup).filter(room => !probe.roomId || room.id === probe.roomId)
}

export function calendarEnrollmentAvailability(context: BookingContext, events: Parameters<typeof betaCalendarOccurrences>[2]) {
  const teachers = betaAcademyTeachers(context.setup)
  const days = new Map<string, BookingContext>()
  return (date: string, time: string, lesson: LessonChoice, siblings: readonly LessonChoice[] = []) => {
    if (!date || !time || !lesson.studentId || !time.endsWith(':00') && !time.endsWith(':30')) return []
    let day = days.get(date)
    if (!day) {
      const data = expandPreviewCalendar(context.data, date)
      day = { ...context, data, occurrences: betaCalendarOccurrences(data, context.groups, events, [date]) }
      days.set(date, day)
    }
    const occurrences = [...day.occurrences]
    const proposed = { ...day, occurrences }
    for (const sibling of siblings) {
      if (sibling.id === lesson.id || !lessonOccursOn(sibling, date)) continue
      const teacher = teachers.find(item => item.name === sibling.teacher)
      const probe = enrollmentProbe(proposed, sibling, date, sibling.time, teacher?.id || '')
      const room = enrollmentRooms(proposed, probe).find(item => !bookingReason(proposed, { ...probe, roomId: item.id }))
      const end = timeMinutes(sibling.time) + probe.duration
      occurrences.push({ id: probe.id, kind: 'lesson', date, start: sibling.time, end: `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`, title: sibling.instrument, program: sibling.instrument, serviceType: sibling.service, room: room?.name || '', teacherName: sibling.teacher, teacherId: teacher?.id, studentIds: probe.studentIds, studentNames: [], status: 'Scheduled' })
    }
    return teachers.filter(teacher => {
      const probe = enrollmentProbe(proposed, lesson, date, time, teacher.id)
      return enrollmentRooms(proposed, probe).some(room => !bookingReason(proposed, { ...probe, roomId: room.id }))
    }).map(teacher => ({ name: teacher.name }))
  }
}

export class EnrollmentTimeError extends Error {
  constructor(public readonly lessonId: string, message: string) { super(message) }
}

/** Reuse enrollment's price/payment decisions and validate its proposed series before writing. */
export function completeCalendarEnrollment(context: BookingContext, draft: StaffEnrollment, enrollmentId: string, events: Parameters<typeof betaCalendarOccurrences>[2] = []): FamilyPreviewData {
  let working = context.data
  for (const [index, lesson] of draft.lessons.entries()) {
    const teacher = betaAcademyTeachers(context.setup).find(item => item.name === lesson.teacher)
    const studentId = lesson.studentId || draft.student?.id || ''
    const initial = enrollmentProbe(context, { ...lesson, studentId }, lesson.start, lesson.time, teacher?.id || '')
    // Validate a rolling year for an ongoing subscription; it is not an infinite guarantee.
    const dates = Array.from({ length: lesson.frequency === 'À-la-carte' ? 1 : 52 }, (_, week) => shiftBookingDate(lesson.start, week * 7))
    const expanded = expandPreviewCalendar(working, dates[dates.length - 1])
    const occurrences = betaCalendarOccurrences(expanded, context.groups, events, dates)
    let problem = 'No suitable room is available.'
    const room = enrollmentRooms(context, initial).find(candidate => dates.every(date => {
      const reason = bookingReason({ ...context, data: expanded, occurrences }, { ...initial, date, roomId: candidate.id })
      if (reason) problem = `${date}: ${reason}`
      return !reason
    }))
    if (!room) throw new EnrollmentTimeError(lesson.id, `${lessonStudent(draft, lesson)?.firstName || 'Student'} · ${lesson.instrument}: ${problem}`)
    initial.roomId = room.id
    const payerId = draft.payer === 'manager' ? draft.manager?.id || draft.contact?.id || '' : draft.payer === 'other' ? draft.contact?.id || '' : draft.student?.id || draft.contact?.id || ''
    const price = lessonPrice(lesson, lessonStudent(draft, lesson)).total
    working = projectBetaEnrollment(working, { enrollmentId: `${enrollmentId}:lesson:${index}`, studentId, payerId, otherPayer: draft.payer === 'other' ? draft.otherPayer || undefined : undefined, amountMinor: price, paid: draft.payment !== 'later', paymentMethod: draft.payment === 'later' ? 'Add payment later' : 'Demo Visa ···· 4242', lessons: [{ service: lesson.service, instrument: lesson.instrument, teacher: lesson.teacher, teacherId: teacher?.id, start: lesson.start, time: lesson.time, duration: Number(lesson.duration), frequency: lesson.frequency === 'À-la-carte' ? 'One-off' : 'Weekly', amountMinor: price, room: roomRecords(context.setup).find(room => room.id === initial.roomId)!.name }] })
    working = { ...working, students: working.students.map(student => ({ ...student, enrollments: student.enrollments.map(enrollment => enrollment.id === `${enrollmentId}:lesson:${index}:0` ? { ...enrollment, serviceId: initial.serviceId } : enrollment) })) }
  }
  return working
}