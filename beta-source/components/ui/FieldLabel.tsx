import { colors, spacing, typography } from '@/beta-source/lib/tokens'

interface FieldLabelProps {
  children: React.ReactNode
  style?: React.CSSProperties
}

export function FieldLabel({ children, style }: FieldLabelProps) {
  return (
    <div data-field-label style={{
      ...typography.label,
      fontWeight: typography.weightNormal,
      color: colors.textMuted,
      marginBottom: spacing.xs,
      fontFamily: typography.fontSans,
      ...style,
    }}>
      {children}
    </div>
  )
}