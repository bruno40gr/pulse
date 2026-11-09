import { colors, typography } from '@/lib/tokens'

interface FieldValueProps {
  children: React.ReactNode
  style?: React.CSSProperties
  title?: string
}

export function FieldValue({ children, style, title }: FieldValueProps) {
  return (
    <div data-field-value title={title} style={{
      minWidth: 0,
      maxWidth: '100%',
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
      fontSize: typography.sizeBase,
      fontWeight: typography.weightMedium,
      color: colors.text,
      fontFamily: typography.fontSans,
      ...style,
    }}>
      {children}
    </div>
  )
}