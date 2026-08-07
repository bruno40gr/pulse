import { colors, typography, spacing } from '@/lib/tokens'

interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: spacing['4xl'], gap: spacing.md, textAlign: 'center',
    }}>
      {icon && <div style={{ fontSize: '32px', marginBottom: spacing.sm }}>{icon}</div>}
      <div style={{ fontSize: typography.sizeLg, fontWeight: typography.weightSemibold, color: colors.text, fontFamily: typography.fontSans }}>{title}</div>
      {description && <div style={{ fontSize: typography.sizeBase, color: colors.textMuted, fontFamily: typography.fontSans, maxWidth: '320px', lineHeight: 1.6 }}>{description}</div>}
      {action && <div style={{ marginTop: spacing.sm }}>{action}</div>}
    </div>
  )
}