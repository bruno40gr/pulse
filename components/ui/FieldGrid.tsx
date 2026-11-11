import type { ReactNode } from 'react'
import styles from './FieldGrid.module.css'

/** At most two fields per row; responds to the actual panel width, not the viewport. */
export function FieldGrid({ children, columns = 2 }: { children: ReactNode; columns?: 1 | 2 }) {
  return <div className={styles.container}><div className={styles.grid} data-field-grid="" data-columns={columns}>{children}</div></div>
}