'use client'

import { useState } from 'react'
import SmsRecipientPicker from '@/components/inbox/SmsRecipientPicker'
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui'
import { PrototypeEmailRecipients } from '@/components/inbox/PrototypeRecipients'
import { spacing, typography } from '@/lib/tokens'
import { emptyEmailRecipients, validMockEmailRecipients, type MockEmailRecipients, type MockRecipient } from '@/lib/prototype-messaging'
import type { PrototypeChannel } from '@/lib/conversations-prototype'

export default function PrototypeNewMessage({ open, onClose, people, preselected, onEmail, onSms, emailDisabled = false }: {
  open: boolean; onClose: () => void; people: MockRecipient[]; preselected?: string; emailDisabled?: boolean
  onEmail: (recipients: MockEmailRecipients) => void; onSms: (ids: string[]) => void
}) {
  const [channel, setChannel] = useState<PrototypeChannel | null>(null)
  const [stage, setStage] = useState<'channel' | 'recipients'>('channel')
  const [smsIds, setSmsIds] = useState<string[]>([])
  const [recipients, setRecipients] = useState(emptyEmailRecipients)
  const [smsQuery, setSmsQuery] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const smsPeople = people.filter(person => smsIds.includes(person.id))
  function choose(next: PrototypeChannel) {
    setChannel(next); setStage('recipients')
    if (preselected && !smsIds.length && !recipients.to.length) {
      if (next === 'sms') setSmsIds([preselected])
      else setRecipients({ ...emptyEmailRecipients(), to: [preselected] })
    }
  }
  function reset() { setStage('channel'); setChannel(null); setSmsIds([]); setRecipients(emptyEmailRecipients()); setSmsQuery(''); setConfirmDiscard(false) }
  function close() { reset(); onClose() }
  const smsOptions = people.map(person => ({ id: person.id, first_name: person.name.split(' ')[0], last_name: person.name.split(' ').slice(1).join(' '), phone: person.phone, email: person.email }))
  return <>
    <Modal isOpen={open} onClose={close} ariaLabel="New message" size="lg">
      <ModalHeader title={stage === 'channel' ? 'Send a new message' : channel === 'sms' ? 'SMS recipients' : 'Email recipients'} onClose={close} onBack={stage === 'channel' ? undefined : () => setStage('channel')} backLabel="Back to message type" />
      <ModalBody>
        {stage === 'channel' ? <div style={{ display: 'grid', gap: spacing.xl }}><p style={{ ...typography.body, margin: 0 }}>How would you like to reach out?</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.lg }}>{(['sms', 'email'] as const).map(option => <Button key={option} variant="secondary" size="lg" disabled={option === 'email' && emailDisabled} onClick={() => choose(option)}>{option === 'sms' ? 'SMS' : 'Email'}</Button>)}</div></div> : channel === 'sms' ? <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, height: 'min(55dvh, 480px)' }}><SmsRecipientPicker query={smsQuery} results={smsOptions.filter(person => `${person.first_name} ${person.last_name} ${person.phone}`.toLowerCase().includes(smsQuery.trim().toLowerCase()))} selected={smsOptions.filter(person => smsIds.includes(person.id))} handleSearch={setSmsQuery} toggleRecipient={person => setSmsIds(current => current.includes(person.id) ? current.filter(id => id !== person.id) : [...current, person.id])} /></div> : <PrototypeEmailRecipients people={people} recipients={recipients} onChange={setRecipients} />}

      </ModalBody>
      {stage !== 'channel' && <ModalFooter leading={<div style={{ display: 'flex', gap: spacing.md }}>{(smsIds.length > 0 || recipients.to.length > 0) && <Button variant="ghost" onClick={() => setConfirmDiscard(true)}>Discard new message</Button>}</div>}>
        {stage === 'recipients' && <Button disabled={channel === 'sms' ? !smsIds.length || smsPeople.some(person => !person.phone) : !validMockEmailRecipients(recipients, people)} onClick={() => { if (channel === 'sms') onSms(smsIds); else onEmail(recipients); reset() }}>{channel === 'sms' ? `Write SMS${smsIds.length ? ` (${smsIds.length})` : ''}` : 'Write email'}</Button>}
      </ModalFooter>}
    </Modal>
    <Modal isOpen={confirmDiscard && open} onClose={() => setConfirmDiscard(false)} ariaLabel="Discard new message" size="sm"><ModalHeader title="Discard this new message?" onClose={() => setConfirmDiscard(false)} /><ModalBody>Your recipient selection will be removed.</ModalBody><ModalFooter><Button variant="secondary" onClick={() => setConfirmDiscard(false)}>Keep message</Button><Button variant="destructive" onClick={() => { reset(); onClose() }}>Discard message</Button></ModalFooter></Modal>
  </>
}
