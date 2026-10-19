import { colors, typography } from '@/lib/tokens'

interface SectionTitleProps {
  children: React.ReactNode
  style?: React.CSSProperties
}

export function SectionTitle({ children, style }: SectionTitleProps) {
  return (
    <h2 style={{
      ...typography.h2,
      color: colors.text,
      margin: 0,
      marginBottom: '4px',
      fontFamily: typography.fontSans,
      ...style,
    }}>
      {children}
    </h2>
  )
}