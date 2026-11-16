import type { FamilyPreviewData } from './academy-family-preview'
import type { PreviewEnrollment, PreviewLesson } from './academy-student-preview'
import type { StaffEnrollment } from './academy-staff-enrollment'
import { lessonPrice, lessonStudent, validLessonDuration } from './academy-staff-enrollment'
import type { BetaAcademyRoom, BetaAcademyTeacher, BetaTeachingLoad } from './beta-academy-schedule'
import { betaRoomFor } from './beta-academy-schedule'
import { subscriptionTerms } from './academy-subscription-history'

function initialSubscriptionHistory(enrollment: PreviewEnrollment): PreviewEnrollment {
  return { ...enrollment, history: [{ id: `${enrollment.id}:initial`, effectiveFrom: enrollment.start, recordedAt: new Date().toISOString(), actor: 'staff', reason: 'Enrollment confirmed', terms: subscriptionTerms(enrollment) }] }
}

/** Adapt a finished staff enrollment into the family's own Beta records. */
export function projectBetaEnrollmentDraft(data: FamilyPreviewData, draft: StaffEnrollment, context: { teachers: readonly BetaAcademyTeacher[]; rooms: readonly BetaAcademyRoom[]; load: readonly BetaTeachingLoad[]; enrollmentId: string; room?: string }) {
  const studentId = draft.student?.id || ''
  const payerId = draft.payer === 'manager' ? draft.manager?.id || draft.contact?.id || '' : draft.payer === 'other' ? draft.contact?.id || '' : draft.student?.id || draft.contact?.id || ''
  const lessons = draft.lessons.map(lesson => {
    const teacher = context.teachers.find(item => item.name === lesson.teacher)
    const room = context.room || betaRoomFor(context.rooms, teacher, lesson.start, lesson.time, Number(lesson.duration), context.load)
    if (!room) throw new Error('No room is available for this lesson time.')
    return {
      service: lesson.service, instrument: lesson.instrument, teacher: lesson.teacher, teacherId: teacher?.id,
      time: lesson.time, start: lesson.start, duration: Number(lesson.duration),
      frequency: lesson.frequency === 'À-la-carte' ? 'One-off' as const : 'Weekly' as const,
      amountMinor: lessonPrice(lesson, lessonStudent(draft, lesson)).total,
      room,
    }
  })
  return projectBetaEnrollment(data, {
    enrollmentId: context.enrollmentId, studentId, payerId,
    paymentMethod: draft.payment === 'later' ? 'Add payment later' : 'Demo Visa ···· 4242',
    amountMinor: lessons[0]?.amountMinor || 0, paid: draft.payment !== 'later', lessons,
  })
}

/** A completed staff workflow adapted into the Beta family's own records. */
export type BetaLessonProjection = {
  service: string
  instrument: string
  teacher: string
  teacherId?: string
  time: string
  start: string
  duration: number
  frequency: 'Weekly' | 'One-off'
  amountMinor?: number
  room?: string
}

export type BetaEnrollmentCompletion = {
  otherPayer?: { name: string; email: string; phone: string }
  enrollmentId: string
  studentId: string
  payerId: string
  paymentMethod: string
  amountMinor: number
  paid: boolean
  lessons: BetaLessonProjection[]
}

