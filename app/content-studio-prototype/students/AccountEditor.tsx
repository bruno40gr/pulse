'use client'

import { useId, useState } from 'react'
import { Button, DenseSectionPanel, FieldGrid, Input } from '@/components/ui'
import { previewContacts, type FamilyAction, type FamilyPreviewData, type PreviewAccount } from '@/lib/academy-family-preview'
import { spacing } from '@/lib/tokens'
import { AccountWorkspace } from './AccountWorkspace'
import { ParentFamilyGroup } from './ParentFamilyGroup'

/** Staff-only V3 workspace. Contact drafts are separate from explicit membership actions. */
export function AccountEditor({ data, account, contactId, onApply, onBack }: { data: FamilyPreviewData; account: PreviewAccount; contactId?: string; onApply: (action: FamilyAction) => string | null; onBack: () => void }) {
  const formId = useId()
  const contacts = previewContacts(data).filter(contact => contactId ? contact.id === contactId && account.studentIds.includes(contact.id) : contact.id === account.holderId || account.studentIds.includes(contact.id)).sort((a, b) => Number(b.id === account.holderId) - Number(a.id === account.holderId))
  const [drafts, setDrafts] = useState(() => Object.fromEntries(contacts.map(contact => [contact.id, { ...contact }])))
  const [error, setError] = useState('')
  return <AccountWorkspace title="Edit Contact" accountName={contactId ? `${contacts[0]?.firstName || ''} ${contacts[0]?.lastName || ''}`.trim() : account.holderName} profileSubtitle={contactId ? 'Student profile' : 'Account manager'} onBack={onBack} actions={<><Button variant="secondary" onClick={onBack}>Cancel</Button><Button type="submit" form={formId}>Save changes</Button></>}>
    <form id={formId} style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }} onSubmit={event => {
      event.preventDefault()
      const message = onApply({ kind: 'contact-batch', accountId: account.id, contacts: contacts.map(contact => drafts[contact.id] || contact) })
      setError(message || '')
      if (!message) onBack()
    }}>
      {contacts.map(contact => {
        const draft = drafts[contact.id] || contact
        return <section key={contact.id} aria-label={`${contact.firstName} ${contact.lastName} contact fields`}><DenseSectionPanel title={`${contact.firstName} ${contact.lastName}${contact.id === account.holderId ? ' · Account holder' : ''}`}>
          <FieldGrid>{(['firstName', 'lastName', 'email', 'phone', 'birthday'] as const).map(field => <Input key={field} label={{ firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone', birthday: 'Birthday' }[field]} required={field === 'firstName' || field === 'lastName'} type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : field === 'birthday' ? 'date' : 'text'} value={draft[field] || ''} onChange={event => setDrafts(current => ({ ...current, [contact.id]: { ...draft, [field]: event.target.value } }))} />)}</FieldGrid>
        </DenseSectionPanel></section>
      })}
      {error && <p role="alert">{error}</p>}
    </form>
    {!contactId && <section aria-label="Manage Family Group" style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
      <ParentFamilyGroup embedded canvas="manage" account={account} students={data.students.filter(student => account.studentIds.includes(student.id) && student.id !== account.holderId)} onApply={onApply} />
    </section>}
  </AccountWorkspace>
}