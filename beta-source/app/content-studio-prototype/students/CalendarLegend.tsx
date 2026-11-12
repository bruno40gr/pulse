import type { CSSProperties } from 'react'
import styles from '../enrollment/enrollment.module.css'

/** Shared, vertically centered calendar color key. */
export function CalendarLegend({ moving = false }: { moving?: boolean }) {
  return <div aria-label="Calendar colors" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
    <span className={styles.bookedSlot} style={legendItem}>{moving ? 'Family / original lessons' : 'Family lessons'}</span>
    <span className={`${styles.openSlot} ${styles.availableLegend}`} style={legendItem}>Available time</span>
    <span className={styles.replacementSlot} style={legendItem}>Selected replacement</span>
  </div>
}
const legendItem: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', minHeight: 34, margin: 0, padding: '6px 8px', width: 'auto', borderRadius: 5, lineHeight: '18px', cursor: 'default' }
