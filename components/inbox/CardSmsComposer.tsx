'use client'

import { useContext, useMemo, useState } from 'react'
import { ContactPrototypeContext } from '@/components/contacts/ContactPrototypeContext'
import ComposePanel from '@/components/campaigns/ComposePanel'
import { SlidePanelHeader } from '@/components/ui'

/** A deeper view inside the existing profile drawer, not another dialog layer. */
export default function CardSmsComposer({ recipientId, name, leadId, backDestination, onBack, onClose, embedded = false }: {
  recipientId: string; name: string; leadId?: string; backDestination: 'lead' | 'contact'; onBack: () => void; onClose: () => void
  embedded?: boolean
}) {
  const simulated = useContext(ContactPrototypeContext)
  const [body, setBody] = useState('')
  const recipient = useMemo(() => ({ id: recipientId, first_name: name.trim().split(/\s+/)[0] || '', last_name: name.trim().split(/\s+/).slice(1).join(' ') }), [recipientId, name])
  const recipientIds = useMemo(() => [recipientId], [recipientId])
  const recipientPreview = useMemo(() => [recipient], [recipient])
  return <>
    {!embedded && <SlidePanelHeader title="Send a Text Message" onBack={onBack} backLabel={`Back to ${backDestination}`} onClose={onClose} />}
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ComposePanel recipientCount={1} filterExplanation={`Message to ${name}`} recipientIds={recipientIds} channel="sms" mode="single"
        conversation={simulated ? { body, onChange: setBody, onSend: async () => onBack() } : undefined}
        contactContext={recipient} recipientPreview={recipientPreview} composeSource="scratch" composeIntent="neutral" leadId={leadId}
        onClose={onBack} onSent={onBack} />
    </div>
  </>
}