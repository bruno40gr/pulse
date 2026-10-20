import type { ReactNode } from 'react'
import { colors, spacing } from '@/lib/tokens'

/** Shared bottom action row for email and text composers. */
export function ComposerFooter({ leading, children }: { leading?: ReactNode; children: ReactNode }) {
  return <footer aria-label="Composer actions" style={{ marginTop: 'auto', padding: `${spacing.lg} ${spacing.xl}`, borderTop: `1px solid ${colors.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spacing.md, flexShrink: 0, background: colors.surface }}>
    {leading && <div style={{ marginRight: 'auto', minWidth: 0 }}>{leading}</div>}
    <div style={{ marginLeft: 'auto', display: 'flex', justifyContent: 'flex-end' }}>{children}</div>
  </footer>
}