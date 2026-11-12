'use client'

import { useId, useState, type ReactNode } from 'react'
import { Button, DenseSectionPanel, DetailField, FieldGrid, Input } from '@/beta-source/components/ui'
import { spacing } from '@/beta-source/lib/tokens'
import { MetadataRow } from './MetadataRow'
import { birthdayAge } from '@/beta-source/lib/lead-birthday'
import type { FamilyAction, PreviewContact } from '@/beta-source/lib/academy-family-preview'

export function ContactEditor({ contact, accountId, onApply, dependentCount, title = 'Contact details', actions, hideName = false, compact = false, horizontal = false, readOnly = false, children }: { contact: PreviewContact; accountId: string; onApply: (action: FamilyAction) => string | null; dependentCount?: number; title?: string; actions?: ReactNode; hideName?: boolean; compact?: boolean; horizontal?: boolean; readOnly?: boolean; children?: ReactNode }) {
  const id = useId()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(contact)
  const [error, setError] = useState('')
  const formId = `${id}-contact`
  const age = contact.birthday ? birthdayAge(contact.birthday) : null
  return <DenseSectionPanel contentStyle={compact ? { display: 'flex', flexDirection: 'column', gap: spacing.xl } : undefined} title={title} actions={readOnly ? actions : editing ? <div key="editing" style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}><Button variant="secondary" onClick={() => { setEditing(false); setError('') }}>Cancel</Button><Button type="submit" form={formId}>Save</Button></div> : <div key="viewing" style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>{actions}<Button variant="ghost" onClick={() => { setDraft(contact); setEditing(true) }}>Edit contact</Button></div>}>
    {dependentCount !== undefined && <DetailField label="Dependents" value={String(dependentCount)} />}
    {editing ? <form id={formId} onSubmit={event => { event.preventDefault(); const message = onApply({ kind: 'contact-details', accountId, contact: draft }); setError(message || ''); if (!message) setEditing(false) }}><FieldGrid>{(['firstName', 'lastName', 'email', 'phone', 'birthday'] as const).map(field => { const label = { firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone', birthday: 'Birthday' }[field]; return <Input key={field} label={label} required={field === 'firstName' || field === 'lastName'} type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : field === 'birthday' ? 'date' : 'text'} value={draft[field] || ''} onChange={event => setDraft(current => ({ ...current, [field]: event.target.value }))} /> })}</FieldGrid>{error && <p role="alert">{error}</p>}</form> : compact ? (contact.email?.trim() || contact.phone?.trim() || age !== null) ? <MetadataRow label={`${title} contact summary`}>{contact.email?.trim() && <span>{contact.email}</span>}{contact.phone?.trim() && <span>{contact.phone}</span>}{age !== null && <span>{age}yo</span>}</MetadataRow> : null : horizontal ? <MetadataRow label={`${title} metadata`}>{!hideName && <DetailField label="Name" value={`${contact.firstName} ${contact.lastName}`} />}<DetailField label="Email" value={contact.email || 'Not added'} /><DetailField label="Phone" value={contact.phone || 'Not added'} /><DetailField label="Birthday" value={contact.birthday || 'Not added'} /></MetadataRow> : <FieldGrid>{!hideName && <DetailField label="Name" value={`${contact.firstName} ${contact.lastName}`} />}<DetailField label="Email" value={contact.email || 'Not added'} /><DetailField label="Phone" value={contact.phone || 'Not added'} /><DetailField label="Birthday" value={contact.birthday || 'Not added'} /></FieldGrid>}
    {children}
  </DenseSectionPanel>
}