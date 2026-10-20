'use client'

import { useState } from 'react'
import SmsRecipientPicker from '@/components/inbox/SmsRecipientPicker'
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
  const smsOptions = people.map(person => ({ id: person.id, first_name: person.name.split(' ')[0], last_name: person.name.split(' ').slice(1).join(' '), phone: person.phone, email: person.email }))
  return <>
    <Modal isOpen={open} onClose={close} ariaLabel="New message" size="lg">
      <ModalHeader title={channel === 'sms' ? 'Select text message recipients' : 'Select email recipients'} onClose={close} compact />
      <ModalBody style={{ display: 'flex', flexDirection: 'column' }}>
        {channel === 'sms' ? <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, minHeight: 0 }}><SmsRecipientPicker query={smsQuery} results={smsOptions.filter(person => `${person.first_name} ${person.last_name} ${person.phone}`.toLowerCase().includes(smsQuery.trim().toLowerCase()))} selected={smsOptions.filter(person => smsIds.includes(person.id))} handleSearch={setSmsQuery} toggleRecipient={person => setSmsIds(current => current.includes(person.id) ? current.filter(id => id !== person.id) : [...current, person.id])} /></div> : <PrototypeEmailRecipients people={people} recipients={recipients} onChange={setRecipients} fill />}

      </ModalBody>
      <ModalFooter>
        <Button disabled={channel === 'sms' ? !smsIds.length : emailDisabled || !validMockEmailRecipients(recipients, people)} onClick={() => { if (channel === 'sms') onSms(smsIds); else onEmail(recipients); reset() }}>{channel === 'sms' ? `Send text message${smsIds.length ? ` (${smsIds.length})` : ''}` : 'Write email'}</Button>
      </ModalFooter>
    </Modal>

  </>
}
