'use client'

import { Button } from '@/components/ui'
import { RecipientPicker } from '@/components/ui/RecipientPicker'
import { spacing } from '@/lib/tokens'

export interface SmsRecipient {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
}

export default function SmsRecipientPicker({ query, results, selected, searching = false, handleSearch, toggleStaff, toggleRecipient }: {
  query: string; results: SmsRecipient[]; selected: SmsRecipient[]; searching?: boolean; staffOnly?: boolean
  handleSearch: (query: string) => void; toggleStaff?: (staff: boolean) => void
  toggleRecipient: (recipient: SmsRecipient) => void
}) {
  const option = (person: SmsRecipient) => ({ id: person.id, name: `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unnamed', detail: person.phone || 'No phone number' })
  return <>
    {toggleStaff && <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.sm }}>{[{ staff: false, label: 'Everyone' }, { staff: true, label: 'Staff only' }].map(item => <Button key={item.label} variant="secondary" size="sm" onClick={() => toggleStaff(item.staff)}>{item.label}</Button>)}</div>}
    <RecipientPicker detailLabel="Phone" label="SMS recipients" people={results.map(option)} selected={selected.map(option)} query={query} onQueryChange={handleSearch} loading={searching} fill onChange={ids => {
      const current = new Set(selected.map(person => person.id))
      const next = new Set(ids)
      const people = new Map([...selected, ...results].map(person => [person.id, person]))
      for (const [id, person] of people) if (current.has(id) !== next.has(id)) toggleRecipient(person)
    }} />
  </>
}
