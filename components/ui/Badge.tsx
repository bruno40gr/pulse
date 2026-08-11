import { colors, typography, radius, spacing } from '@/lib/tokens'

interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'minor'
  children: React.ReactNode
  style?: React.CSSProperties
}

const variantStyles: Record<string, React.CSSProperties> = {
  success: { background: colors.surfaceMuted, color: colors.success },
  warning: { background: colors.surfaceMuted, color: colors.warning },
  error: { background: colors.surfaceMuted, color: colors.error },
  info: { background: colors.surfaceMuted, color: colors.textSecondary },
  neutral: { background: colors.surfaceMuted, color: colors.textSecondary },
  minor: { background: colors.surfaceMuted, color: colors.textSecondary },
}

export function Badge({ variant = 'neutral', children, style }: BadgeProps) {
  return (
    <span style={{
      ...variantStyles[variant],
      fontSize: typography.sizeXs,
      fontWeight: typography.weightMedium,
      padding: `2px ${spacing.sm}`,
      borderRadius: radius.full,
      fontFamily: typography.fontSans,
      display: 'inline-block',
      ...style,
    }}>
      {children}
    </span>
  )
}