'use client'

import { SectionTitle } from '@/components/ui/SectionTitle'
import { BackControl } from '@/components/ui/BackControl'
import { spacing } from '@/lib/tokens'
import type { FamilyAction, FamilyPreviewData, PreviewAccount } from '@/lib/academy-family-preview'
import { SectionHeader } from './SectionHeader'
import { Cards } from './WorkspaceManagement'

export function AccountPaymentMethods({ data, account, onBack, onApply }: { data: FamilyPreviewData; account: PreviewAccount; onBack: () => void; onApply: (action: FamilyAction) => string | null }) {
  return <section aria-label="Payment methods" style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
    <BackControl label="Back to billing" showLabel onClick={onBack} />
    <SectionHeader subtitle={`${account.holderName} · Billing & payments`}><SectionTitle as="h2" variant="card">Payment methods</SectionTitle></SectionHeader>
    <Cards data={data} account={account} intent={{ kind: 'cards' }} onApply={onApply} onClose={onBack} />
  </section>
}
