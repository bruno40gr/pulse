'use client'

import { useState } from 'react'
import SmsRecipientPicker from '@/components/inbox/ConversationSmsRecipientPicker'
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui'
import { PrototypeEmailRecipients } from '@/components/inbox/PrototypeRecipients'
import { emptyEmailRecipients, validMockEmailRecipients, type MockEmailRecipients, type MockRecipient } from '@/lib/prototype-messaging'
import type { PrototypeChannel } from '@/lib/conversations-prototype'

export default function PrototypeNewMessage({ open, onClose, people, preselected, onEmail, onSms, emailDisabled = false, initialChannel }: {
  open: boolean; onClose: () => void; people: MockRecipient[]; preselected?: string; emailDisabled?: boolean; initialChannel?: PrototypeChannel
  onEmail: (recipients: MockEmailRecipients) => void; onSms: (ids: string[]) => void
}) {
  const [channel, setChannel] = useState<PrototypeChannel>(initialChannel || 'sms')
  const [smsIds, setSmsIds] = useState<string[]>(preselected ? [preselected] : [])
  const [recipients, setRecipients] = useState(() => ({ ...emptyEmailRecipients(), to: preselected ? [preselected] : [] }))
  const [smsQuery, setSmsQuery] = useState('')
  function reset() { setChannel(initialChannel || 'sms'); setSmsIds([]); setRecipients(emptyEmailRecipients()); setSmsQuery('') }
  function close() { reset(); onClose() }
  return <>
    <Modal isOpen={open} onClose={close} ariaLabel="New message" size="wide">
      <ModalHeader title={channel === 'sms' ? 'Select text message recipients' : 'Select email recipients'} onClose={close} compact />
      <ModalBody style={{ display: 'flex', flexDirection: 'column' }}>
        {channel === 'sms' ? <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, minHeight: 0 }}><SmsRecipientPicker query={smsQuery} people={people} selected={smsIds} onQueryChange={setSmsQuery} onChange={setSmsIds} /></div> : <PrototypeEmailRecipients people={people} recipients={recipients} onChange={setRecipients} fill />}

      </ModalBody>
      <ModalFooter>
        <Button disabled={channel === 'sms' ? !smsIds.length : emailDisabled || !validMockEmailRecipients(recipients, people)} onClick={() => { if (channel === 'sms') onSms(smsIds); else onEmail(recipients); reset() }}>{channel === 'sms' ? `Send text message${smsIds.length ? ` (${smsIds.length})` : ''}` : 'Write email'}</Button>
      </ModalFooter>
    </Modal>

  </>
}
