import type { FamilyPreviewData } from './academy-family-preview'
import type { AttendanceOutcome, PreviewLesson } from './academy-student-preview'

export const attendanceOutcomes: readonly AttendanceOutcome[] = ['Present', 'No-show', 'Excused absence']

/** Explicit source occurrence identity only. Never merge bookings by teacher/time/name. */
export function lessonOccurrenceId(lesson: PreviewLesson) { return lesson.occurrenceId || lesson.id }

export function markParticipantAttendance(data: FamilyPreviewData, lessonId: string, outcome: AttendanceOutcome | undefined): FamilyPreviewData {
  const lesson = data.lessons.find(item => item.id === lessonId)
  if (!lesson || lesson.status === 'Cancelled' || (outcome !== undefined && !attendanceOutcomes.includes(outcome))) throw new Error('Choose an available participant and attendance outcome.')
  return { ...data, lessons: data.lessons.map(item => item.id === lessonId ? { ...item, attendance: outcome } : item) }
}

/** Mutate resource occupancy once, projecting the change onto every participant. */
export function changeSessionOccurrence(data: FamilyPreviewData, occurrenceId: string, patch: { date?: string; time?: string; teacher?: string; room?: string; status?: 'Cancelled' }): FamilyPreviewData {
  const participants = data.lessons.filter(item => lessonOccurrenceId(item) === occurrenceId)
  if (!participants.length) throw new Error('Session occurrence unavailable.')
  if (patch.date && (!/^\d{4}-\d{2}-\d{2}$/.test(patch.date) || new Date(`${patch.date}T12:00:00Z`).toISOString().slice(0, 10) !== patch.date)) throw new Error('Check the session date.')
  if (patch.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(patch.time)) throw new Error('Check the session time.')
  return { ...data, lessons: data.lessons.map(item => lessonOccurrenceId(item) === occurrenceId ? { ...item, ...patch, originalDate: patch.date ? item.originalDate || item.date : item.originalDate } : item) }
}

/** A participant-only move detaches from the original session, never moves its peers. */
export function detachParticipantOccurrence(lesson: PreviewLesson) {
  return lesson.occurrenceId ? { ...lesson, occurrenceId: `${lesson.id}:individual` } : lesson
}