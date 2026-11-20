import type { CSSProperties, ReactNode } from 'react'
import { colors, spacing } from '@/lib/tokens'
import styles from './SlidePanelContent.module.css'

/** Shared profile canvas. Cards retain their own headers, actions and density. */
export function SlidePanelContent({ children, tone = 'muted', density = 'comfortable', layout = 'stack', style }: {
  children: ReactNode
  tone?: 'muted' | 'default'
  density?: 'comfortable' | 'compact'
  layout?: 'stack' | 'columns'
  style?: CSSProperties
}) {
  return <div className={styles.canvas} data-density={density} style={{ background: tone === 'muted' ? colors.surfaceMuted : colors.surface, ...style }}>
    <div className={styles.content} data-layout={layout} style={{ gap: spacing.lg }}>{children}</div>
  </div>
}