import type { CSSProperties } from 'react'
import { calendarServicePalette, calendarStudentPalette } from './tokens'

/** A stable family roster avoids recoloring students when the active lesson changes. */
export function calendarStudentStyle(studentId: string, studentIds: readonly string[]): CSSProperties {
  const ids = [...new Set(studentIds.filter(Boolean))].sort()
  const index = Math.max(0, ids.indexOf(studentId)) % calendarStudentPalette.length
  const color = calendarStudentPalette[index]
  return { '--calendar-student-surface': color.surface, '--calendar-student-border': color.border, '--calendar-student-text': color.text } as CSSProperties
}

/** Academy overview colors follow the service, never the student, teacher or room. */
export function calendarServiceStyle(service: { kind: string; serviceType: string; program: string }): CSSProperties {
  const type = service.serviceType.trim().toLowerCase()
  const program = service.program.trim().toLowerCase()
  const category = service.kind === 'front-desk' ? 'frontDesk' : service.kind === 'admin' ? 'admin' : service.kind === 'band' || /band/.test(type) ? 'band'
    : service.kind === 'studio' || /record|studio/.test(type) ? 'recording'
      : service.kind === 'rehearsal' || /rehearsal/.test(type) ? 'rehearsal'
        : /group/.test(type) ? 'group'
          : service.kind === 'event' && !/private|lesson/.test(type) ? 'event' : null
  // Hash the normalized service name, not its position in the filtered roster.
  const hash = Array.from(program || type).reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0)
  const color = category ? calendarServicePalette[category] : calendarStudentPalette[hash % calendarStudentPalette.length]
  return { '--calendar-student-surface': color.surface, '--calendar-student-border': color.border, '--calendar-student-text': color.text } as CSSProperties
}