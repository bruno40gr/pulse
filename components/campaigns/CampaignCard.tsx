'use client'

import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { colors, radius, spacing, typography } from '@/lib/tokens'

/** The one campaign row shape: what was sent, its status and its counters. */
export function CampaignCard({ headline, meta, status, date, stats, selected = false, onClick, children }: {
  headline: string
  meta?: string | null
  status: { label: string; variant: 'success' | 'info' | 'error' | 'neutral' | 'warning' }
  date: string
  stats: { label: string; value: ReactNode; color?: string }[]
  selected?: boolean
  onClick?: () => void
  children?: ReactNode
}) {
  return <div
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() } } : undefined}
    style={{
      background: colors.surface,
      border: `1px solid ${selected ? colors.espresso : colors.border}`,
      borderRadius: radius.xl,
      padding: spacing['2xl'],
      cursor: onClick ? 'pointer' : undefined,
      transition: 'border-color 0.15s',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.lg, marginBottom: spacing.md }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...typography.body, color: colors.text, marginBottom: spacing.xs }}>{headline}</div>
        {meta && <div style={{ ...typography.helper, color: colors.textMuted }}>{meta}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexShrink: 0 }}>
        <Badge variant={status.variant}>{status.label}</Badge>
        <span style={{ ...typography.helper, color: colors.textMuted }}>{date}</span>
      </div>
    </div>
    <div style={{ display: 'flex', gap: spacing['2xl'], flexWrap: 'wrap', borderTop: `1px solid ${colors.borderLight}`, paddingTop: spacing.md }}>
      {stats.map(stat => <div key={stat.label}>
        <div style={{ ...typography.helper, color: colors.textMuted, marginBottom: spacing.xs }}>{stat.label}</div>
        <div style={{ ...typography.body, fontWeight: typography.weightSemibold, color: stat.color || colors.text }}>{stat.value}</div>
      </div>)}
    </div>
    {children}
  </div>
}
