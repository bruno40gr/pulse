import { colors, typography } from '@/lib/tokens'

interface FieldValueProps {
  children: React.ReactNode
  style?: React.CSSProperties
}

export function FieldValue({ children, style }: FieldValueProps) {
  return (
    <div style={{
      fontSize: '16px',
      fontWeight: 500,
      color: colors.text,
      fontFamily: typography.fontSans,
      ...style,
    }}>
      {children}
    </div>
  )
}