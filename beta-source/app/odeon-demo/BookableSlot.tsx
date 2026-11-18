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
  compactName?: string
  fullName?: string
  constrainText?: boolean
  style?: CSSProperties
  onPick: () => void
  onChooseTeacher: (teacher: string) => void
  teacherLabel: string
}

export function BookableSlot({ title, when, teachers, selectedTeacher, picked, compactName, fullName, constrainText, style, onPick, onChooseTeacher, teacherLabel }: BookableSlotProps) {
  const multiple = teachers.length > 1
  const truncate: CSSProperties | undefined = constrainText ? { minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : undefined
  const actionable = (!compactName || fullName) && !multiple
  const description = [fullName, title, when, teachers.join(', ')].filter(Boolean).join(' · ')
  return <div data-bookable-slot data-picked={picked || undefined} title={compactName ? fullName || compactName : description} onClick={actionable ? onPick : undefined}
    role={actionable ? 'button' : undefined} tabIndex={actionable ? 0 : undefined} aria-label={actionable ? description : undefined}
    onKeyDown={actionable ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPick() } } : undefined}
    style={{
      display: 'grid', gap: 1, alignContent: 'center', textAlign: 'left', padding: '4px 6px', borderRadius: 6, cursor: 'pointer',
      ...(picked
        ? { border: '2.5px solid var(--calendar-student-border)', background: 'var(--calendar-student-surface)', color: 'var(--calendar-student-text)' }
        : { border: '1.5px dashed rgba(139,90,181,0.55)', background: colors.surface, color: colors.text }),
      ...(constrainText && { gridTemplateColumns: 'minmax(0, 1fr)', minHeight: 0, minWidth: 0, width: '100%', boxSizing: 'border-box', overflow: 'hidden', lineHeight: '12px' }),
      ...(!actionable && { cursor: multiple ? undefined : 'default' }),
      ...style,
    }}>
    {compactName ? <strong style={{ ...truncate, fontSize: 11 }}>{compactName}</strong> : <>
    <strong title={constrainText ? title : undefined} style={{ ...truncate, fontSize: 11, color: 'inherit' }}>{title}</strong>
    <span style={{ ...truncate, fontSize: 10, opacity: 0.8 }}>{when}</span>
    {multiple
      ? <select aria-label={teacherLabel} value={selectedTeacher || ''}
        onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}
        onChange={event => onChooseTeacher(event.target.value)}
        style={{ ...truncate, font: 'inherit', fontSize: 10, padding: 0, border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer' }}>
        <option value="">Select teacher</option>
        {teachers.map(name => <option key={name} value={name}>w/ {name}</option>)}
      </select>
      : <span style={{ ...truncate, fontSize: 10, opacity: 0.8 }}>w/ {teachers[0] || 'Unassigned'}</span>}
    </>}
  </div>
}
