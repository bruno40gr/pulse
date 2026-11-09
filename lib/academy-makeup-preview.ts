import type { FamilyPreviewData } from './academy-family-preview'
import { availableScheduleTeachers, formatScheduleDate, overlap, scheduleTimes, shiftDate } from './academy-enrollment-schedule'
import { workspaceOccurrences, type WorkspaceLocation } from './academy-student-preview'
import { newLesson, type LessonChoice } from './academy-staff-enrollment'

export const makeupPreviewNow = '2026-11-03T12:00:00-08:00'
export type PreviewMakeup = { id: string; lessonId: string; studentId: string; enrollmentId: string; date: string; duration: number; program: string; teacher: string; service: string; booking?: { date: string; time: string; teacher: string; program: string } }
export type AbsenceRecord = { lessonId: string; makeupId: string | null; teacherNotification: 'Queued locally' }
export type MakeupPreviewState = { items: PreviewMakeup[]; absences: AbsenceRecord[] }
export function createMakeupPreview(): MakeupPreviewState {
  return { items: ['2026-10-13', '2026-10-20'].map((date, index) => ({ id: `preview:makeup:${index}`, lessonId: `preview:past:${index}`, studentId: 'preview:sophie', enrollmentId: 'preview:sophie-piano', date, duration: 30, program: 'Piano', teacher: 'Jordan Vale', service: 'Private' })), absences: [] }
}
/** Fictional booked example, separate from the empty-booking test baseline. */
export function createScheduledMakeupPreview(): MakeupPreviewState {
  const state = createMakeupPreview()
  return { ...state, items: [...state.items, {
    id: 'preview:makeup:scheduled-example', lessonId: 'preview:past:scheduled-example',
    studentId: 'preview:sophie', enrollmentId: 'preview:sophie-piano',
    date: '2026-10-06', duration: 30, program: 'Piano', teacher: 'Jordan Vale', service: 'Private',
    booking: { date: '2026-11-06', time: '14:00', teacher: 'Nina Patel', program: 'Piano' },
  }] }
}
export function absenceEligible(date: string, time: string) {
  return Date.parse(`${date}T${time}:00-08:00`) - Date.parse(makeupPreviewNow) >= 24 * 60 * 60 * 1000
}
/** Local recurring preview expansion; preserves explicit overrides and absences. */
export function expandPreviewCalendar(data: FamilyPreviewData, through: string): FamilyPreviewData {
  const lessons = [...data.lessons]
  for (const student of data.students) for (const enrollment of student.enrollments) {
    if (enrollment.frequency !== 'Weekly' || enrollment.status !== 'active') continue
    const existing = lessons.filter(item => item.enrollmentId === enrollment.id)
    const first = existing.filter(item => (item.originalDate || item.date) >= enrollment.start).sort((a, b) => (a.originalDate || a.date).localeCompare(b.originalDate || b.date))[0]
    if (!first) continue
    for (let date = enrollment.recurringSchedule?.start || first.originalDate || first.date; date <= through; date = shiftDate(date, 7)) {
      const change = enrollment.recurringSchedule?.changes.filter(item => item.from <= date).at(-1)
      const targetDate = change ? shiftDate(change.date, Math.round((Date.parse(date) - Date.parse(change.from)) / 86400000)) : date
      if (targetDate > through) continue
      if (!lessons.some(item => item.enrollmentId === enrollment.id && (item.originalDate || item.date) === date)) lessons.push({ id: `${enrollment.id}:calendar:${date}`, enrollmentId: enrollment.id, date: targetDate, originalDate: targetDate !== date ? date : undefined, time: change?.time || enrollment.recurringSchedule?.time || enrollment.time, teacher: change?.teacher || enrollment.recurringSchedule?.teacher || enrollment.teacher, room: first.room, status: 'Scheduled' })
    }
  }
  return { ...data, lessons }
}

export const recurringScheduleConflict = 'This teacher is available for the selected lesson, but not for every upcoming lesson at this time. Choose another time or teacher to change the recurring schedule, or reschedule this lesson only.'

