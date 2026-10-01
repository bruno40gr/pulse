'use client'
import { colors, typography, spacing } from '@/lib/tokens'

interface PageHeaderProps {
  title: string
  subtitle?: string
  right?: React.ReactNode
  singleLine?: boolean
}

export function PageHeader({ title, subtitle, right, singleLine = false }: PageHeaderProps) {
  if (right) {
    return (
      <div style={{ marginBottom: spacing['3xl'], display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.lg, flexWrap: singleLine ? 'nowrap' : 'wrap' }}>
        <div style={{ flex: singleLine ? '1 1 auto' : '1 1 420px', minWidth: 0 }}>
          <h1 style={{ ...typography.h1, color: colors.text, margin: 0 }}>{title}</h1>
          {subtitle && (
            <p style={{ color: colors.textSecondary, fontSize: typography.sizeMd, marginTop: spacing.xs, marginBottom: 0 }}>
              {subtitle}
            </p>
          )}
        </div>
        <div style={{ flex: '0 1 auto' }}>{right}</div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: spacing['3xl'] }}>
      <h1 style={{ ...typography.h1, color: colors.text, margin: 0 }}>{title}</h1>
      {subtitle && (
        <p style={{ color: colors.textSecondary, fontSize: typography.sizeMd, marginTop: spacing.xs, marginBottom: 0 }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}