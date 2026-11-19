import type { ReactNode } from 'react'
import { spacing } from '@/beta-source/lib/tokens'
import styles from './StudentWorkspace.module.css'

export function AccountProfileLayout({ details, side }: { details: ReactNode; side: ReactNode }) {
  return <div className={styles.quickReferenceLayout}>
    <div className={styles.stack} style={{ gap: spacing.lg }}>{details}</div>
    <div className={styles.stack} style={{ gap: spacing.lg }}>{side}</div>
  </div>
}