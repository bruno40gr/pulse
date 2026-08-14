'use client'
import { colors, typography, spacing } from '@/lib/tokens'

interface PageHeaderProps {
  title: string
  subtitle?: string
  right?: React.ReactNode
}

export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  if (right) {
    return (
      <div style={{ marginBottom: spacing['3xl'], display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.lg }}>
        <div>
          <h1 style={{ ...typography.h1, color: colors.text, margin: 0 }}>{title}</h1>
          {subtitle && (
            <p style={{ color: colors.textSecondary, fontSize: typography.sizeMd, marginTop: spacing.xs, marginBottom: 0 }}>
              {subtitle}
            </p>
          )}
        </div>
        <div style={{ flexShrink: 0 }}>{right}</div>
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