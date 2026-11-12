'use client'

import type { CSSProperties } from 'react'
import { Input, Select } from '@/beta-source/components/ui'
import { TableContextActionBar, TableResultCount, TableResultsSlot } from '@/components/ui/TableWorkspaceControls'
import { CalendarWeekToolbar } from '../enrollment/CalendarWeekToolbar'
import { formatScheduleDate } from '@/beta-source/lib/academy-enrollment-schedule'
import { spacing, typography, colors } from '@/beta-source/lib/tokens'
import styles from './LessonSelectionToolbar.module.css'

/** Compact discovery controls above the shared, independently reserved selection bar. */
export function LessonSelectionToolbar({ mode, onMode, week, lastDate, onWeek, horizon, from, through, onFrom, onThrough, count, resultCount, onClear, onReschedule, onCancel, calendar = false }: {
  mode: string; onMode: (mode: string) => void; week: string; lastDate: string; onWeek: (week: string) => void
  horizon: string; from: string; through: string; onFrom: (date: string) => void; onThrough: (date: string) => void
  count: number; resultCount: number; onClear: () => void; onReschedule: () => void; onCancel?: () => void; calendar?: boolean
}) {
  const activeMode = calendar ? 'week' : mode
  const actions = [
    ...(onCancel ? [{ id: 'cancel', label: count > 1 ? 'Cancel together' : 'Cancel', onClick: onCancel }] : []),
    { id: 'reschedule', label: count > 1 ? 'Reschedule together' : 'Reschedule', onClick: onReschedule },
  ]
  return <div className={styles.container} data-lesson-selection-toolbar="" style={{ '--lesson-toolbar-gap': spacing.sm } as CSSProperties}>
    <div className={styles.toolbar} data-lesson-date-filters="">
      <Select aria-label="Lesson date view" controlSize="toolbar" fullWidth={false} value={activeMode} disabled={calendar} onChange={event => onMode(event.target.value)}><option value="week">This week</option><option value="all">All weeks</option><option value="range">Date range</option></Select>
      <div className={styles.dates}>
        {activeMode === 'week' && <CalendarWeekToolbar controlSize="toolbar" flush week={week} lastDate={lastDate} onWeek={onWeek} />}
        {activeMode === 'all' && <p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: 0 }}>Upcoming lessons through {formatScheduleDate(horizon, { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
        {activeMode === 'range' && <div className={styles.range} role="group" aria-label="Lesson date range">
          <Input aria-label="From date" title="From date" type="date" value={from} max={through} onChange={event => { if (event.target.value) onFrom(event.target.value) }} />
          <span aria-hidden="true">–</span>
          <Input aria-label="Through date" title="Through date" type="date" value={through} min={from} max={horizon} onChange={event => { if (event.target.value) onThrough(event.target.value) }} />
        </div>}
      </div>
    </div>
    <TableResultsSlot result={<TableResultCount>{resultCount} {resultCount === 1 ? 'lesson' : 'lessons'}</TableResultCount>} contextual={count ? <TableContextActionBar selectedCount={count} actions={actions} onClear={onClear} /> : undefined} />
  </div>
}
