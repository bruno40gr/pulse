import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { formatScheduleDate, formatScheduleTime } from '@/beta-source/lib/academy-enrollment-schedule'
import styles from './enrollment.module.css'

/** One time axis, day header and scroll surface for booking and lesson browsing. */
export function CalendarTimeGrid({ dates, times, label, renderDay, renderDayHeading, minimumColumnWidth, slotHeight = 30, maxHeight, initialScrollTime }: { dates: string[]; times: readonly string[]; label: string; renderDay: (date: string) => ReactNode; renderDayHeading?: (date: string) => ReactNode; minimumColumnWidth?: number; slotHeight?: number; maxHeight?: string; initialScrollTime?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const positioned = useRef(false)
  useEffect(() => {
    if (positioned.current || !initialScrollTime || !scrollRef.current) return
    const index = times.findIndex(time => time >= initialScrollTime)
    if (index < 0) return
    scrollRef.current.scrollTop = index * slotHeight
    positioned.current = true
  }, [initialScrollTime, times, slotHeight])
  return <div ref={scrollRef} className={styles.calendarScroll} style={{ maxHeight }} tabIndex={0} role="region" aria-label={label} data-calendar-grid="">
    <div className={styles.timeGrid} style={{ '--calendar-slot-height': `${slotHeight}px`, gridTemplateColumns: `75px repeat(${dates.length}, minmax(0, 1fr))`, minWidth: minimumColumnWidth ? 75 + dates.length * minimumColumnWidth : dates.length > 5 ? 900 : 650 } as CSSProperties}>
      <div className={styles.timeAxis}><div className={styles.dayHeading}>Time</div>{times.map((time, index) => <div key={time} className={styles.timeLabel}>{index % 4 === 0 ? formatScheduleTime(time) : ''}</div>)}</div>
      {dates.map(date => <div key={date} className={styles.dayColumn}>
        <div className={styles.dayHeading}>{renderDayHeading ? renderDayHeading(date) : <><span>{formatScheduleDate(date, { weekday: 'short' })}</span><strong>{formatScheduleDate(date, { day: 'numeric' })}</strong></>}</div>
        {renderDay(date)}
      </div>)}
    </div>
  </div>
}