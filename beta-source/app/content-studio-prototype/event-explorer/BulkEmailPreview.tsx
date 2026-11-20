'use client'

import { useState } from 'react'
import PrototypeEmailComposer, { type PrototypeEmailDraft } from '@/components/inbox/PrototypeEmailComposer'
import type { MockTemplate } from '@/lib/prototype-messaging'
import { Notice } from '@/components/ui/Notice'
import { spacing } from '@/lib/tokens'

export default function BulkEmailPreview({ recipients, onSimulate, onClose }: { recipients: { id: string; name: string }[]; onSimulate: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState<PrototypeEmailDraft>({ subject: '', html: '', contactOnly: true })
  const [templates, setTemplates] = useState<MockTemplate[]>([])
  return <>
    <Notice style={{ margin: spacing.lg }}>Preview only. No email will be sent.</Notice>
    <PrototypeEmailComposer name="" email="" student="" draft={draft} onChange={setDraft}
      senderName="Headliner" senderEmail="" fromControl="Headliner (preview)" signatureHtml="" people={[]} templates={templates}
      recipientSummary={<span>{recipients.length} selected · {recipients.map(person => person.name).join(', ')}</span>}
      onCreateTemplate={template => setTemplates(current => [...current, template])} onCollapse={onClose} onDiscard={onClose} replying={false}
      disabled={!recipients.length} sendLabel="Simulate send" onSend={onSimulate} />
  </>
}