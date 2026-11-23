import type { CSSProperties, ReactNode } from 'react'
import { DenseSectionPanel, FieldValue, StatusBadge } from '@/beta-source/components/ui'
import { SectionTitle } from '@/beta-source/components/ui/SectionTitle'
import { OverflowMenu } from '@/beta-source/components/ui/OverflowMenu'
import { spacing, typography } from '@/beta-source/lib/tokens'

export function SubscriptionCard({ title, status, detail, schedule, instructor, payment, actions, style }: {
  title: ReactNode; status?: { key: string; label: string }; detail?: ReactNode; schedule?: ReactNode; instructor?: ReactNode; payment?: ReactNode
  actions?: { label: string; onManage: () => void }; style?: CSSProperties
}) {
  return <DenseSectionPanel style={{ gap: 0, ...style }}
    title={<div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: spacing.sm }}>
      <SectionTitle as="h2" style={{ marginBottom: 0, fontWeight: typography.weightBold }}>{title}</SectionTitle>
      {status && <StatusBadge status={status.key} label={status.label} />}
    </div>}
    actions={actions && <OverflowMenu label={actions.label} items={[{ label: 'Manage subscription', onSelect: actions.onManage }]} />}>
    <FieldValue style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      {detail && <div>{detail}</div>}
      {schedule && <div>{schedule}</div>}
      {instructor}{payment}
    </FieldValue>
  </DenseSectionPanel>
}