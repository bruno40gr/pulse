import type { AcademyWorkspaceState } from '@/beta-source/lib/academy-workspace-storage'
import { bookingDates, bookingReason, configuredBlocks, roomRecords, shiftBookingDate, type CalendarBooking } from '@/beta-source/lib/academy-calendar-booking'
import { betaCalendarOccurrences } from '@/beta-source/lib/beta-academy-calendar'
import { expandPreviewCalendar } from '@/beta-source/lib/academy-makeup-preview'
import { lessonOccurrenceId } from '@/beta-source/lib/academy-session'
import { validateSchedulingPolicy } from '@/beta-source/lib/academy-scheduling-policy'
import { validateTeacherExceptions } from '@/beta-source/app/content-studio-prototype/school-setup/setup-content'

const validDate = (value: string) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const unique = (items: { id: string }[]) => items.every(item => item && typeof item.id === 'string' && item.id.length > 0) && new Set(items.map(item => item.id)).size === items.length

/** Server recomputes occupancy from the entire proposed snapshot, never client probes.
 * Revision comparison and the write use the same expected revision in the locking RPC.
 * Ongoing subscriptions are checked for a rolling year, not an infinite guarantee.
 */
export function academySchedulingError(state: AcademyWorkspaceState, previous: AcademyWorkspaceState | null, today: string): string | null {
  try {
    const { data } = state.snapshot
    const setup = state.setup
    if (!validDate(today)) return 'Invalid scheduling validation date.'
    if (!Array.isArray(data.calendarBookings ?? []) || !Array.isArray(state.snapshot.makeups.items) || !Array.isArray(state.snapshot.makeups.absences)) return 'Invalid calendar or makeup records.'
    for (const records of Object.values(setup)) {
      if (!Array.isArray(records) || !unique(records) || records.some(record => !record.values || Object.values(record.values).some(value => typeof value !== 'string'))) return 'Invalid or duplicate School Setup records.'
    }
    if (!unique(data.students) || !unique(data.lessons) || !unique(data.calendarBookings || [])) return 'Duplicate or missing calendar identities.'
    const enrollments = data.students.flatMap(student => student.enrollments)
    if (!unique(enrollments) || data.students.some(student => student.enrollments.some(enrollment => enrollment.studentId !== student.id))) return 'Invalid enrollment owner or duplicate enrollment identity.'
    const rooms = roomRecords(setup)
    if (new Set(setup.teachers.map(teacher => teacher.values.name)).size !== setup.teachers.length) return 'Staff names must resolve unambiguously until every legacy lesson has a staff ID.'
    if (!unique(rooms) || new Set(rooms.map(room => room.name)).size !== rooms.length || rooms.some(room => !room.name || !Number.isInteger(Number(room.capacity)) || Number(room.capacity) < 1 || !Array.isArray(room.serviceIds) || room.serviceIds.some(id => !setup.services.some(service => service.id === id)))) return 'Invalid room identity, capacity or service configuration.'
    for (const policy of setup.policies) {
      const error = validateSchedulingPolicy(policy.values)
      if (error) return error
      const closures = JSON.parse(policy.values.closures || '[]')
      if (!Array.isArray(closures) || closures.some(item => !validDate(item.start) || !validDate(item.end) || item.end < item.start || (item.location !== 'all' && !setup.locations.some(location => location.id === item.location)))) return 'Invalid school closures.'
    }
    for (const teacher of setup.teachers) {
      const error = validateTeacherExceptions(teacher.values)
      if (error) return error
      const weekly = JSON.parse(teacher.values.availability || '[]')
      if (!Array.isArray(weekly) || weekly.some(item => !Number.isInteger(item.day) || item.day < 0 || item.day > 6 || !Number.isInteger(item.from) || !Number.isInteger(item.to) || item.from < 360 || item.to > 1320 || item.from >= item.to) || weekly.some((item, i) => weekly.some((other, j) => i !== j && item.day === other.day && item.from < other.to && other.from < item.to))) return 'Invalid weekly staff availability.'
      const assignments = JSON.parse(teacher.values.assignments || '[]')
      if (!Array.isArray(assignments) || assignments.some(item => !item || !setup.services.some(service => service.id === item.serviceId) || !Number.isInteger(item.maxLevel) || item.maxLevel < 1) || new Set(assignments.map(item => item.serviceId)).size !== assignments.length) return 'Invalid staff teaching assignments.'
      const locations = JSON.parse(teacher.values.locationIds || JSON.stringify(teacher.values.location ? [teacher.values.location] : []))
      if (!Array.isArray(locations) || locations.some(id => !setup.locations.some(location => location.id === id))) return 'Invalid staff location assignment.'
    }
    const previousBookings = previous?.snapshot.data.calendarBookings || []
    const bookings = [...(data.calendarBookings || []), ...configuredBlocks(setup)]
    if ((setup.resourceBlocks || []).length !== configuredBlocks(setup).length || !unique(bookings)) return 'Invalid or duplicate resource blocks.'
    if (data.students.length > 2000 || enrollments.length > 5000 || bookings.length > 5000 || data.lessons.length > 30000) return 'The school schedule exceeds the validation limit.'
    for (const responsibility of setup.adminResponsibilities || []) {
      if (!responsibility.values.name?.trim() || !['Yes', 'No'].includes(responsibility.values.enabled)) return 'Set a name and availability for each Admin responsibility.'
    }
    if (previous?.setup.adminResponsibilities?.some(old => !(setup.adminResponsibilities || []).some(item => item.id === old.id))) return 'Archive Admin responsibilities instead of deleting historical references.'
    for (const booking of bookings) {
      if (!['lesson', 'studio', 'rehearsal', 'event', 'block', 'admin', 'front-desk'].includes(booking.kind) || !['Scheduled', 'Cancelled'].includes(booking.status) || !['once', 'weekly'].includes(booking.repeat) || !Array.isArray(booking.studentIds) || (booking.participantIds !== undefined && !Array.isArray(booking.participantIds)) || !validDate(booking.date) || (booking.repeat === 'weekly' && (!validDate(booking.until) || booking.until < booking.date || booking.until > shiftBookingDate(booking.date, 364)))) return 'Invalid booking fields or recurrence.'
      if (booking.kind === 'front-desk' && !previousBookings.some(item => item.id === booking.id && JSON.stringify(item) === JSON.stringify(booking))) return 'Use Admin with a configured responsibility for new or changed Front desk assignments.'
      if (booking.groupId) return 'Group assignments require an authoritative shared group roster before live workspace saving.'
      if (booking.kind === 'lesson' && (!Number.isInteger(booking.level) || Number(booking.level) < 1)) return 'Lesson bookings require an explicit teaching level.'
      if (!previousBookings.some(item => item.id === booking.id) && booking.date < today) return 'New historical assignments require a reviewed import, not a calendar save.'
      if (booking.excludedDates && (!Array.isArray(booking.excludedDates) || booking.excludedDates.some(date => !validDate(date) || date < booking.date || date > booking.until) || new Set(booking.excludedDates).size !== booking.excludedDates.length)) return 'Invalid assignment occurrence exclusions.'
      if (booking.kind === 'admin') {
        const old = previousBookings.find(item => item.id === booking.id)
        if (!old && booking.responsibilityName !== setup.adminResponsibilities?.find(item => item.id === booking.responsibilityId)?.values.name) return 'Use the configured Admin responsibility label for new assignments.'
        if (old?.responsibilityName && old.responsibilityId === booking.responsibilityId && old.responsibilityName !== booking.responsibilityName) return 'Preserve the original Admin responsibility label on existing assignments.'
      }
    }
    for (const lesson of data.lessons) {
      if (!validDate(lesson.date) || !['Scheduled', 'Completed', 'Cancelled', 'Absent', 'No-show', 'Present'].includes(lesson.status) || !enrollments.some(enrollment => enrollment.id === lesson.enrollmentId)) return 'Invalid lesson date, status or enrollment reference.'
    }
    for (const enrollment of enrollments) {
      if (!validDate(enrollment.start) || !['active', 'pending'].includes(enrollment.status) || !['Weekly', 'One-off'].includes(enrollment.frequency) || !Number.isInteger(enrollment.level) || enrollment.level < 1 || !Number.isInteger(enrollment.duration) || enrollment.duration < 30) return 'Invalid enrollment schedule, duration or teaching level.'
    }
    const horizon = shiftBookingDate(today, 364)
    const through = [...bookings.map(item => item.repeat === 'weekly' ? item.until : item.date), ...data.lessons.map(item => item.date), horizon].sort().at(-1)!
    if (through > shiftBookingDate(today, 730)) return 'Schedule no more than two years ahead.'
    const estimated = data.lessons.length + enrollments.filter(item => item.frequency === 'Weekly').reduce((count, item) => count + Math.max(0, Math.ceil((Date.parse(through) - Date.parse(item.start)) / 604800000)), 0)
    if (estimated > 30000) return 'The school schedule exceeds the bounded recurrence validation limit.'
    if (enrollments.some(enrollment => enrollment.frequency === 'Weekly' && enrollment.start < shiftBookingDate(today, -730))) return 'Older recurring schedules require an explicit bounded occurrence migration.'
    const expanded = expandPreviewCalendar(data, through)
    if (expanded.lessons.length > 30000) return 'The school schedule exceeds the validation limit.'
    const dates = [...new Set([...expanded.lessons.filter(item => item.date >= today && item.status !== 'Cancelled').map(item => item.date), ...bookings.filter(item => item.status !== 'Cancelled').flatMap(bookingDates).filter(date => date >= today)])].sort()
    const occurrences = betaCalendarOccurrences({ ...expanded, calendarBookings: bookings }, [], [], dates).map(item => {
      const stored = bookings.find(booking => booking.id === item.bookingId)
      return stored ? { ...item, room: rooms.find(room => room.id === stored.roomId)?.name || '', teacherName: setup.teachers.find(teacher => teacher.id === stored.teacherId)?.values.name || '' } : item
    })
    const dayOccurrences = new Map(dates.map(date => [date, occurrences.filter(item => item.date === date)]))
    const check = (booking: CalendarBooking) => bookingReason({ data: expanded, setup, groups: [], occurrences: dayOccurrences.get(booking.date) || [] }, booking)
    for (const booking of bookings.filter(item => item.status !== 'Cancelled')) {
      // A historical responsibility may be archived, but cannot be newly assigned.
      const old = previousBookings.find(item => item.id === booking.id && JSON.stringify(item) === JSON.stringify(booking))
      for (const date of bookingDates(booking).filter(date => date >= today)) {
        let error: string | null
        if (old && booking.kind === 'admin') {
          const compatibleSetup = { ...setup, adminResponsibilities: (setup.adminResponsibilities || []).map(item => item.id === booking.responsibilityId ? { ...item, values: { ...item.values, enabled: 'Yes' } } : item) }
          error = bookingReason({ data: expanded, setup: compatibleSetup, groups: [], occurrences: dayOccurrences.get(date) || [] }, { ...booking, date })
        } else error = check({ ...booking, date })
        if (error) return `${booking.id} · ${date}: ${error}`
      }
    }
    const priorEnrollments = previous?.snapshot.data.students.flatMap(student => student.enrollments) || []
    for (const lesson of expanded.lessons.filter(item => item.date >= today && item.status !== 'Cancelled')) {
      const enrollment = enrollments.find(item => item.id === lesson.enrollmentId)!
      const teacherName = lesson.teacher || enrollment.teacher
      const teacher = enrollment.teacherId && teacherName === enrollment.teacher ? setup.teachers.find(item => item.id === enrollment.teacherId) : setup.teachers.find(item => item.values.name === teacherName)
      const serviceName = enrollment.program === 'Voice' ? 'Voice & Vocals' : enrollment.program === 'Band Program' ? 'Band' : enrollment.program
      const service = enrollment.serviceId ? setup.services.find(item => item.id === enrollment.serviceId) : setup.services.find(item => item.values.name === serviceName)
      const room = rooms.find(item => item.name === lesson.room)
      if (!teacher || !service || !room) return `${lesson.id}: Resolve the lesson teacher, service and room in School Setup.`
      const previousLevel = priorEnrollments.find(item => item.id === enrollment.id)?.level || 1
      if (enrollment.level < previousLevel) return `${enrollment.id}: A workspace save cannot silently lower an existing teaching level.`
      const requiredCapacity = dayOccurrences.get(lesson.date)?.find(item => item.id === lessonOccurrenceId(lesson))?.studentIds.length || 1
      const error = check({ id: lessonOccurrenceId(lesson), kind: 'lesson', title: service.values.name, date: lesson.date, time: lesson.time, duration: enrollment.duration, level: enrollment.level, requiredCapacity, serviceId: service.id, teacherId: teacher.id, roomId: room.id, studentIds: [enrollment.studentId], groupId: '', repeat: 'once', until: lesson.date, publicOnly: false, status: 'Scheduled' })
      if (error) return `${lesson.id} · ${lesson.date}: ${error}`
    }
    return null
  } catch {
    return 'Malformed scheduling data. Review School Setup and calendar records before saving.'
  }
}