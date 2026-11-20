'use client'

import { colors, radius, spacing } from '@/lib/tokens'
import styles from './LoadingSkeleton.module.css'

/** Quiet loading geometry with one accessible announcement, not placeholder copy. */
export function LoadingSkeleton({ label = 'Loading', rows = 3, variant = 'content' }: { label?: string; rows?: number; variant?: 'content' | 'cards' }) {
  return <div role="status" aria-label={label} aria-busy="true" style={{ display: 'grid', gap: spacing.lg, minWidth: 0 }}>
    {Array.from({ length: rows }, (_, index) => <div key={index} aria-hidden="true" style={{ display: 'grid', gap: spacing.md, ...(variant === 'cards' ? { padding: spacing.xl, border: `1px solid ${colors.border}`, borderRadius: radius.xl } : {}) }}>
      <div className={styles.block} style={{ background: colors.borderLight, width: '48%', height: 18 }} />
      <div className={styles.block} style={{ background: colors.borderLight, width: '76%', height: 12 }} />
      {variant === 'cards' && <div style={{ display: 'flex', gap: spacing.xl, paddingTop: spacing.md }}>{[0, 1, 2, 3].map(item => <div key={item} className={styles.block} style={{ background: colors.borderLight, width: 48, height: 32 }} />)}</div>}
    </div>)}
  </div>
}