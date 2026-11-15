import type { SetupRecord } from '../app/content-studio-prototype/school-setup/setup-content'
import type { CalendarOccurrence } from './beta-academy-calendar'
import { betaAcademyRooms, betaAcademyTeachers } from './beta-academy-schedule'

export type CalendarPerspective = 'teacher' | 'service' | 'room'
export type CalendarResource = { id: string; name: string }
const aliases: Record<string, string> = { Voice: 'Voice & Vocals', 'Band Program': 'Band' }

/** Delivery format (private/semi-private) never changes the service column. */
export function calendarServiceName(item: CalendarOccurrence, setup: Record<string, SetupRecord[]>) {
  const program = item.kind === 'band' ? 'Band' : item.program
  const name = aliases[program] || program
  return setup.services?.find(service => service.id === item.serviceId || service.values.name === name || service.values.name === program)?.values.name || name
}

export function calendarResourceIds(item: CalendarOccurrence, perspective: CalendarPerspective, setup: Record<string, SetupRecord[]>) {
  if (perspective === 'service') return [calendarServiceName(item, setup) || 'Unassigned']
  if (perspective === 'room') return item.rooms?.length ? [...new Set(item.rooms)] : [item.room || 'Unassigned']
  const teachers = betaAcademyTeachers(setup)
  const names = item.teacherNames?.length ? item.teacherNames : [item.teacherName]
  if (item.teacherIds?.length) return [...new Set(item.teacherIds)]
  return [...new Set(names.map(name => teachers.find(teacher => teacher.name === name)?.id || (name === item.teacherName ? item.teacherId : undefined) || name || 'Unassigned'))]
}

/** Include configured resources even on empty dates; retain unmatched legacy records. */
export function calendarResources(perspective: CalendarPerspective, setup: Record<string, SetupRecord[]>, items: readonly CalendarOccurrence[]): CalendarResource[] {
  const configured = perspective === 'teacher' ? betaAcademyTeachers(setup).map(item => ({ id: item.id, name: item.name }))
    : perspective === 'room' ? betaAcademyRooms(setup).map(item => ({ id: item.name, name: item.name }))
      : (setup.services || []).filter(item => item.values.name).map(item => ({ id: item.values.name, name: item.values.name }))
  const result = new Map(configured.map(item => [item.id, item]))
  for (const item of items) for (const id of calendarResourceIds(item, perspective, setup)) {
    if (!result.has(id)) result.set(id, { id, name: id === item.teacherId ? item.teacherName || 'Unassigned' : id })
  }
  if (perspective !== 'service') result.set('Unassigned', { id: 'Unassigned', name: 'Unassigned' })
  return [...result.values()]
}