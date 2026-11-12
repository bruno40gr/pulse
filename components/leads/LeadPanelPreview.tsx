'use client'

import { DenseSectionPanel, DetailField, SlidePanelHeader, StatusBadge } from '@/components/ui'
import { formatLeadStatus } from '@/lib/lead-status'
import { colors, spacing } from '@/lib/tokens'

// List data is already visible to this viewer. Do not expose mutation or messaging
// controls until the fresh, authorized detail response has replaced this preview.
export function LeadPanelPreview({ lead, loading, onClose }: {
  lead: { status: string; program_label: string | null; contact?: { full_name: string; email: string | null; phone: string | null } | null }
  loading: boolean
  onClose: () => void
}) {
  return <section aria-label="Lead preview" aria-busy={loading}>
    <SlidePanelHeader title={lead.contact?.full_name || 'Lead'} subtitle="Read-only preview from the loaded list" onClose={onClose} />
    <div style={{ padding: spacing.lg, display: 'grid', gap: spacing.lg }}>
      <p role="status" style={{ margin: 0, color: colors.textSecondary }}>
        {loading ? 'Verifying current details… Editing and messaging will be available when verification finishes.' : 'Current details could not be verified. Editing and messaging remain unavailable.'}
      </p>
      <StatusBadge status={lead.status} label={formatLeadStatus(lead.status)} />
      <DenseSectionPanel title="Contact details">
        <div style={{ display: 'grid', gap: spacing.lg }}>
          <DetailField label="Email" value={lead.contact?.email} />
          <DetailField label="Phone" value={lead.contact?.phone} />
          <DetailField label="Program" value={lead.program_label} />
        </div>
      </DenseSectionPanel>
    </div>
  </section>
}