'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/beta-source/components/ui/Button'
import { formatScheduleDate, shiftDate } from '@/beta-source/lib/academy-enrollment-schedule'
import styles from './enrollment.module.css'

/** Shared navigation for availability selection and booked-lesson calendars. */
export function CalendarWeekToolbar({ week, lastDate, onWeek, children, flush = false }: { week: string; lastDate: string; onWeek: (date: string) => void; children?: React.ReactNode; flush?: boolean }) {
  return <div className={styles.weekToolbar} data-calendar-week-toolbar="" style={{ flexWrap: 'wrap', marginBottom: flush ? 0 : undefined }}>
    <Button type="button" variant="secondary" aria-label="Previous week" onClick={() => onWeek(shiftDate(week, -7))}><ChevronLeft size={17} aria-hidden="true" /></Button>
    <strong aria-live="polite">{formatScheduleDate(week)}–{formatScheduleDate(lastDate, { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
    <Button type="button" variant="secondary" aria-label="Next week" onClick={() => onWeek(shiftDate(week, 7))}><ChevronRight size={17} aria-hidden="true" /></Button>
    {children}
  </div>
}