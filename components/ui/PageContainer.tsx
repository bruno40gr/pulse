import { spacing } from '@/lib/tokens'

interface PageContainerProps {
  children: React.ReactNode
  maxWidth?: string | number
  style?: React.CSSProperties
}

/**
 * Standard dashboard page shell — 28px (spacing['3xl']) padding, left-aligned,
 * full-width by default. Use with `PageHeader` so every page title sits on the
 * same axis. Pass `maxWidth` to constrain wide content (e.g. '900px').
 */
export function PageContainer({ children, maxWidth = '100%', style }: PageContainerProps) {
  return (
    <div style={{ padding: spacing['3xl'], width: '100%', maxWidth, ...style }}>
      {children}
    </div>
  )
}