/** Count the same expanded upcoming occurrences the recurring mutation validates. */
export function recurringMoveCount(data: FamilyPreviewData, lessonId: string, targetDate?: string) {
  const lesson = data.lessons.find(item => item.id === lessonId)
  if (!lesson) return 0
  const horizon = data.lessons.reduce((last, item) => item.date > last ? item.date : last, shiftDate(targetDate || lesson.date, 364))
  return expandPreviewCalendar(data, horizon).lessons.filter(item => item.enrollmentId === lesson.enrollmentId && (item.originalDate || item.date) >= (lesson.originalDate || lesson.date) && item.status === 'Scheduled' && `${item.date}T${item.time}:00-08:00` > makeupPreviewNow).length
}

/** Local-only recurring change. Validate every loaded occurrence and at least 52 weeks;
 * preserve occurrence identity, past lessons, absences, makeup credits and invoices. */
export function reschedulePreviewSubscription(data: FamilyPreviewData, state: MakeupPreviewState, accountId: string, lessonId: string, booking: NonNullable<PreviewMakeup['booking']>) {
  const account = data.accounts.find(item => item.id === accountId)
  const lesson = data.lessons.find(item => item.id === lessonId && item.status === 'Scheduled')
  const student = data.students.find(person => account?.studentIds.includes(person.id) && person.enrollments.some(item => item.id === lesson?.enrollmentId))
  const enrollment = student?.enrollments.find(item => item.id === lesson?.enrollmentId)
  if (!account || !lesson || !student || !enrollment || enrollment.frequency !== 'Weekly' || enrollment.status !== 'active' || enrollment.lifecycle) throw new Error('Choose an active weekly subscription to change its recurring schedule.')
  if (`${lesson.date}T${lesson.time}:00-08:00` <= makeupPreviewNow) throw new Error('Choose an upcoming lesson to change its recurring schedule.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.date) || !Number.isFinite(Date.parse(`${booking.date}T12:00:00Z`)) || booking.date <= makeupPreviewNow.slice(0, 10) || booking.program !== enrollment.program) throw new Error('Choose an available lesson time for this subscription.')
  const from = lesson.originalDate || lesson.date
  const horizon = data.lessons.reduce((last, item) => item.date > last ? item.date : last, shiftDate(booking.date, 364))
  const expanded = expandPreviewCalendar(data, horizon)
  const future = expanded.lessons.filter(item => item.enrollmentId === enrollment.id && (item.originalDate || item.date) >= from && item.status === 'Scheduled' && `${item.date}T${item.time}:00-08:00` > makeupPreviewNow)
  const ids = new Set(future.map(item => item.id))
  const availableData = { ...expanded, lessons: expanded.lessons.filter(item => !ids.has(item.id)) }
  const makeup: PreviewMakeup = { id: lesson.id, lessonId: lesson.id, studentId: student.id, enrollmentId: enrollment.id, date: lesson.date, duration: enrollment.duration, program: enrollment.program, teacher: lesson.teacher || enrollment.teacher, service: enrollment.service }
  const targets = new Map(future.map(item => {
    const date = shiftDate(booking.date, Math.round((Date.parse(item.originalDate || item.date) - Date.parse(from)) / 86400000))
    if (!makeupSlots(availableData, state, makeup, date, enrollment.program, false).some(slot => slot.time === booking.time && slot.teacher === booking.teacher)) throw new Error(recurringScheduleConflict)
    return [item.id, { date, time: booking.time, teacher: booking.teacher }]
  }))
  const first = expanded.lessons.filter(item => item.enrollmentId === enrollment.id).sort((a, b) => (a.originalDate || a.date).localeCompare(b.originalDate || b.date))[0]
  const recurringSchedule = enrollment.recurringSchedule || { start: first.originalDate || first.date, time: enrollment.time, teacher: enrollment.teacher, changes: [] }
  return {
    ...expanded,
    students: expanded.students.map(person => ({ ...person, enrollments: person.enrollments.map(item => item.id === enrollment.id ? { ...item, teacher: booking.teacher, day: formatScheduleDate(booking.date, { weekday: 'long' }), time: booking.time, recurringSchedule: { ...recurringSchedule, changes: [...recurringSchedule.changes.filter(change => change.from < from), { from, date: booking.date, time: booking.time, teacher: booking.teacher }] } } : item) })),
    lessons: expanded.lessons.map(item => {
      const target = targets.get(item.id)
      return target ? { ...item, ...target, originalDate: item.originalDate || item.date } : item.enrollmentId === enrollment.id ? { ...item, teacher: item.teacher || enrollment.teacher } : item
    }),
  }
}
export function previewCalendarLessons(data: FamilyPreviewData, makeups: PreviewMakeup[], location: WorkspaceLocation) {
  const recurring = workspaceOccurrences(data, location).map(item => ({ ...item, makeup: false, program: item.enrollment.program, duration: item.enrollment.duration }))
  const replacements = makeups.flatMap(item => {
    const student = data.students.find(person => person.id === item.studentId && (!location.studentId || person.id === location.studentId))
    const enrollment = student?.enrollments.find(value => value.id === item.enrollmentId && (!location.enrollmentId || value.id === location.enrollmentId))
    return item.booking && student && enrollment ? [{ id: item.id, enrollmentId: enrollment.id, date: item.booking.date, time: item.booking.time, room: '', status: 'Scheduled', teacher: item.booking.teacher, student, enrollment, makeup: true, program: item.booking.program, duration: item.duration }] : []
  })
  return [...recurring, ...replacements].filter(item => !item.enrollment.lifecycle && `${item.date}T${item.time}:00-08:00` >= makeupPreviewNow).sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
}
export function movePreviewLesson(data: FamilyPreviewData, state: MakeupPreviewState, accountId: string, id: string, booking: NonNullable<PreviewMakeup['booking']>) {
  const account = data.accounts.find(item => item.id === accountId)
  const replacement = state.items.find(item => item.id === id && item.booking)
  const lesson = data.lessons.find(item => item.id === id && item.status === 'Scheduled')
  const student = data.students.find(person => account?.studentIds.includes(person.id) && (replacement ? replacement.studentId === person.id : person.enrollments.some(enrollment => enrollment.id === lesson?.enrollmentId)))
  const enrollment = student?.enrollments.find(item => item.id === (replacement?.enrollmentId || lesson?.enrollmentId))
  if (!account || !student || !enrollment || (!lesson && !replacement)) throw new Error('Lesson unavailable.')
  const original = replacement?.booking || lesson!
  if (`${original.date}T${original.time}:00-08:00` < makeupPreviewNow) throw new Error('Lesson has already started.')
  if (booking.program !== (replacement?.booking?.program || enrollment.program)) throw new Error('Moving a lesson cannot change its program.')
  const makeup: PreviewMakeup = replacement || { id, lessonId: id, studentId: student.id, enrollmentId: enrollment.id, date: original.date, duration: enrollment.duration, program: enrollment.program, teacher: original.teacher || enrollment.teacher, service: enrollment.service }
  const availabilityData = { ...data, lessons: data.lessons.filter(item => item.id !== id) }
  const availabilityState = { ...state, items: state.items.filter(item => item.id !== id) }
  if (!makeupSlots(availabilityData, availabilityState, makeup, booking.date, booking.program, false).some(slot => slot.time === booking.time && slot.teacher === booking.teacher)) throw new Error('Choose an available lesson time.')
  return replacement ? { data, state: { ...state, items: state.items.map(item => item.id === id ? { ...item, booking } : item) } } : { data: { ...data, lessons: data.lessons.map(item => item.id === id ? { ...item, originalDate: item.originalDate || item.date, date: booking.date, time: booking.time, teacher: booking.teacher } : item) }, state }
}
export function cancelPreviewReplacement(data: FamilyPreviewData, state: MakeupPreviewState, accountId: string, id: string) {
  const item = state.items.find(makeup => makeup.id === id && makeup.booking)
  const account = data.accounts.find(value => value.id === accountId)
  if (!item?.booking || !account?.studentIds.includes(item.studentId) || !data.students.some(student => student.id === item.studentId && student.enrollments.some(enrollment => enrollment.id === item.enrollmentId))) throw new Error('Lesson unavailable.')
  if (`${item.booking.date}T${item.booking.time}:00-08:00` < makeupPreviewNow) throw new Error('Lesson has already started.')
  return { ...state, items: absenceEligible(item.booking.date, item.booking.time) ? state.items.map(value => value.id === id ? { ...value, booking: undefined } : value) : state.items.filter(value => value.id !== id) }
}
export function recordPreviewAbsence(data: FamilyPreviewData, state: MakeupPreviewState, accountId: string, lessonId: string, grantLate: boolean, parent: boolean) {
  const account = data.accounts.find(item => item.id === accountId)
  const lesson = data.lessons.find(item => item.id === lessonId)
  const student = data.students.find(person => account?.studentIds.includes(person.id) && person.enrollments.some(item => item.id === lesson?.enrollmentId))
  const enrollment = student?.enrollments.find(item => item.id === lesson?.enrollmentId)
  if (!lesson || !student || !enrollment || lesson.status !== 'Scheduled' || state.absences.some(item => item.lessonId === lessonId)) throw new Error('Lesson unavailable.')
  if (Date.parse(`${lesson.date}T${lesson.time}:00-08:00`) <= Date.parse(makeupPreviewNow)) throw new Error('Lesson has already started.')
  if (parent && grantLate) throw new Error('Staff approval required.')
  const grant = absenceEligible(lesson.date, lesson.time) || grantLate
  const makeup: PreviewMakeup = { id: `preview:makeup:${lessonId}`, lessonId, studentId: student.id, enrollmentId: enrollment.id, date: lesson.date, duration: enrollment.duration, program: enrollment.program, teacher: lesson.teacher || enrollment.teacher, service: enrollment.service }
  return {
    data: { ...data, lessons: data.lessons.map(item => item.id === lessonId ? { ...item, status: 'Absent' } : item) },
    state: { items: grant ? [...state.items, makeup] : state.items, absences: [...state.absences, { lessonId, makeupId: grant ? makeup.id : null, teacherNotification: 'Queued locally' as const }] },
  }
}
export function makeupSlots(data: FamilyPreviewData, state: MakeupPreviewState, makeup: PreviewMakeup, date: string, program: string, sameTeacher: boolean) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || date <= makeupPreviewNow.slice(0, 10)) return []
  if (!['Private', 'Semi-private', 'Group'].includes(makeup.service)) return []
  const choice: LessonChoice = { ...newLesson(makeup.id), studentId: makeup.studentId, instrument: program, duration: String(makeup.duration), service: makeup.service as LessonChoice['service'], frequency: 'À-la-carte' }
  return scheduleTimes.flatMap(time => availableScheduleTeachers(choice, date, time, null, []).filter(teacher => {
    if (sameTeacher && teacher.name !== makeup.teacher) return false
    const conflicts = data.lessons.flatMap(lesson => {
      const student = data.students.find(person => person.enrollments.some(item => item.id === lesson.enrollmentId))
      const enrollment = student?.enrollments.find(item => item.id === lesson.enrollmentId)
      return enrollment && student && lesson.status === 'Scheduled' ? [{ date: lesson.date, time: lesson.time, teacher: lesson.teacher || enrollment.teacher, studentId: student.id, duration: enrollment.duration }] : []
    }).concat(state.items.flatMap(item => item.booking ? [{ ...item.booking, studentId: item.studentId, duration: item.duration }] : []))
    return !conflicts.some(item => item.date === date && (item.studentId === makeup.studentId || item.teacher === teacher.name) && overlap(time, makeup.duration, item.time, item.duration))
  }).map(teacher => ({ date, time, teacher: teacher.name, program })))
}
export function bookPreviewMakeup(data: FamilyPreviewData, state: MakeupPreviewState, accountId: string, makeupId: string, booking: NonNullable<PreviewMakeup['booking']>) {
  const makeup = state.items.find(item => item.id === makeupId && !item.booking)
  const account = data.accounts.find(item => item.id === accountId)
  if (!makeup || !account?.studentIds.includes(makeup.studentId) || !data.students.some(person => person.id === makeup.studentId && person.enrollments.some(item => item.id === makeup.enrollmentId))) throw new Error('Makeup unavailable.')
  if (!makeupSlots(data, state, makeup, booking.date, booking.program, false).some(item => item.time === booking.time && item.teacher === booking.teacher)) throw new Error('Choose an available lesson.')
  return { ...state, items: state.items.map(item => item.id === makeupId ? { ...item, booking } : item) }
}
