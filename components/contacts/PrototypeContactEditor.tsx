'use client'

import { useState } from 'react'
import { Button, DenseSectionPanel, FieldGrid, Input, Select, SlidePanel, SlidePanelHeader } from '@/components/ui'
import { spacing, colors } from '@/lib/tokens'
import { PROFILE_PANEL_WIDTH } from '@/lib/conversation-display'
import { useIsMobile } from '@/lib/useMediaQuery'
import { applyPrototypeContactEdit, type PrototypePerson } from '@/lib/contact-prototype-editing'

export default function PrototypeContactEditor<T extends PrototypePerson>({ contact, people, onSave, onClose }: {
  contact: T; people: T[]; onSave: (people: T[]) => void; onClose: () => void
}) {
  const [first, setFirst] = useState(contact.first_name)
  const [last, setLast] = useState(contact.last_name)
  const [phone, setPhone] = useState(contact.phone || '')
  const [email, setEmail] = useState(contact.email || '')
  const [account, setAccount] = useState(contact.account_id || '')
  const [manager, setManager] = useState(contact.account_holder_person_id || '')
  const [holders, setHolders] = useState(() => (contact.account_holders || []).flatMap(holder => holder.person_id ? [{ person_id: holder.person_id, relationship: holder.relationship || '' }] : []))
  const [error, setError] = useState('')
  const mobile = useIsMobile()
  const local = people.filter(person => person.tenant_id === contact.tenant_id)
  const adults = local.filter(person => !person.is_minor && person.custom_fields.is_minor !== true)
  const familyIds = [...new Set(local.flatMap(person => person.account_id ? [person.account_id] : []))]
  const managers = adults.filter(person => person.account_id === account || person.id === contact.id)
  const name = (person: PrototypePerson) => `${person.first_name} ${person.last_name}`.trim()
  const changeFamily = (value: string) => {
    setAccount(value)
    const members = local.filter(person => person.account_id === value)
    const next = value === `prototype:family:${contact.id}` ? contact.id : members[0]?.account_holder_person_id || ''
    setManager(next)
    setHolders(next ? [{ person_id: next, relationship: '' }] : [])
    setError('')
  }
  const save = () => {
    try {
      onSave(applyPrototypeContactEdit(people, contact.id, { first_name: first, last_name: last, phone, email,
        account_id: account || null, manager_id: account ? manager : null, holders: account ? holders : [] }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save preview changes.') }
  }
  return <SlidePanel isOpen onClose={onClose} width={PROFILE_PANEL_WIDTH} fullScreen={mobile}>
    <SlidePanelHeader title="Edit contact prototype" onClose={onClose} actions={<Button onClick={save}>Save preview</Button>} />
    <div style={{ overflowY: 'auto', minWidth: 0, padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
      <p style={{ margin: 0, color: colors.textSecondary }}>Fictional data only. Changes last until reload or reset. No real records, consent or messaging permissions are changed.</p>
      {error && <p role="alert">{error}</p>}
      <DenseSectionPanel title="Contact details">
        <FieldGrid>
          <Input label="First name" value={first} onChange={event => setFirst(event.target.value)} />
          <Input label="Last name" value={last} onChange={event => setLast(event.target.value)} />
          <Input label="Phone" type="tel" value={phone} onChange={event => setPhone(event.target.value)} />
          <Input label="Email" type="email" value={email} onChange={event => setEmail(event.target.value)} />
        </FieldGrid>
      </DenseSectionPanel>
      <DenseSectionPanel title="Family nesting">
        <FieldGrid>
          <Select label="Family" value={account} onChange={event => changeFamily(event.target.value)}>
            <option value="">Standalone contact — no family</option>
            {familyIds.map(id => {
              const member = local.find(person => person.account_id === id)!
              return <option key={id} value={id}>{member.account_holder_name || member.family_name || 'Unresolved family'} ({local.filter(person => person.account_id === id).length} people)</option>
            })}
            {!familyIds.includes(`prototype:family:${contact.id}`) && adults.some(person => person.id === contact.id) && <option value={`prototype:family:${contact.id}`}>Start a new family with this contact</option>}
          </Select>
          {account && <Select label="Account manager" value={manager} onChange={event => {
            const id = event.target.value; setManager(id)
            if (id && !holders.some(holder => holder.person_id === id)) setHolders([...holders, { person_id: id, relationship: '' }])
          }}>
            <option value="">Choose an account manager</option>
            {managers.map(person => <option key={person.id} value={person.id}>{name(person)}</option>)}
          </Select>}
        </FieldGrid>
        <p style={{ color: colors.textSecondary }}>Moving this person does not move their siblings. Changing the destination family’s account manager updates that family’s heading. A manager moved out leaves the old family unresolved for you to correct.</p>
      </DenseSectionPanel>
      {account && <DenseSectionPanel title="Holders for this contact" actions={<Button variant="secondary" size="toolbar" disabled={adults.every(person => holders.some(holder => holder.person_id === person.id))} onClick={() => {
        const candidate = adults.find(person => !holders.some(holder => holder.person_id === person.id))
        if (candidate) setHolders([...holders, { person_id: candidate.id, relationship: '' }])
      }}>Add holder</Button>}>
        <p style={{ color: colors.textSecondary }}>Relationship describes the holder relative to this contact. Selecting a holder does not establish guardianship or permission to send.</p>
        {holders.map((holder, index) => <DenseSectionPanel key={index} title={`Holder ${index + 1}${holder.person_id === manager ? ' · Account manager' : ''}`} actions={<Button variant="secondary" size="toolbar" disabled={holder.person_id === manager} onClick={() => setHolders(holders.filter((_, position) => position !== index))}>Remove holder {index + 1}</Button>}>
          <FieldGrid>
            <Select label={`Holder ${index + 1}`} value={holder.person_id} disabled={holder.person_id === manager} onChange={event => setHolders(holders.map((row, position) => position === index ? { ...row, person_id: event.target.value } : row))}>
              {adults.filter(person => person.id === holder.person_id || !holders.some(row => row.person_id === person.id)).map(person => <option key={person.id} value={person.id}>{name(person)}</option>)}
            </Select>
            <Input label={`Relationship for holder ${index + 1}`} placeholder="e.g. sibling, parent, self" value={holder.relationship} onChange={event => setHolders(holders.map((row, position) => position === index ? { ...row, relationship: event.target.value } : row))} />
          </FieldGrid>
        </DenseSectionPanel>)}
      </DenseSectionPanel>}
      <Button variant="secondary" onClick={onClose}>Cancel editing</Button>
    </div>
  </SlidePanel>
}