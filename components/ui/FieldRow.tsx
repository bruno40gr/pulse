import { colors, typography, spacing } from '@/lib/tokens'

interface FieldRowProps {
  label: string
  value?: string | null
  children?: React.ReactNode
}

export function FieldRow({ label, value, children }: FieldRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.sm, lineHeight: 1.3, gap: spacing.md }}>
      <span style={{ fontSize: typography.sizeSm, fontWeight: typography.weightMedium, color: colors.textMuted, fontFamily: typography.fontSans, minWidth: '120px' }}>{label}</span>
      {children || <span style={{ fontSize: typography.size15, fontWeight: typography.weightMedium, color: colors.text, fontFamily: typography.fontSans }}>{value || '\u2014'}</span>}
    </div>
  )
}
