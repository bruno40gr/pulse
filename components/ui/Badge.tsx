import { colors, typography, radius } from '@/lib/tokens'

interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'inactive' | 'member' | 'minor' | 'risk' | 'opportunity' | 'milestone' | 'nudge'
  size?: 'sm' | 'md'
  children: React.ReactNode
  style?: React.CSSProperties
}

// Filled pill variants — identical shape, no borders, consistent across all types.
const variantStyles: Record<string, React.CSSProperties> = {
  success: { background: colors.surfaceMuted, color: colors.success },
  warning: { background: colors.surfaceMuted, color: colors.warning },
  error: { background: colors.surfaceMuted, color: colors.error },
  info: { background: colors.surfaceMuted, color: colors.teal },
  neutral: { background: colors.backgroundSecondary, color: colors.textMuted },
  inactive: { background: colors.backgroundSecondary, color: colors.textMuted },
  member: { background: colors.surfaceMuted, color: colors.teal },
  minor: { background: colors.surfaceMuted, color: colors.warning },
  risk: { background: colors.surfaceMuted, color: colors.error },
  opportunity: { background: colors.surfaceMuted, color: colors.teal },
  milestone: { background: colors.surfaceMuted, color: colors.success },
  nudge: { background: colors.surfaceMuted, color: colors.warning },
}

const sizeStyles: Record<'sm' | 'md', React.CSSProperties> = {
  sm: {
    fontSize: '12px',
    padding: '2px 8px',
  },
  md: {
    fontSize: '14px',
    padding: `3px 12px`,
  },
}

export function Badge({ variant = 'neutral', size = 'md', children, style }: BadgeProps) {
  return (
    <span style={{
      ...variantStyles[variant],
      ...sizeStyles[size],
      fontWeight: typography.weightMedium,
      borderRadius: radius.full,
      fontFamily: typography.fontSans,
      display: 'inline-block',
      ...style,
    }}>
      {children}
    </span>
  )
}