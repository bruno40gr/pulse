import { colors, typography, spacing } from '@/lib/tokens'

interface SectionLabelProps {
  children: React.ReactNode
  style?: React.CSSProperties
}

export function SectionLabel({ children, style }: SectionLabelProps) {
  return (
    <div style={{
      fontSize: typography.size15,
      fontWeight: typography.weightSemibold,
      color: colors.text,
      marginBottom: spacing.xs,
      fontFamily: typography.fontSans,
      ...style,
    }}>
      {children}
    </div>
  )
}
