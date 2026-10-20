'use client'

import { useState, type ReactNode } from 'react'
import { RecipientPicker } from '@/components/ui/RecipientPicker'
import { colors, spacing, typography } from '@/lib/tokens'
import { emailRecipientIds, type MockEmailRecipients, type MockRecipient } from '@/lib/prototype-messaging'

export function PrototypeRecipientSearch({ label, people, selected, excluded = [], channel, onChange, fill = false, controls }: {
  label: string; people: MockRecipient[]; selected: string[]; excluded?: string[]; channel: 'sms' | 'email'; onChange: (ids: string[]) => void; fill?: boolean; controls?: ReactNode
}) {
  const [query, setQuery] = useState('')
  const option = (person: MockRecipient) => ({ id: person.id, name: person.name, detail: channel === 'sms' ? person.phone || 'No phone number' : person.email || 'No email address', disabled: !(channel === 'sms' ? person.phone : person.email) })
  const matches = people.filter(person => !excluded.includes(person.id) && `${person.name} ${person.student} ${person.email} ${person.phone}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <RecipientPicker label={label} people={matches.map(option)} selected={people.filter(person => selected.includes(person.id)).map(option)} query={query} onQueryChange={setQuery} onChange={onChange} fill={fill} controls={controls} detailLabel={channel === 'sms' ? 'Phone' : 'Email'} />
}

export function PrototypeEmailRecipients({ people, recipients, onChange, fill = false }: { people: MockRecipient[]; recipients: MockEmailRecipients; onChange: (next: MockEmailRecipients) => void; fill?: boolean }) {
  const [field, setField] = useState<keyof MockEmailRecipients>(recipients.cc.length ? 'cc' : recipients.bcc.length ? 'bcc' : 'to')
  const label = field === 'to' ? 'To' : field === 'cc' ? 'Cc' : 'Bcc'
  return <section aria-label="Email recipients" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, flex: fill ? 1 : undefined }}>
    <PrototypeRecipientSearch key={field} label={label} channel="email" people={people} selected={recipients[field]} excluded={emailRecipientIds({ ...recipients, [field]: [] })} onChange={ids => onChange({ ...recipients, [field]: ids })} fill={fill} controls={<div role="radiogroup" aria-label="Send as" style={{ display: 'flex', alignItems: 'center', gap: spacing.md, color: colors.text }}>
      <span style={typography.label}>Send as:</span>
      {(['cc', 'bcc'] as const).map(value => <label key={value} style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, cursor: 'pointer' }}><input type="radio" name="email-recipient-field" checked={field === value} onChange={() => setField(value)} />{value === 'cc' ? 'Cc' : 'Bcc'}</label>)}
      {field !== 'to' && <button type="button" onClick={() => setField('to')} style={{ border: 0, background: 'transparent', color: colors.link, cursor: 'pointer', textDecoration: 'none' }}>Edit To recipients</button>}
    </div>} />
  </section>
}
