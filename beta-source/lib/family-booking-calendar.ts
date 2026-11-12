import type { FamilyPreviewData } from './academy-family-preview'
import { previewCalendarLessons, type MakeupPreviewState } from './academy-makeup-preview'
import { previewStudentName, workspaceInitial } from './academy-student-preview'

/** Display-only family context. Availability remains owned by makeupSlots. */
export function familyBookingReferences(data: FamilyPreviewData, state: MakeupPreviewState, studentId: string, movingId?: string) {
  const account = data.accounts.find(item => item.studentIds.includes(studentId))
  if (!account) return []
  const students = data.students.filter(item => account.studentIds.includes(item.id))
  const studentIds = new Set(students.map(item => item.id))
  return previewCalendarLessons({ ...data, students }, state.items.filter(item => studentIds.has(item.studentId)), { ...workspaceInitial, accountId: account.id })
    .filter(item => item.status === 'Scheduled')
    .map(item => ({
      id: `family:${item.id}`, date: item.date, time: item.time, duration: item.duration,
      label: `${previewStudentName(item.student)} · ${item.program} · ${item.teacher}${item.makeup ? ' · Makeup' : ''}${item.id === movingId ? ' · Original lesson' : ''}`,
      blocksAvailability: false,
    }))
}