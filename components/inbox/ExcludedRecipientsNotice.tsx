'use client'

import { useId, useState } from 'react'
import { Notice } from '@/components/ui/Notice'
import { ControlButton } from '@/components/ui/ControlButton'
import { spacing } from '@/lib/tokens'

export default function ExcludedRecipientsNotice({ contacts, channel }: {
  contacts: Array<{ id: string; name: string; reason: string }>; channel: 'sms' | 'email'
}) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  if (!contacts.length) return null
  return <Notice variant="warning" title="Excluded from sending">
    <span>{contacts.length} {contacts.length === 1 ? 'contact cannot' : 'contacts cannot'} be reached by {channel === 'sms' ? 'SMS' : 'email'}.</span>{' '}
    <ControlButton kind="link" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(value => !value)}>{expanded ? 'Hide contacts' : 'See contacts'}</ControlButton>
    {expanded && <ul id={listId} aria-label="Excluded contacts" style={{ margin: `${spacing.sm} 0 0`, paddingLeft: spacing.xl, maxHeight: 240, overflowY: 'auto' }}>
      {contacts.map(contact => <li key={contact.id}>{contact.name} — {contact.reason}</li>)}
    </ul>}
  </Notice>
}