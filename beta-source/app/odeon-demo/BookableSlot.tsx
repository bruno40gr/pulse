'use client'

import type { CSSProperties } from 'react'
import { colors } from '@/lib/tokens'

/**
 * One bookable option, drawn identically wherever slots are offered: the reschedule
 * grid today, the enrollment picker next. It carries its own teacher choice, so a
 * family rescheduling three children can hold three of these at once.
 */
export type BookableSlotProps = {
  title: string
  when: string
  teachers: string[]
  selectedTeacher?: string
  picked?: boolean
  style?: CSSProperties
  onPick: () => void
  onChooseTeacher: (teacher: string) => void
  teacherLabel: string
}

export function BookableSlot({ title, when, teachers, selectedTeacher, picked, style, onPick, onChooseTeacher, teacherLabel }: BookableSlotProps) {
  const multiple = teachers.length > 1
  return <div data-bookable-slot data-picked={picked || undefined} onClick={onPick}
    style={{
      display: 'grid', gap: 1, alignContent: 'center', textAlign: 'left', padding: '4px 6px', borderRadius: 6, cursor: 'pointer',
      ...(picked
        ? { border: '2.5px solid var(--calendar-student-border)', background: 'var(--calendar-student-surface)', color: 'var(--calendar-student-text)' }
        : { border: '1.5px dashed rgba(139,90,181,0.55)', background: colors.surface, color: colors.text }),
      ...style,
    }}>
    <strong style={{ fontSize: 11, color: 'inherit' }}>{title}</strong>
    <span style={{ fontSize: 10, opacity: 0.8 }}>{when}</span>
    {multiple
      ? <select aria-label={teacherLabel} value={selectedTeacher || ''}
        onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}
        onChange={event => onChooseTeacher(event.target.value)}
        style={{ font: 'inherit', fontSize: 10, padding: 0, border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer' }}>
        <option value="">Select teacher</option>
        {teachers.map(name => <option key={name} value={name}>w/ {name}</option>)}
      </select>
      : <span style={{ fontSize: 10, opacity: 0.8 }}>w/ {teachers[0] || 'Unassigned'}</span>}
  </div>
}
