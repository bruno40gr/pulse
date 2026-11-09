import { Children, type ReactNode } from 'react'
import { spacing } from '@/lib/tokens'

/** Read-only metadata uses three consistent equal-width tracks, including partially filled rows. */
export function MetadataRow({ children, label }: { children: ReactNode; label: string }) {
  const items = Children.toArray(children)
  return <div aria-label={label} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', columnGap: spacing.xl, rowGap: spacing.lg, minWidth: 0, overflowWrap: 'anywhere' }}>{items}</div>
}