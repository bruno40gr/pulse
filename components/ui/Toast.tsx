import { colors, typography, radius, spacing } from '@/lib/tokens'

interface ToastProps {
  message: string
  visible: boolean
}

export function Toast({ message, visible }: ToastProps) {
  if (!visible) return null
  return (
    <span style={{
      fontSize: typography.sizeSm,
      color: colors.textSecondary,
      background: colors.backgroundSecondary,
      padding: `${spacing.xs} ${spacing.sm}`,
      borderRadius: radius.sm,
      fontFamily: typography.fontSans,
      border: `1px solid ${colors.border}`,
    }}>
      {message}
    </span>
  )
}