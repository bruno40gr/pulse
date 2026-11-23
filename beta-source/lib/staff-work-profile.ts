import { defaultLevelNames, levelIds, setupAreas, validateSetup, type SetupRecord } from '@/beta-source/app/content-studio-prototype/school-setup/setup-content'
import { academySchedulingError } from '@/lib/academy-scheduling-validation'
import type { BookingContext } from './academy-calendar-booking'

export function staffTeachingLevels(setup: Record<string, SetupRecord[]>) {
  const offered = new Set((setup.services || []).flatMap(service => {
    try { return JSON.parse(service.values.levelIds || '[]') as string[] } catch { return [] }
  }))
  const existingMaximums = (setup.teachers || []).flatMap(teacher => {
    try { return (JSON.parse(teacher.values.assignments || '[]') as { maxLevel: number }[]).map(item => item.maxLevel).filter(Number.isInteger) } catch { return [] }
  })
  const highest = Math.min(levelIds.length, Math.max(3, ...existingMaximums, ...levelIds.map((id, index) => offered.has(id) ? index + 1 : 0)))
  return Object.fromEntries(levelIds.slice(0, highest).map(id => [id, setup.school?.[0]?.values[id] || defaultLevelNames[id]]))
}

/** Stable identity only: a live contact must never be linked by display name. */
export function staffRecordForPerson(teachers: SetupRecord[], personId: string) {
  const matches = teachers.filter(item => item.values.personId === personId)
  return matches.length === 1 ? matches[0] : undefined
}

export function staffWorkProfileError(context: BookingContext, record: SetupRecord, today: string): string | null {
  const values = record.values
  const error = validateSetup(setupAreas.find(area => area.id === 'teachers')!, values)
  if (error) return error
  if (!context.setup.locations.some(item => item.id === values.location)) return 'Choose an available location.'
  try {
    const assignments: { serviceId: string }[] = JSON.parse(values.assignments || JSON.stringify(values.service ? [{ serviceId: values.service }] : []))
    if (assignments.some(item => !context.setup.services.some(service => service.id === item.serviceId))) return 'Choose available instruments and services.'
  } catch { return 'Review teaching qualifications.' }
  const next = { ...context.setup, teachers: context.setup.teachers.some(item => item.id === record.id) ? context.setup.teachers.map(item => item.id === record.id ? record : item) : [...context.setup.teachers, record] }
  // Preflight only this person's work; unrelated legacy conflicts must not mask
  // a newly introduced conflict. Workspace PUT still validates the full school.
  const oldName = context.setup.teachers.find(item => item.id === record.id)?.values.name
  const students = context.data.students.map(student => ({ ...student, enrollments: student.enrollments.filter(item => item.teacherId === record.id || (!item.teacherId && item.teacher === oldName)) })).filter(student => student.enrollments.length)
  const enrollmentIds = new Set(students.flatMap(student => student.enrollments.map(item => item.id)))
  const data = { ...context.data, students, lessons: context.data.lessons.filter(item => enrollmentIds.has(item.enrollmentId)), calendarBookings: (context.data.calendarBookings || []).filter(item => item.teacherId === record.id) }
  const previous = { setup: context.setup, snapshot: { data, makeups: { items: [], absences: [] } } }
  const schedulingError = academySchedulingError({ ...previous, setup: next }, previous, today)
  return schedulingError ? `Changes were not saved. Resolve affected assignments first: ${schedulingError}` : null
}