'use client'

import type { ReactNode } from 'react'
import { ConfirmActionButton } from './ConfirmActionButton'
import { StatusBadge, SurfacePanel } from '@/beta-source/components/ui'
import { scheduleTeachers, formatScheduleDate, formatScheduleTime } from '@/beta-source/lib/academy-enrollment-schedule'
import type { PreviewMakeup } from '@/beta-source/lib/academy-makeup-preview'
import { CalendarLegend } from './CalendarLegend'
import styles from './CalendarBookingLayout.module.css'

/** The calendar owns the first column; changing controls never changes its top edge. */
export function CalendarBookingLayout({ children, moving = false, booking = false, makeup, program, studentName, sameTeacher, onSameTeacher, teacher, onTeacher, selected, onConfirm, error, sidebar, hideConfirm = false }: {
  children: ReactNode; moving?: boolean; booking?: boolean; makeup: PreviewMakeup; program: string
  sameTeacher: boolean; onSameTeacher: (same: boolean) => void; teacher: string; onTeacher: (teacher: string) => void
  selected: NonNullable<PreviewMakeup['booking']> | null; onConfirm: () => void; error: string
  hideConfirm?: boolean; sidebar?: ReactNode; studentName?: string
}) {
  const teachers = scheduleTeachers.filter(item => (item.instruments as readonly string[]).includes(program))
  const slotLabel = (date: string, time: string) => `${formatScheduleDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}, ${formatScheduleTime(time)}`
  return <div className={`${styles.layout} ${moving ? styles.enter : ''} ${sidebar ? styles.leftRail : ''}`} data-booking-layout="">
    <div className={styles.calendar}>{children}<CalendarLegend moving={moving} /></div>
    <aside className={styles.controls} aria-label="Booking controls">
      {sidebar}
      <p className={styles.summary}>Family calendar · All children’s lessons and booked makeups stay visible. Sibling lessons may overlap when a suitable teacher is available.</p>
      {(moving || booking) && <SurfacePanel appearance="flat"><section aria-label={moving ? 'Move summary' : 'Makeup summary'} className={styles.moveSummary} aria-live="polite">
        {studentName && <p>{studentName}</p>}
        <p>{moving ? 'Original lesson' : 'Makeup credit'}: {program} · {formatScheduleDate(makeup.date)} · {makeup.teacher}</p>
        <p>{moving ? 'Reschedule to:' : 'Schedule makeup to:'}</p>
        {selected ? <><div className={styles.destination}><p>{program}</p><p>{selected.teacher}</p><p>{slotLabel(selected.date, selected.time)}</p></div>{selected.teacher !== makeup.teacher && <StatusBadge status="pending" label="Teacher change" />}</> : <p className={styles.emptySelection}>Select a lesson time</p>}
      </section></SurfacePanel>}
      {!moving && !booking && <label className={styles.checkbox}><input type="checkbox" checked={sameTeacher} onChange={event => onSameTeacher(event.target.checked)} />Same teacher</label>}
      {!moving && !booking && !sameTeacher && <fieldset className={styles.teachers}>
        <legend>Teachers</legend>
        {['', ...teachers.map(item => item.name)].map(name => <label key={name} className={styles.checkbox}><input type="radio" name={`booking-teacher-${makeup.id}`} value={name} checked={teacher === name} onChange={() => onTeacher(name)} />{name || 'Any suitable teacher'}</label>)}
      </fieldset>}
      {!moving && !booking && selected && <p className={styles.summary} aria-live="polite">{formatScheduleDate(selected.date)} · {formatScheduleTime(selected.time)}<br />{selected.teacher}</p>}
      {error && <p role="alert">{error}</p>}
      {!hideConfirm && <div className={moving || booking ? styles.moveAction : undefined}><ConfirmActionButton loadingLabel={moving ? 'Rescheduling lesson' : 'Booking makeup'} disabled={!selected} onClick={onConfirm}>{moving ? 'Reschedule lesson' : 'Book makeup'}</ConfirmActionButton></div>}
    </aside>
  </div>
}