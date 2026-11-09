'use client'

import { useState } from 'react'
import { Button, DenseSectionPanel, FieldGrid, Input, Modal, ModalBody, ModalHeader, Select } from '@/components/ui'
import { previewContacts, type FamilyAction, type FamilyPreviewData, type PreviewAccount } from '@/lib/academy-family-preview'
import { previewStudentName, type PreviewStudent } from '@/lib/academy-student-preview'
import { spacing } from '@/lib/tokens'

export function RelationshipManager({ data, account, student, onApply }: { data: FamilyPreviewData; account: PreviewAccount; student?: PreviewStudent; onApply: (action: FamilyAction) => string | null }) {
  const [open, setOpen] = useState(false)
  const [payerIds, setPayerIds] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState('')
  const [query, setQuery] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [relationship, setRelationship] = useState('Parent / guardian')
  const [error, setError] = useState('')
  const selfManaged = student && account.holderId === student.id && account.studentIds.length === 1
  const contacts = previewContacts(data).filter(person => person.id !== student?.id)
  function apply(action: FamilyAction) { const message = onApply(action); setError(message || ''); if (!message) setOpen(false) }
  return <DenseSectionPanel title="Relationships" actions={<Button variant="secondary" onClick={() => { setError(''); setOpen(true) }}>{selfManaged ? 'Add account holder' : 'Manage relationships'}</Button>}>
    <p>{selfManaged ? 'This student currently manages their own account.' : `Primary account holder: ${account.holderName}`}</p>
    <Modal isOpen={open} onClose={() => setOpen(false)} ariaLabel="Manage relationships"><ModalHeader title={selfManaged ? 'Add account holder' : 'Manage relationships'} onClose={() => setOpen(false)} /><ModalBody>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
        {selfManaged ? <form onSubmit={event => { event.preventDefault(); const contact = selected === 'new' ? { id: `preview:contact:${crypto.randomUUID()}`, firstName, lastName, email, phone } : contacts.find(person => person.id === selected); if (!contact) { setError('Select an existing contact or create a new contact.'); return } apply({ kind: 'link-holder', accountId: account.id, studentId: student.id, contact, relationship }) }}>
          <FieldGrid><Input label="Search contacts" value={query} onChange={event => setQuery(event.target.value)} /><Select label="Account holder" required value={selected} onChange={event => setSelected(event.target.value)}><option value="">Select a contact</option>{contacts.filter(person => `${person.firstName} ${person.lastName} ${person.email}`.toLowerCase().includes(query.toLowerCase()) || person.id === selected).map(person => <option key={person.id} value={person.id}>{person.firstName} {person.lastName} · {person.email || 'No email'}</option>)}<option value="new">Create a new contact</option></Select>
          {selected === 'new' && <><Input label="First name" required value={firstName} onChange={event => setFirstName(event.target.value)} /><Input label="Last name" required value={lastName} onChange={event => setLastName(event.target.value)} /><Input label="Email" type="email" value={email} onChange={event => setEmail(event.target.value)} /><Input label="Phone" type="tel" value={phone} onChange={event => setPhone(event.target.value)} /></>}
          <Select label="Relationship" value={relationship} onChange={event => setRelationship(event.target.value)}>{['Parent / guardian', 'Other responsible adult'].map(value => <option key={value}>{value}</option>)}</Select></FieldGrid>
          <p>This person will become the primary account holder. Existing payer assignments, invoices, saved cards and recorded payments stay unchanged. This does not grant portal access or send an invitation.</p><p>The student’s existing self-service access must be reviewed separately before enabling this relationship in production.</p><Button type="submit">Confirm account holder</Button>
        </form> : <><p>Unlinking changes household membership, not student status. Subscriptions continue and outstanding debt follows the student. No payment or subscription cancellation is required.</p>{data.students.filter(person => account.studentIds.includes(person.id) && person.id !== account.holderId && (!student || person.id === student.id)).map(person => <DenseSectionPanel key={person.id} title={previewStudentName(person)} actions={<Button variant="secondary" onClick={() => apply({ kind: 'unlink-child', accountId: account.id, studentId: person.id, payerId: payerIds[person.id] || person.id })}>Confirm unlink child</Button>}>
          <p>Unlink {previewStudentName(person)} from {account.holderName}’s account? {person.firstName} will remain a standalone student record, with their subscriptions, outstanding balance, and history.</p>
          <Select label={`Future payer for ${person.firstName}`} value={payerIds[person.id] || person.id} onChange={event => setPayerIds(current => ({ ...current, [person.id]: event.target.value }))}>{previewContacts(data).filter(contact => contact.id !== account.holderId).map(contact => <option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}{contact.id === person.id ? ' (student pays)' : ''}</option>)}</Select>
        </DenseSectionPanel>)}</>}
        {error && <p role="alert">{error}</p>}
      </div>
    </ModalBody></Modal>
  </DenseSectionPanel>
}