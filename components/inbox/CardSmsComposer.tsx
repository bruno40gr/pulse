'use client'

import ComposePanel from '@/components/campaigns/ComposePanel'
import { SlidePanelHeader } from '@/components/ui'

/** A deeper view inside the existing profile drawer, not another dialog layer. */
export default function CardSmsComposer({ recipientId, name, leadId, backDestination, onBack, onClose }: {
  recipientId: string; name: string; leadId?: string; backDestination: 'lead' | 'contact'; onBack: () => void; onClose: () => void
}) {
  const recipient = { id: recipientId, first_name: name.trim().split(/\s+/)[0] || '', last_name: name.trim().split(/\s+/).slice(1).join(' ') }
  return <>
    <SlidePanelHeader title="Send a Text Message" onBack={onBack} backLabel={`Back to ${backDestination}`} onClose={onClose} />
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <ComposePanel recipientCount={1} filterExplanation={`Message to ${name}`} recipientIds={[recipientId]} channel="sms" mode="single"
        contactContext={recipient} recipientPreview={[recipient]} composeSource="scratch" composeIntent="neutral" leadId={leadId}
        onClose={onBack} onSent={onBack} />
    </div>
  </>
}