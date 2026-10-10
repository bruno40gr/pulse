'use client'

import { SurfacePanel } from '@/components/ui'
import { colors, spacing, typography } from '@/lib/tokens'
import { fundingTotals } from '@/lib/funding/demo'
import { formatCurrency } from './FundingContactDetails'
import type { FundingCase } from './types'

export function FundingSummary({ cases }: { cases: FundingCase[] }) {
  const totals = fundingTotals(cases)
  const cards = [
    { label: 'Total owed', amount: totals.owed, detail: 'All unpaid invoices, including drafts and overdue balances' },
    { label: 'Total paid', amount: totals.paid, detail: 'Recorded paid invoices across loaded history' },
    { label: 'Forecasted payments', amount: totals.forecast, detail: 'Next 30 days · submitted pending invoices due in this window; estimate only' },
  ]
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: spacing.md, marginBottom: spacing.xl }}>
    {cards.map(card => <SurfacePanel key={card.label} padding={spacing.lg}>
      <div style={{ fontSize: typography.sizeSm, color: colors.textSecondary }}>{card.label}</div>
      <div style={{ fontSize: typography.size2xl, fontWeight: typography.weightBold, color: colors.text, margin: `${spacing.sm} 0` }}>{formatCurrency(card.amount)}</div>
      <div style={{ fontSize: typography.sizeXs, color: colors.textMuted }}>{card.detail}</div>
    </SurfacePanel>)}
  </div>
}