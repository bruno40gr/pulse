'use client'

import { useState } from 'react'
import { Button, Input } from '@/components/ui'
import { ControlButton } from '@/components/ui/ControlButton'
import { colors, radius, spacing, typography } from '@/lib/tokens'
import { emailRecipientIds, type MockEmailRecipients, type MockRecipient } from '@/lib/prototype-messaging'

export function PrototypeRecipientSearch({ label, people, selected, excluded = [], channel, onChange }: {
  label: string; people: MockRecipient[]; selected: string[]; excluded?: string[]; channel: 'sms' | 'email'; onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const matches = people.filter(person => !selected.includes(person.id) && !excluded.includes(person.id) && `${person.name} ${person.student} ${person.email} ${person.phone}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <div style={{ display: 'grid', gap: spacing.sm, minWidth: 0 }}>
    <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
      {selected.map(id => { const person = people.find(item => item.id === id); return person ? <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.sm, padding: `${spacing.xs} ${spacing.sm}`, borderRadius: radius.md, background: colors.surfaceMuted, fontSize: typography.sizeSm }}>
        {person.name}<ControlButton kind="icon" aria-label={`Remove ${person.name} from ${label}`} onClick={() => onChange(selected.filter(item => item !== id))}>×</ControlButton>
      </span> : null })}
    </div>
    <Input aria-label={`Search ${label}`} placeholder={`Search ${label.toLowerCase()} by name, student, ${channel === 'sms' ? 'phone' : 'email'}…`} value={query} onFocus={() => setSearchOpen(true)} onChange={event => { setQuery(event.target.value); setSearchOpen(true) }} />
    {searchOpen && <div role="group" aria-label={`${label} search results`} style={{ maxHeight: 220, overflowY: 'auto', border: `1px solid ${colors.border}`, borderRadius: radius.md }}>
      {!matches.length && <p style={{ ...typography.bodySmall, padding: spacing.md }}>No matching contacts available.</p>}
      {matches.map(person => <ControlButton kind="row" key={person.id} aria-label={`Add ${person.name} to ${label}`} disabled={!(channel === 'sms' ? person.phone : person.email)} onClick={() => { onChange([...selected, person.id]); setQuery(''); setSearchOpen(false) }} style={{ display: 'block', padding: spacing.md, borderRadius: 0 }}>
        <strong>{person.name}</strong><span style={{ display: 'block', ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs }}>{person.student} · {channel === 'sms' ? person.phone || 'No phone available' : person.email || 'No email available'}</span>
      </ControlButton>)}
      <ControlButton kind="link" onClick={() => setSearchOpen(false)} style={{ margin: spacing.md }}>Hide results</ControlButton>
    </div>}
  </div>
}

export function PrototypeEmailRecipients({ people, recipients, onChange }: { people: MockRecipient[]; recipients: MockEmailRecipients; onChange: (next: MockEmailRecipients) => void }) {
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const fields = ['to', ...(showCc || recipients.cc.length ? ['cc'] : []), ...(showBcc || recipients.bcc.length ? ['bcc'] : [])] as Array<keyof MockEmailRecipients>
  return <section aria-label="Email recipients" style={{ display: 'grid', gap: spacing.lg }}>
    {fields.map(field => <div key={field}><div style={{ ...typography.label, marginBottom: spacing.sm }}>{field === 'to' ? 'To' : field === 'cc' ? 'Cc' : 'Bcc'}</div><PrototypeRecipientSearch label={field === 'to' ? 'To' : field === 'cc' ? 'Cc' : 'Bcc'} channel="email" people={people} selected={recipients[field]} excluded={emailRecipientIds({ ...recipients, [field]: [] })} onChange={ids => onChange({ ...recipients, [field]: ids })} /></div>)}
    <div style={{ display: 'flex', gap: spacing.md }}>{!showCc && !recipients.cc.length && <Button variant="ghost" size="sm" onClick={() => setShowCc(true)}>Add Cc</Button>}{!showBcc && !recipients.bcc.length && <Button variant="ghost" size="sm" onClick={() => setShowBcc(true)}>Add Bcc</Button>}</div>
  </section>
}
