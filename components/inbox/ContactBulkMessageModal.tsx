'use client'

import { useState } from 'react'
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui'
import { typography, colors, spacing } from '@/lib/tokens'
import ContactBulkComposer from './ContactBulkComposer'

export default function ContactBulkMessageModal({ tenantId, contacts, channel, onClose }: {
  tenantId: string
  contacts: { id: string; first_name: string; last_name: string }[]
  channel: 'sms' | 'email'
  onClose: () => void
}) {
  const [composing, setComposing] = useState(false)
  const title = channel === 'email' ? 'Send email' : 'Send text message'
  return <Modal isOpen onClose={onClose} size="md" layout={composing ? 'fullscreen' : 'content'} ariaLabel={composing ? title : 'Review message recipients'}>
    <ModalHeader title={composing ? title : 'Review selected contacts'} onClose={onClose}
      description={composing ? undefined : `${contacts.length} ${contacts.length === 1 ? 'contact selected' : 'contacts selected'}`} />
    {composing ? <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <ContactBulkComposer tenantId={tenantId} contactIds={contacts.map(contact => contact.id)} channel={channel} onClose={onClose} />
    </div> : <>
      <ModalBody>
        <p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: `0 0 ${spacing.lg}` }}>Messages for minors go to their recorded account holders. Destinations and opt-outs are checked before sending.</p>
        <ul aria-label="Selected contacts" style={{ ...typography.bodySmall, margin: 0, paddingLeft: spacing.xl }}>
          {contacts.map(contact => <li key={contact.id}>{contact.first_name} {contact.last_name}</li>)}
        </ul>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => setComposing(true)}>Continue to {channel === 'email' ? 'email' : 'text message'}</Button>
      </ModalFooter>
    </>}
  </Modal>
}