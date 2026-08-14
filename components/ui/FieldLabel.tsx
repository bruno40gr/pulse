import { colors, typography } from '@/lib/tokens'

interface FieldLabelProps {
  children: React.ReactNode
  style?: React.CSSProperties
}

export function FieldLabel({ children, style }: FieldLabelProps) {
  return (
    <div style={{
      fontSize: '14px',
      fontWeight: 600,
      color: colors.textMuted,
      marginBottom: '2px',
      fontFamily: typography.fontSans,
      ...style,
    }}>
      {children}
    </div>
  )
}