'use client'

import { useState } from 'react'
import ComposePanel from '@/components/campaigns/ComposePanel'
import { SlidePanelHeader } from '@/components/ui'
import { formatPhoneNumber } from '@/lib/phone'
import { spacing } from '@/lib/tokens'
import HolderRecipientPicker, { type HolderRecipient } from './HolderRecipientPicker'

/** Explicitly opted-in review transport. No campaign creation, API send or persistence. */
export default function PrototypeContactSms({ subject, recipientId, recipientName, phone, holders = [], onBack, onClose }: {
  subject: { id: string; first_name: string; last_name: string }
  recipientId: string; recipientName: string; phone: string | null
  holders?: HolderRecipient[]
  onBack: () => void; onClose: () => void
}) {
  const [body, setBody] = useState('')
  const [sent, setSent] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (holders.length < 2) return recipientId ? [recipientId] : []
    const primary = holders.filter(holder => holder.is_primary)
    return primary.length === 1 ? [primary[0].person_id] : []
  })
  const selected = holders.length > 1 ? holders.filter(holder => selectedIds.includes(holder.person_id))
    : recipientId ? [{ person_id: recipientId, name: recipientName, phone }] : []
  const subjectName = `${subject.first_name} ${subject.last_name}`
  return <>
    <SlidePanelHeader title="Send a Text Message" onBack={onBack} backLabel="Back to contact" onClose={onClose} />
    {sent && <p role="status" style={{ paddingInline: spacing.lg }}>Message sent.</p>}
    <ComposePanel recipientCount={selected.length} recipientIds={selected.map(holder => holder.person_id)} mode="single" channel="sms"
      recipientDestination={selected.length === 1 ? formatPhoneNumber(selected[0].phone) : undefined}
      recipientContent={holders.length > 1 ? <HolderRecipientPicker holders={holders} selectedIds={selectedIds}
        onChange={ids => { setSelectedIds(ids); setSent(false) }} /> : undefined}
      filterExplanation={subject.id !== recipientId ? `About ${subjectName}` : ''} composeSource="scratch"
      messageLabel={subject.id !== recipientId ? `About ${subjectName}` : undefined}
      recipientPreview={selected.map(holder => ({ id: holder.person_id, first_name: holder.name.split(' ')[0], last_name: holder.name.split(' ').slice(1).join(' ') }))}
      conversation={{ body, onChange: value => { setBody(value); setSent(false) }, disabled: !selected.length || selected.some(holder => !holder.phone),
        onSend: async () => { setSent(true); setBody('') } }} onClose={onBack} />
  </>
}