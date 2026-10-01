'use client'

import { Badge, DenseSectionPanel, DetailField, Select } from '@/components/ui'
import { colors, radius, shadows, spacing, typography } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'
import type { FundingCase } from './types'

interface FundingContactDetailsProps {
  fundingCase: FundingCase
  onNextStepChange?: (value: string) => void
  embedded?: boolean
}

export function FundingContactDetails({ fundingCase, onNextStepChange, embedded = false }: FundingContactDetailsProps) {
  const isMobile = useIsMobile()
  const statusVariant = fundingCase.status === 'paid' ? 'success' : fundingCase.status === 'needs_review' ? 'risk' : fundingCase.status === 'waiting' ? 'nudge' : 'info'

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: colors.background, padding: embedded ? (isMobile ? '16px' : '24px 28px') : 0, minWidth: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: spacing.lg, maxWidth: embedded ? '1100px' : undefined }}>
        <DenseSectionPanel
          title="Funding case"
          style={{ borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` }}
          contentStyle={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: spacing.lg }}
        >
          <DetailField label="Funding organization" value={fundingCase.fundingOrganization} />
          <DetailField label="Program type" value={fundingCase.programType} />
          <DetailField label="Service" value={fundingCase.service} />
          <DetailField label="Authorization / PO" value={fundingCase.authorization} />
          <DetailField label="Status"><Badge variant={statusVariant}>{fundingCase.statusLabel}</Badge></DetailField>
          <DetailField label="Waiting on" value={fundingCase.owner} />
        </DenseSectionPanel>

        <DenseSectionPanel
          title="Billing"
          style={{ borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` }}
          contentStyle={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: spacing.lg }}
        >
          <DetailField label="Expected" value={formatCurrency(fundingCase.amountExpected)} />
          <DetailField label="Paid" value={formatCurrency(fundingCase.amountPaid)} />
          <DetailField label="Outstanding" value={formatCurrency(fundingCase.outstanding)} />
          <DetailField label="Invoice cadence" value={fundingCase.invoiceCadence} />
          <DetailField label="Submission route" value={fundingCase.submissionRoute} />
          <DetailField label="Payment method" value={fundingCase.paymentMethod} />
        </DenseSectionPanel>

        <DenseSectionPanel
          title="Suggested next step"
          style={{ borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` }}
        >
          <Select
            aria-label="Suggested next step"
            value={fundingCase.nextStep}
            onChange={(event) => onNextStepChange?.(event.target.value)}
            disabled={!onNextStepChange}
            hint="Editable suggestion based on the case record. Confirm before acting."
          >
            {fundingCase.nextStepOptions.map(option => <option key={option} value={option}>{option}</option>)}
          </Select>
          {fundingCase.dueDate && <p style={{ margin: `${spacing.sm} 0 0`, color: colors.textSecondary, fontSize: typography.sizeSm }}>Due {formatDate(fundingCase.dueDate)}</p>}
        </DenseSectionPanel>

        <DenseSectionPanel
          title="Instructions"
          style={{ borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` }}
        >
          <p style={{ margin: 0, color: colors.text, fontSize: typography.sizeBase, lineHeight: 1.5 }}>{fundingCase.instructions}</p>
        </DenseSectionPanel>

        <DenseSectionPanel
          title="Case activity"
          style={{ gridColumn: isMobile ? undefined : '1 / -1', borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` }}
          contentStyle={{ display: 'flex', flexDirection: 'column' }}
        >
          {fundingCase.activity.map((item, index) => (
            <div key={item.id} style={{ padding: `${spacing.md} 0`, borderTop: index ? `1px solid ${colors.borderLight}` : 'none', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(160px, 0.45fr) minmax(0, 1fr)', gap: spacing.sm }}>
              <div>
                <div style={{ color: colors.text, fontSize: typography.sizeBase, fontWeight: typography.weightSemibold }}>{item.title}</div>
                <div style={{ color: colors.textMuted, fontSize: typography.sizeXs, marginTop: spacing.xs }}>{formatDate(item.date)}</div>
              </div>
              <div style={{ color: colors.textSecondary, fontSize: typography.sizeBase }}>{item.detail}</div>
            </div>
          ))}
        </DenseSectionPanel>
      </div>
    </div>
  )
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}