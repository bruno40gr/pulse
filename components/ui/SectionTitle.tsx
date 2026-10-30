import { colors, spacing, typography } from '@/lib/tokens'

interface SectionTitleProps {
  children: React.ReactNode
  style?: React.CSSProperties
  as?: 'h2' | 'h3' | 'h4'
  variant?: 'section' | 'card'
}

export function SectionTitle({ children, style, as: Heading = 'h2', variant = 'section' }: SectionTitleProps) {
  return (
    <Heading style={{
      ...typography.h2,
      color: colors.text,
      margin: 0,
      marginBottom: spacing.md,
      fontFamily: typography.fontSans,
      ...(Heading !== 'h2' ? { fontSize: typography.sizeBase } : {}),
      ...(variant === 'card' ? { fontSize: typography.sizeLg, fontWeight: typography.weightBold, marginBottom: 0 } : {}),
      ...style,
    }}>
      {children}
    </Heading>
  )
}