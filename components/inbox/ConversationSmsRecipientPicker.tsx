'use client'

import { useState } from 'react'
import { RecipientPicker } from '@/components/ui/RecipientPicker'
import { TablePersonViewToggle, type TablePersonView } from '@/components/ui/TablePersonViewToggle'
import { smsPickerGroups, smsPickerMatches, uniqueSmsPickerSelection } from '@/lib/conversation-sms-picker'
import type { MockRecipient } from '@/lib/prototype-messaging'
import { smsDestination } from '@/lib/communication-recipients'
import { formatPhoneNumber } from '@/lib/phone'

/** Contacts identities stay intact; only the recipient presentation is grouped. */
export default function ConversationSmsRecipientPicker({ people, selected, onChange, query, onQueryChange }: {
  people: MockRecipient[]; selected: string[]; onChange: (ids: string[]) => void
  query: string; onQueryChange: (query: string) => void
}) {
  const [view, setView] = useState<TablePersonView>('family')
  const groups = smsPickerGroups(people)
  const selectedIds = uniqueSmsPickerSelection(people, selected)
  const familyOption = (group: typeof groups[number]) => ({
    id: group.id, name: group.name, detail: formatPhoneNumber(group.phone) || 'No phone number', disabled: !smsDestination(group.phone),
    children: group.members.filter(person => person.student).map(person => ({ id: person.id, name: person.student })),
  })
  const studentOption = (person: MockRecipient) => ({ id: person.id, name: person.student || person.name, detail: formatPhoneNumber(person.phone) || 'No phone number', disabled: !smsDestination(person.phone) })
  const options = view === 'family'
    ? groups.filter(group => group.members.some(person => smsPickerMatches(person, query))).map(familyOption)
    : people.filter(person => smsPickerMatches(person, query)).map(studentOption)
  const selectedOptions = groups.filter(group => group.members.some(person => selectedIds.includes(person.id))).map(familyOption)
  const groupFor = (id: string) => groups.find(group => group.members.some(person => person.id === id))
  return <RecipientPicker label="SMS recipients" detailLabel="Phone" fill compactColumns inlineControls groupedRows query={query} onQueryChange={onQueryChange}
    controls={<TablePersonViewToggle variant="segmented" ariaLabel="Recipient view" value={view} onChange={setView} />}
    people={options} selected={selectedOptions} selectionKey={person => groupFor(person.id)?.id || person.id}
    onTogglePerson={option => {
      const group = groupFor(option.id)
      if (!group) return
      const chosen = group.members.find(person => selectedIds.includes(person.id))
      onChange(chosen ? selectedIds.filter(id => id !== chosen.id) : [...selectedIds,
        view === 'none' ? option.id : group.members.find(person => smsPickerMatches(person, query))?.id || group.id])
    }} onChange={ids => {
      onChange(groups.filter(group => ids.includes(group.id)).map(group => group.members.find(person => selectedIds.includes(person.id))?.id
        || group.members.find(person => smsPickerMatches(person, query))?.id || group.id))
    }} />
}