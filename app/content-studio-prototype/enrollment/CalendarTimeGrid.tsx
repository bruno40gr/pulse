import type { ReactNode } from 'react'
import { formatScheduleDate, formatScheduleTime } from '@/lib/academy-enrollment-schedule'
import styles from './enrollment.module.css'

/** One time axis, day header and scroll surface for booking and lesson browsing. */
export function CalendarTimeGrid({ dates, times, label, renderDay, renderDayHeading }: { dates: string[]; times: readonly string[]; label: string; renderDay: (date: string) => ReactNode; renderDayHeading?: (date: string) => ReactNode }) {
  return <div className={styles.calendarScroll} tabIndex={0} role="region" aria-label={label}>
    <div className={styles.timeGrid} style={{ gridTemplateColumns: `75px repeat(${dates.length}, minmax(0, 1fr))`, minWidth: dates.length > 5 ? 900 : 650 }}>
      <div className={styles.timeAxis}><div className={styles.dayHeading}>Time</div>{times.map((time, index) => <div key={time} className={styles.timeLabel}>{index % 4 === 0 ? formatScheduleTime(time) : ''}</div>)}</div>
      {dates.map(date => <div key={date} className={styles.dayColumn}>
        <div className={styles.dayHeading}>{renderDayHeading ? renderDayHeading(date) : <><span>{formatScheduleDate(date, { weekday: 'short' })}</span><strong>{formatScheduleDate(date, { day: 'numeric' })}</strong></>}</div>
        {renderDay(date)}
      </div>)}
    </div>
  </div>
}