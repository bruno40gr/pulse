'use client'

import type { CSSProperties } from 'react'
import { Button, FieldGrid, Input, Select } from '@/beta-source/components/ui'
import { CalendarWeekToolbar } from '../enrollment/CalendarWeekToolbar'
import { formatScheduleDate } from '@/beta-source/lib/academy-enrollment-schedule'
import { spacing, typography, colors } from '@/beta-source/lib/tokens'
import styles from './LessonSelectionToolbar.module.css'

/** All date modes share the same slots and intrinsic row heights. */
export function LessonSelectionToolbar({ mode, onMode, week, lastDate, onWeek, horizon, from, through, onFrom, onThrough, count, onClear, onReschedule, onCancel, calendar = false }: {
  mode: string; onMode: (mode: string) => void; week: string; lastDate: string; onWeek: (week: string) => void
  horizon: string; from: string; through: string; onFrom: (date: string) => void; onThrough: (date: string) => void
  count: number; onClear: () => void; onReschedule: () => void; onCancel?: () => void; calendar?: boolean
}) {
  const slot = (visible: boolean): CSSProperties => ({ visibility: visible ? 'visible' : 'hidden', gridArea: '1 / 1', minWidth: 0 })
  const activeMode = calendar ? 'week' : mode
  return <div className={styles.container}>
    <div className={styles.toolbar} data-calendar-week-toolbar="" data-lesson-selection-toolbar="" style={{ '--lesson-toolbar-gap': spacing.sm } as CSSProperties}>
      <div className={styles.mode}>
        <Select aria-label="Lesson date view" controlSize="toolbar" value={activeMode} disabled={calendar} onChange={event => onMode(event.target.value)}><option value="week">This week</option><option value="all">All weeks</option><option value="range">Date range</option></Select>
      </div>
      <div className={styles.actions} style={{ visibility: count ? 'visible' : 'hidden' }} aria-hidden={!count} inert={!count} role="group" aria-label="Selected lessons">
        <span style={{ ...typography.bodySmall, whiteSpace: 'nowrap' }} aria-live="polite">{count} selected</span>
        <Button size="toolbar" variant="ghost" onClick={onClear}>Clear selection</Button>
        {onCancel && <Button size="toolbar" variant="secondary" onClick={onCancel}><span style={{ display: 'grid' }}><span style={slot(count <= 1)} aria-hidden={count > 1}>Cancel</span><span style={slot(count > 1)} aria-hidden={count <= 1}>Cancel together</span></span></Button>}
        <Button size="toolbar" onClick={onReschedule}><span style={{ display: 'grid' }}><span style={slot(count <= 1)} aria-hidden={count > 1}>Reschedule</span><span style={slot(count > 1)} aria-hidden={count <= 1}>Reschedule together</span></span></Button>
      </div>
      <div className={styles.dates}>
        <div style={slot(activeMode === 'week')} aria-hidden={activeMode !== 'week'} inert={activeMode !== 'week'}><CalendarWeekToolbar controlSize="toolbar" flush week={week} lastDate={lastDate} onWeek={onWeek} /></div>
        <div style={slot(activeMode === 'all')} aria-hidden={activeMode !== 'all'} inert={activeMode !== 'all'}><p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: 0 }}>Upcoming lessons through {formatScheduleDate(horizon, { month: 'short', day: 'numeric', year: 'numeric' })}</p></div>
        <div style={slot(activeMode === 'range')} aria-hidden={activeMode !== 'range'} inert={activeMode !== 'range'}><FieldGrid><Input label="From date" type="date" value={from} max={through} onChange={event => { if (event.target.value) onFrom(event.target.value) }} /><Input label="Through date" type="date" value={through} min={from} max={horizon} onChange={event => { if (event.target.value) onThrough(event.target.value) }} /></FieldGrid></div>
      </div>
    </div>
  </div>
}