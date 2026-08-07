import { colors, typography, radius, spacing } from '@/lib/tokens'

interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'minor'
  children: React.ReactNode
  style?: React.CSSProperties
}

const variantStyles: Record<string, React.CSSProperties> = {
  success: { background: colors.successLight, color: colors.success },
  warning: { background: colors.warningLight, color: colors.warning },
  error: { background: colors.errorLight, color: colors.error },
  info: { background: '#EFF6FF', color: '#1D4ED8' },
  neutral: { background: colors.backgroundSecondary, color: colors.textSecondary },
  minor: { background: '#EFF6FF', color: '#1D4ED8' },
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