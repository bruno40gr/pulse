'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui'
import { typography, colors, spacing } from '@/lib/tokens'

export default function ContactBulkMessageModal({ tenantId, contacts, channel, onClose }: {
  tenantId: string
  contacts: { id: string; first_name: string; last_name: string }[]
  channel: 'sms' | 'email'
  onClose: () => void
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const title = channel === 'email' ? 'Sending emails to a group of contacts' : 'Sending text messages to a group of contacts'
  function continueToConversations() {
    try {
      const id = crypto.randomUUID()
      sessionStorage.setItem(`pulse:bulk-selection:${id}`, JSON.stringify({ tenantId, contactIds: contacts.map(contact => contact.id), channel }))
      router.push(`/dashboard/inbox/bulk?selection=${id}`)
      onClose()
    } catch { setError('Unable to open the composer. Allow browser session storage and try again.') }
  }
  return <Modal isOpen onClose={onClose} size="md" layout="content" ariaLabel={title}>
    <ModalHeader title={title} onClose={onClose} />
      <ModalBody>
        <p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: 0 }}>Only contacts with {channel === 'email' ? 'an email address' : 'a phone number'} on file will receive {channel === 'email' ? 'an email' : 'a text message'}. Contacts without {channel === 'email' ? 'an email address' : 'a phone number'}, or who have opted out of {channel === 'email' ? 'emails' : 'text messages'}, will be excluded automatically.</p>
        {error && <p role="alert" style={{ marginTop: spacing.md }}>{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={continueToConversations}>Continue</Button>
      </ModalFooter>
  </Modal>
}