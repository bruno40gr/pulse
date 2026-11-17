import { betaCalendarOccurrences } from './beta-academy-calendar'
import { expandPreviewCalendar } from './academy-makeup-preview'
import { bookingReason, roomRecords, isStaffDuty, dutyEligible, type BookingContext, type CalendarBooking } from './academy-calendar-booking'

/** Resolve actual resource combinations; missing form fields are not errors here. */
export type CalendarBookingConstraints = { teacherId?: string; roomId?: string; serviceId?: string }

export function calendarBookingOptions(context: BookingContext, booking: CalendarBooking, constraints: CalendarBookingConstraints = {}) {
  const rooms = roomRecords(context.setup)
  const teachers = context.setup.teachers || []
  const services = (context.setup.services || []).filter(service => !['room', 'rehearsal', 'event'].includes(service.values.bookingKind))
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(booking.date) && Number.isFinite(Date.parse(booking.date))
  const data = validDate ? expandPreviewCalendar(context.data, booking.date) : context.data
  const occurrences = [...new Map([...(validDate ? betaCalendarOccurrences(data, context.groups, [], [booking.date]) : []), ...context.occurrences].map(item => [item.id, item])).values()]
  const current = { ...context, data, occurrences }
  const valid = (probe: CalendarBooking) => !bookingReason(current, probe, false)
  const candidateTeachers = (probe: CalendarBooking) => probe.teacherId ? teachers.filter(item => item.id === probe.teacherId) : teachers
  const candidateRooms = (probe: CalendarBooking) => probe.roomId ? rooms.filter(item => item.id === probe.roomId) : rooms
  const possible = (probe: CalendarBooking) => probe.kind === 'lesson'
    ? (probe.serviceId ? services.filter(service => service.id === probe.serviceId) : services).some(service => candidateTeachers(probe).some(teacher => candidateRooms(probe).some(room => valid({ ...probe, serviceId: service.id, teacherId: teacher.id, roomId: room.id }))))
    : candidateRooms(probe).some(room => valid({ ...probe, roomId: room.id }))
  if (booking.kind === 'event' && (!Number.isInteger(booking.requiredCapacity) || Number(booking.requiredCapacity) < 1)) return { rooms: [], teachers: teachers.filter(teacher => valid({ ...booking, teacherId: teacher.id, roomId: '' })), services: [], context: current }
  if (isStaffDuty(booking.kind)) return { rooms: rooms.filter(room => room.locationId === booking.locationId && valid({ ...booking, roomId: room.id })), teachers: teachers.filter(teacher => dutyEligible(teacher.values, booking.kind)), services: [], context: current }
  if (booking.kind === 'block') return { rooms: rooms.filter(room => valid({ ...booking, roomId: room.id })), teachers: teachers.filter(teacher => valid({ ...booking, teacherId: teacher.id })), services: [], context: current }
  // A person column lists what that teacher actually teaches; a free room is checked later.
  const teaches = (teacherId: string) => {
    const teacher = teachers.find(item => item.id === teacherId)
    if (!teacher) return [] as string[]
    try { return (JSON.parse(teacher.values.assignments || '[]') as { serviceId: string }[]).map(item => item.serviceId) } catch { return [] as string[] }
  }
  const offered = constraints.teacherId
    ? services.filter(service => (!constraints.serviceId || constraints.serviceId === service.id) && teaches(constraints.teacherId!).includes(service.id))
    : services
  return {
    services: offered.filter(service => constraints.teacherId ? true : (!constraints.serviceId || constraints.serviceId === service.id) && possible({ ...booking, serviceId: service.id, roomId: constraints.roomId || '', teacherId: constraints.teacherId || booking.teacherId })),
    teachers: teachers.filter(teacher => (!constraints.teacherId || constraints.teacherId === teacher.id) && possible({ ...booking, teacherId: teacher.id, roomId: constraints.roomId || '' })),
    rooms: rooms.filter(room => (!constraints.roomId || constraints.roomId === room.id) && possible({ ...booking, roomId: room.id })),
    context: current,
  }
}

/** Keep explicit choices when valid; otherwise remove stale incompatible values. */
export function reconcileCalendarBooking(context: BookingContext, booking: CalendarBooking, constraints: CalendarBookingConstraints = {}) {
  const next = { ...booking, serviceId: booking.kind === 'lesson' ? booking.serviceId : '', publicOnly: false }
  // A calendar resource is an explicit constraint, never an automatic fallback.
  if (constraints.teacherId && next.kind !== 'studio') next.teacherId = constraints.teacherId
  if (constraints.roomId) next.roomId = constraints.roomId
  if (constraints.serviceId && next.kind === 'lesson') next.serviceId = constraints.serviceId
  let options = calendarBookingOptions(context, next, constraints)
  if (next.serviceId && !constraints.serviceId && !options.services.some(item => item.id === next.serviceId)) {
    // Service is the primary choice; changing it clears an incompatible teacher.
    const withoutTeacher = calendarBookingOptions(context, { ...next, teacherId: '' }, constraints)
    if (!constraints.teacherId && withoutTeacher.services.some(item => item.id === next.serviceId)) next.teacherId = ''
    else next.serviceId = ''
    options = calendarBookingOptions(context, next, constraints)
  }
  if (next.teacherId && !constraints.teacherId && !options.teachers.some(item => item.id === next.teacherId)) next.teacherId = ''
  options = calendarBookingOptions(context, next, constraints)
  if (!constraints.roomId && !options.rooms.some(item => item.id === next.roomId)) next.roomId = next.kind === 'block' || isStaffDuty(next.kind) ? '' : options.rooms[0]?.id || ''
  return next
}