export type BetaBandCompletion = {
  enrollmentId: string
  studentId: string
  payerId: string
  paymentMethod: string
  amountMinor: number
  paid: boolean
  bandName: string
  instrument?: string
  teacher?: string
  teacherId?: string
  start?: string
  /** The band class is the enrollment's series; Calendar reads one session source. */
  seriesId?: string
  time?: string
  duration?: number
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/
const clockTime = /^\d{2}:\d{2}$/

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function weekdayLabel(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
}

/** The payer must be the account holder or a recorded family member. */
function resolvePayer(data: FamilyPreviewData, account: FamilyPreviewData['accounts'][number], studentId: string, payerId: string) {
  const student = data.students.find(item => item.id === studentId)
  const allowed = new Set([account.holderId, ...(student?.family || []).map(person => person.id)])
  if (!allowed.has(payerId)) throw new Error('The payer is not part of this family.')
  return payerId
}

/**
 * Project a completed booking into the family's own enrollment and lesson records.
 * Fails closed: nothing is written unless every field is valid for the Beta model.
 */
export function projectBetaEnrollment(data: FamilyPreviewData, completion: BetaEnrollmentCompletion): FamilyPreviewData {
  const account = betaAccountForStudent(data, completion.studentId)
  if (!account) throw new Error('The family account for this booking is unavailable.')
  const student = data.students.find(item => item.id === completion.studentId)
  if (!student) throw new Error('This student is no longer part of the academy.')
  if (!completion.lessons.length) throw new Error('The booking has no lesson to record.')
  if (!Number.isSafeInteger(completion.amountMinor) || completion.amountMinor < 0) throw new Error('Check the booking price.')
  if (completion.otherPayer && (!completion.otherPayer.name.trim() || (completion.otherPayer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(completion.otherPayer.email)))) throw new Error('Check the additional payer details.')
  const payerId = completion.otherPayer ? `payer:${completion.enrollmentId}` : resolvePayer(data, account, completion.studentId, completion.payerId)
  const existing = new Set(data.students.flatMap(item => item.enrollments.map(enrollment => enrollment.id)))
  const enrollments: PreviewEnrollment[] = []
  const lessons: PreviewLesson[] = []
  completion.lessons.forEach((lesson, index) => {
    const enrollmentId = `${completion.enrollmentId}:${index}`
    if (existing.has(enrollmentId)) throw new Error('This booking is already recorded.')
    if (!lesson.instrument.trim() || !lesson.service.trim() || !lesson.teacher.trim()) throw new Error('The booking is missing its program, service or teacher.')
    if (!validLessonDuration(lesson.instrument, lesson.duration)) throw new Error('Check the lesson length.')
    if (!clockTime.test(lesson.time) || !isoDate.test(lesson.start)) throw new Error('Check the lesson date and time.')
    const occurrences = lesson.frequency === 'Weekly' ? 6 : 1
    enrollments.push(initialSubscriptionHistory({
      id: enrollmentId, studentId: student.id, program: lesson.instrument, service: lesson.service, teacher: lesson.teacher,
      ...(lesson.teacherId ? { teacherId: lesson.teacherId } : {}),
      level: 1, day: weekdayLabel(lesson.start), time: lesson.time, duration: lesson.duration, start: lesson.start,
      frequency: lesson.frequency, amountMinor: lesson.amountMinor ?? completion.amountMinor, currency: 'USD', priceUnit: 'per lesson',
      collection: 'Monthly · 1st of the month', payerId, payerDetails: completion.otherPayer, paymentMethod: completion.paymentMethod,
      status: 'active', initialPaymentStatus: completion.paid ? 'paid' : 'unpaid',
    }))
    for (let week = 0; week < occurrences; week++) {
      const date = addDays(lesson.start, week * 7)
      lessons.push({ id: `${enrollmentId}:${date}`, enrollmentId, date, time: lesson.time, room: lesson.room || 'Studio preview', status: 'Scheduled', teacher: lesson.teacher })
    }
  })
  return {
    ...data,
    students: data.students.map(item => item.id === student.id ? { ...item, enrollments: [...item.enrollments, ...enrollments] } : item),
    lessons: [...data.lessons, ...lessons],
  }
}

/** Resolve the family that owns a student. Identity comes from the account relationship. */
export function betaAccountForStudent(data: FamilyPreviewData, studentId: string) {
  return data.accounts.find(account => account.studentIds.includes(studentId))
}

/** Project a confirmed band membership into the student's own program record. */
export function projectBetaBandMembership(data: FamilyPreviewData, completion: BetaBandCompletion): FamilyPreviewData {
  const account = betaAccountForStudent(data, completion.studentId)
  if (!account) throw new Error('The family account for this band membership is unavailable.')
  const student = data.students.find(item => item.id === completion.studentId)
  if (!student) throw new Error('This student is no longer part of the academy.')
  if (!completion.bandName.trim()) throw new Error('The band membership is missing its name.')
  if (!Number.isSafeInteger(completion.amountMinor) || completion.amountMinor < 0) throw new Error('Check the band price.')
  if (data.students.some(item => item.enrollments.some(enrollment => enrollment.id === completion.enrollmentId))) throw new Error('This band membership is already recorded.')
  const payerId = resolvePayer(data, account, completion.studentId, completion.payerId)
  const start = completion.start && isoDate.test(completion.start) ? completion.start : '2026-11-13'
  const enrollment: PreviewEnrollment = {
    id: completion.enrollmentId, studentId: student.id, program: completion.bandName, service: 'Band',
    teacher: completion.teacher || 'Staff team', ...(completion.teacherId ? { teacherId: completion.teacherId } : {}),
    level: 1, day: weekdayLabel(start), time: completion.time || '', duration: completion.duration || 45, start, frequency: 'Weekly',
    amountMinor: completion.amountMinor, currency: 'USD', priceUnit: 'per month',
    collection: 'Monthly · 1st of the month', payerId, paymentMethod: completion.paymentMethod,
    status: 'active', initialPaymentStatus: completion.paid ? 'paid' : 'unpaid',
    ...(completion.seriesId ? { seriesId: completion.seriesId } : {}),
  }
  return { ...data, students: data.students.map(item => item.id === student.id ? { ...item, enrollments: [...item.enrollments, initialSubscriptionHistory(enrollment)] } : item) }
}
