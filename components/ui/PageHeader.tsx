'use client'
import { BackControl } from './BackControl'
import { colors, typography, spacing } from '@/lib/tokens'

interface PageHeaderProps {
  title: string
  subtitle?: string
  right?: React.ReactNode
  titleAction?: React.ReactNode
  onBack?: () => void
  backLabel?: string
  singleLine?: boolean
}

export function PageHeader({ title, subtitle, right, titleAction, onBack, backLabel = 'Back', singleLine = false }: PageHeaderProps) {
  if (right) {
    return (
      <div style={{ marginBottom: spacing['3xl'], display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.lg, flexWrap: singleLine ? 'nowrap' : 'wrap' }}>
        <div style={{ flex: singleLine ? '1 1 auto' : '1 1 420px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>{onBack && <BackControl label={backLabel} onClick={onBack} />}<div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: spacing.lg, minWidth: 0 }}><h1 style={{ ...typography.h1, color: colors.text, margin: 0 }}>{title}</h1>{titleAction}</div></div>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>{onBack && <BackControl label={backLabel} onClick={onBack} />}<div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: spacing.lg, minWidth: 0 }}><h1 style={{ ...typography.h1, color: colors.text, margin: 0 }}>{title}</h1>{titleAction}</div></div>
      {subtitle && (
        <p style={{ color: colors.textSecondary, fontSize: typography.sizeMd, marginTop: spacing.xs, marginBottom: 0 }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}