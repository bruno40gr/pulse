'use client'

import { useEffect, useId, useState } from 'react'
import { Button, DenseSectionPanel, FieldGrid, Input } from '@/beta-source/components/ui'
import { previewContacts, type FamilyAction, type FamilyPreviewData, type PreviewAccount } from '@/beta-source/lib/academy-family-preview'
import { spacing } from '@/beta-source/lib/tokens'
import { AccountWorkspace } from './AccountWorkspace'
import { ParentFamilyGroup } from './ParentFamilyGroup'

export type AccountEditorContact = { id: string; firstName: string; lastName: string; email: string; phone: string; birthday?: string; accountRecord?: boolean }

export function AccountEditor({ data, account, contactId, onApply, onBack }: { data: FamilyPreviewData; account: PreviewAccount; contactId?: string; onApply: (action: FamilyAction) => string | null; onBack: () => void }) {
  const contacts = previewContacts(data).filter(contact => contactId ? contact.id === contactId && account.studentIds.includes(contact.id) : contact.id === account.holderId || account.studentIds.includes(contact.id)).sort((a, b) => Number(b.id === account.holderId) - Number(a.id === account.holderId))
  return <AccountEditorCanvas contacts={contacts} holderId={account.holderId} accountName={contactId ? `${contacts[0]?.firstName || ''} ${contacts[0]?.lastName || ''}`.trim() : account.holderName}
    studentOnly={!!contactId} onBack={onBack} onSave={rows => onApply({ kind: 'contact-batch', accountId: account.id, contacts: rows.map(row => ({ ...contacts.find(contact => contact.id === row.id)!, ...row })) })}
    family={!contactId && <ParentFamilyGroup embedded canvas="manage" account={account} students={data.students.filter(student => account.studentIds.includes(student.id) && student.id !== account.holderId)} onApply={onApply} />} />
}

/** Beta and live Contacts use the same editor; callers own persistence. */
export function AccountEditorCanvas({ contacts, holderId, accountName, studentOnly, family, onSave, onBack, embedded = false, formId: providedFormId, onDirtyChange }: {
  contacts: AccountEditorContact[]; holderId?: string; accountName: string; studentOnly?: boolean; family?: React.ReactNode
  onSave: (contacts: AccountEditorContact[], saved: (id: string) => void) => string | null | Promise<string | null>; onBack: () => void
  embedded?: boolean; formId?: string
  onDirtyChange?: (dirty: boolean) => void
}) {
  const generatedFormId = useId()
  const formId = providedFormId || generatedFormId
  const [saving, setSaving] = useState(false)
  const [drafts, setDrafts] = useState(() => Object.fromEntries(contacts.map(contact => [contact.id, { ...contact }])))
  const [error, setError] = useState('')
  const dirty = contacts.some(contact => {
    const draft = drafts[contact.id]
    return draft && (['firstName', 'lastName', 'email', 'phone', 'birthday'] as const)
      .filter(field => !contact.accountRecord || field !== 'lastName' && field !== 'birthday')
      .some(field => (draft[field] || '').trim() !== (contact[field] || '').trim())
  })
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  const content = <>
    <form id={formId} noValidate style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }} onSubmit={async event => {
      event.preventDefault()
      if (saving) return
      setSaving(true)
      setError('')
      try {
        const message = await onSave(Object.values(drafts), id => setDrafts(current => { const next = { ...current }; delete next[id]; return next }))
        if (message) setError(message)
        else onBack()
      } catch (error) { setError(error instanceof Error ? error.message : 'Could not save contact details.') }
      finally { setSaving(false) }
    }}>
      {contacts.map(contact => {
        const draft = drafts[contact.id] || contact
        return <section key={contact.id} aria-label={`${contact.firstName} ${contact.lastName} contact fields`}><DenseSectionPanel title={`${contact.firstName} ${contact.lastName}${contact.id === holderId ? ' · Account holder' : ''}`}>
          <FieldGrid>{(['firstName', 'lastName', 'email', 'phone', 'birthday'] as const).filter(field => !contact.accountRecord || field !== 'lastName' && field !== 'birthday').map(field => <Input key={field} disabled={saving} label={contact.accountRecord && field === 'firstName' ? 'Name' : { firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone', birthday: 'Birthday' }[field]} required={field === 'firstName' || field === 'lastName'} type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : field === 'birthday' ? 'date' : 'text'} value={draft[field] || ''} onChange={event => setDrafts(current => ({ ...current, [contact.id]: { ...draft, [field]: event.target.value } }))} />)}</FieldGrid>
        </DenseSectionPanel></section>
      })}
      {error && <p role="alert">{error}</p>}
    </form>
    {family && <section aria-label="Manage Family Group" style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg, marginTop: spacing.xl }}>{family}</section>}
  </>
  return embedded ? content : <AccountWorkspace title="Edit Contact" accountName={accountName} profileSubtitle={studentOnly ? 'Student profile' : 'Account manager'} onBack={onBack} actions={<><Button variant="secondary" disabled={saving} onClick={onBack}>Cancel</Button><Button type="submit" form={formId} disabled={saving}>Save changes</Button></>}>{content}</AccountWorkspace>
}