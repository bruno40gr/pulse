'use client'

import { Badge, Button, DenseSectionPanel, DetailField, Select } from '@/components/ui'
import { colors, radius, shadows, spacing, typography } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'
import { INVOICE_STATUS_LABELS } from '@/lib/funding/invoice-status'
import type { FundingCase, FundingInvoice } from './types'

interface FundingContactDetailsProps {
  fundingCase: FundingCase
  onNextStepChange?: (value: string) => void
  onInvoiceStatusChange?: (invoice: FundingInvoice) => void
  embedded?: boolean
}

export function FundingContactDetails({ fundingCase, onNextStepChange, onInvoiceStatusChange, embedded = false }: FundingContactDetailsProps) {
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
          title="Invoices"
          style={{ gridColumn: isMobile ? undefined : '1 / -1', borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` }}
          contentStyle={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}
        >
          {fundingCase.invoices.length === 0 ? (
            <p style={{ margin: 0, color: colors.textMuted, fontSize: typography.sizeBase }}>No invoices have been recorded for this case.</p>
          ) : fundingCase.invoices.map(invoice => (
            <div key={invoice.id} style={{ border: `1px solid ${colors.borderLight}`, borderRadius: radius.lg, background: colors.surface, overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: spacing.md, padding: spacing.lg, background: colors.surfaceMuted }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                    <strong style={{ color: colors.text, fontSize: typography.sizeBase }}>{invoice.invoiceNumber}</strong>
                    <InvoiceStatusBadge invoice={invoice} />
                  </div>
                  <div style={{ color: colors.textSecondary, fontSize: typography.sizeSm, marginTop: spacing.xs }}>
                    {formatInvoicePeriod(invoice)} · {formatCurrency(invoice.amount)}
                    {invoice.dueOn ? ` · Due ${formatDate(invoice.dueOn)}` : ''}
                  </div>
                </div>
                {onInvoiceStatusChange && <Button size="sm" variant="secondary" onClick={() => onInvoiceStatusChange(invoice)}>Update status</Button>}
              </div>
              {invoice.rejectionEvidence && (
                <div style={{ padding: spacing.lg, borderTop: `1px solid ${colors.borderLight}`, color: colors.error, fontSize: typography.sizeSm }}>
                  <strong>Rejection evidence:</strong> {invoice.rejectionEvidence}
                </div>
              )}
              <div style={{ padding: `0 ${spacing.lg} ${spacing.sm}` }}>
                {invoice.statusEvents.map(event => (
                  <div key={event.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(150px, 0.35fr) minmax(0, 1fr)', gap: spacing.sm, padding: `${spacing.md} 0`, borderTop: `1px solid ${colors.borderLight}` }}>
                    <div style={{ color: colors.textMuted, fontSize: typography.sizeXs }}>{formatDateTime(event.changedAt)}</div>
                    <div style={{ color: colors.textSecondary, fontSize: typography.sizeSm }}>
                      <strong style={{ color: colors.text }}>{event.fromStatus ? `${INVOICE_STATUS_LABELS[event.fromStatus]} → ` : ''}{INVOICE_STATUS_LABELS[event.toStatus]}</strong>
                      {(event.note || event.evidence) && <div style={{ marginTop: spacing.xs }}>{event.note || event.evidence}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
  const date = value.includes('T') ? new Date(value) : new Date(`${value}T12:00:00`)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatInvoicePeriod(invoice: FundingInvoice) {
  if (invoice.servicePeriodStart && invoice.servicePeriodEnd) return `${formatDate(invoice.servicePeriodStart)}–${formatDate(invoice.servicePeriodEnd)}`
  if (invoice.servicePeriodStart) return `From ${formatDate(invoice.servicePeriodStart)}`
  return invoice.issuedOn ? `Issued ${formatDate(invoice.issuedOn)}` : 'Service period not recorded'
}

function InvoiceStatusBadge({ invoice }: { invoice: FundingInvoice }) {
  const variant = invoice.status === 'paid' ? 'success' : invoice.status === 'rejected' || invoice.status === 'overdue' ? 'risk' : invoice.status === 'pending' ? 'nudge' : 'neutral'
  return <Badge variant={variant} size="sm">{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
}