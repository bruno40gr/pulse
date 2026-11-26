'use client'

import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import SharedEmailTemplates from '@/components/inbox/SharedEmailTemplates'

export default function EmailTemplateSettings({ tenantId }: { tenantId: string }) {
  return <DenseSectionPanel title="Shared templates" headingLevel="h2" actions={
    <SharedEmailTemplates key={tenantId} tenantId={tenantId} channel="email" currentBody="" managementOnly triggerLabel="Manage templates" onApply={() => {}} />
  }>
    Everyone who sends email in your school uses this library.
  </DenseSectionPanel>
}