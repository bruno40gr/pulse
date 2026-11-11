import { colors, typography, spacing, radius } from '@/lib/tokens'

interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  variant?: 'plain' | 'panel' | 'embedded'
  density?: 'default' | 'compact'
}

export function EmptyState({ title, description, action, icon, variant = 'plain', density = 'default' }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: density === 'compact' ? `${spacing.xl} ${spacing.md}` : spacing['4xl'], gap: density === 'compact' ? spacing.sm : spacing.md, textAlign: 'center',
      minWidth: 0, width: '100%', boxSizing: 'border-box',
      ...(variant === 'panel' ? { border: `1px solid ${colors.border}`, borderRadius: radius.xl, background: colors.surface } : {}),
    }}>
      {icon && <div style={{ display: 'inline-flex', color: variant === 'plain' ? undefined : colors.teal, fontSize: '32px', marginBottom: density === 'compact' ? spacing.xs : spacing.sm }}>{icon}</div>}
      <div style={{ fontSize: density === 'compact' ? typography.sizeBase : typography.sizeLg, fontWeight: typography.weightSemibold, color: colors.text, fontFamily: typography.fontSans }}>{title}</div>
      {description && <div style={{ fontSize: typography.sizeBase, color: colors.textMuted, fontFamily: typography.fontSans, maxWidth: '320px', lineHeight: 1.6 }}>{description}</div>}
      {action && <div style={{ marginTop: spacing.sm }}>{action}</div>}
    </div>
  )
}