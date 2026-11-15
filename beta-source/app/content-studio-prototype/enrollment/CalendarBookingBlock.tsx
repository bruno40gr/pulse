import type { HTMLAttributes } from 'react'
import styles from './enrollment.module.css'

/** Shared booked-block treatment for enrollment, contact scheduling and operations. */
export function CalendarBookingBlock({ interactive = false, active = false, detailed = false, className = '', ...props }: HTMLAttributes<HTMLElement> & { interactive?: boolean; active?: boolean; detailed?: boolean }) {
  const classes = `${styles.bookedSlot} ${active ? styles.activeBookedSlot : ''} ${detailed ? styles.detailedSlot : ''} ${className}`
  return interactive ? <button type="button" className={classes} {...props} /> : <div className={classes} {...props} />
}