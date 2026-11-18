import type { BookingContext } from './academy-calendar-booking'
import { bookingReason, roomRecords } from './academy-calendar-booking'
import { betaCalendarOccurrences } from './beta-academy-calendar'
import { expandPreviewCalendar, makeupPreviewNow, type MakeupSlotResolver } from './academy-makeup-preview'

/** Calendar and Contacts share configuration, occupancy and staff booking policy.
 * Callers remove only the occurrence being moved before requesting slots. */
export function academyRescheduleAvailability(context: Pick<BookingContext, 'setup' | 'groups'> & { events: Parameters<typeof betaCalendarOccurrences>[2] }, includeRooms = false): MakeupSlotResolver {
  return (data, state, makeup, date, program, sameTeacher) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || date <= makeupPreviewNow.slice(0, 10) || program !== makeup.program) return []
    const { setup, groups, events } = context
    const enrollment = data.students.flatMap(student => student.enrollments).find(item => item.id === makeup.enrollmentId)
    const alias = program === 'Voice' ? 'Voice & Vocals' : program === 'Band Program' ? 'Band' : program
    const service = setup.services.find(item => item.id === enrollment?.serviceId) || setup.services.find(item => item.values.name === program || item.values.name === alias)
    if (!service || !(service.values.durations || '').split(',').map(Number).includes(makeup.duration)) return []
    const expanded = expandPreviewCalendar(data, date)
    const occurrences = betaCalendarOccurrences(expanded, groups, events, [date])
    for (const item of occurrences) {
      const booking = expanded.calendarBookings?.find(booking => booking.id === item.bookingId)
      if (booking) {
        item.room = roomRecords(setup).find(room => room.id === booking.roomId)?.name || item.room
        item.teacherName = setup.teachers.find(teacher => teacher.id === booking.teacherId)?.values.name || item.teacherName
      }
    }
    const owners = new Map(data.students.flatMap(student => student.enrollments.map(item => [item.id, student] as const)))
    for (const item of state.items) if (item.booking?.date === date) {
      occurrences.push({ id: item.id, kind: 'lesson', date, start: item.booking.time, end: clock(minute(item.booking.time) + item.duration), title: item.program, program: item.program, serviceType: item.service, room: item.booking.room || '', teacherName: item.booking.teacher, studentIds: [item.studentId], studentNames: [owners.get(item.enrollmentId)?.firstName || ''], status: 'Scheduled' })
    }
    // A reschedule keeps the original room when it is still configured; otherwise any suitable room.
    const roomName = data.lessons.find(item => item.id === makeup.lessonId)?.room || data.lessons.find(item => item.enrollmentId === makeup.enrollmentId)?.room
    // Prefer the lesson's own room but never pin to it: a sibling may need the other room
    // at the same time, and two lessons can run in parallel in different rooms.
    const allRooms = roomRecords(setup)
    const preferred = allRooms.filter(room => roomName && room.name === roomName)
    const rooms = [...preferred, ...allRooms.filter(room => !preferred.includes(room))]
    const teachers = (setup.teachers || []).filter(teacher => teacher.values.name && (!sameTeacher || teacher.values.name === makeup.teacher))
    return Array.from({ length: 32 }, (_, index) => clock(360 + index * 30)).flatMap(time => {
      if (minute(time) + makeup.duration > 1320) return []
      return teachers.flatMap(teacher => {
        const fits = (room: typeof rooms[number]) => !bookingReason({ data: expanded, setup, groups, occurrences }, { id: 'reschedule-probe', kind: 'lesson', title: program, date, time, duration: makeup.duration, serviceId: service.id, teacherId: teacher.id, roomId: room.id, studentIds: [makeup.studentId], groupId: '', repeat: 'once', until: date, publicOnly: false, status: 'Scheduled' }, false)
        const slot = { date, time, teacher: teacher.values.name, program }
        return includeRooms ? rooms.filter(fits).map(room => ({ ...slot, room: room.name })) : rooms.some(fits) ? [slot] : []
      })
    })
  }
}

const minute = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`