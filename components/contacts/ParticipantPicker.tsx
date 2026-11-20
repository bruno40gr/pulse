'use client'

import { useId, useState } from 'react'
import { RadioOptionGroup } from '@/components/ui/RadioOptionGroup'
import { Input } from '@/components/ui/Input'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { ResponsiveDataTable } from '@/components/ui/DataGridTable'
import { PersonName } from '@/components/ui/PersonName'
import { Notice } from '@/components/ui/Notice'
import { Button } from '@/components/ui/Button'
import { spacing, colors, interaction } from '@/lib/tokens'

export type ParticipantOption = { id: string; name: string; detail?: string; group?: string; disabled?: boolean }
export type NewParticipant = { name: string; email: string }

/** Shared event/band contact selection. Persistence belongs to the caller. */
export function ParticipantPicker({ options, selectedIds, onSelectionChange, multiple = false, mode, onModeChange, draft, onDraftChange, onCreate, creating = false, disabled = false, state = 'ready', error, label = 'Participants' }: {
  options: ParticipantOption[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  multiple?: boolean
  mode: 'existing' | 'new'
  onModeChange: (mode: 'existing' | 'new') => void
  draft: NewParticipant
  onDraftChange: (draft: NewParticipant) => void
  onCreate?: () => void
  creating?: boolean
  disabled?: boolean
  state?: 'loading' | 'ready' | 'error'
  error?: string
  label?: string
}) {
  const [query, setQuery] = useState('')
  const name = useId()
  const matches = options.filter(person => `${person.name} ${person.detail || ''} ${person.group || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const toggle = (person: ParticipantOption) => {
    if (disabled || person.disabled) return
    onSelectionChange(multiple
      ? selectedIds.includes(person.id) ? selectedIds.filter(id => id !== person.id) : [...selectedIds, person.id]
      : selectedIds.includes(person.id) ? [] : [person.id])
  }
  return <div style={{ display: 'grid', gap: spacing.md, minWidth: 0 }}>
    <RadioOptionGroup label="Contact type" hideLabel layout="inline" value={mode}
      options={[{ id: 'existing', label: 'Existing contact' }, { id: 'new', label: 'New contact' }]}
      onChange={next => { if (!creating && !disabled) { setQuery(''); onModeChange(next as 'existing' | 'new') } }} />
    {mode === 'new' ? <div style={{ minHeight: 240, display: 'grid', alignContent: 'start', gap: spacing.md }}>
      <FieldGrid>
        <Input label="Participant name" required value={draft.name} disabled={creating || disabled} onChange={event => onDraftChange({ ...draft, name: event.target.value })} />
        <Input label="Contact email" type="email" value={draft.email} disabled={creating || disabled} onChange={event => onDraftChange({ ...draft, email: event.target.value })} />
      </FieldGrid>
      {onCreate && <div><Button variant="secondary" disabled={creating || disabled || !draft.name.trim()} onClick={onCreate}>{creating ? 'Adding…' : 'Add and select'}</Button></div>}
    </div> : <>
      <Input label="Search contacts" type="search" placeholder="Name or email" value={query} disabled={disabled} onChange={event => setQuery(event.target.value)} />
      <div role="region" aria-label={label} aria-busy={state === 'loading'} tabIndex={0}
        style={{ height: 'clamp(160px, 28dvh, 280px)', overflow: 'auto', overscrollBehavior: 'contain', minWidth: 0 }}>
        {state === 'loading' ? <p role="status">Loading contacts…</p>
          : state === 'error' ? <Notice variant="error">{error || 'Could not load contacts. Please try again.'}</Notice>
          : <ResponsiveDataTable rows={matches} getRowKey={person => person.id} ariaLabel={label} minDesktopWidth={320}
            emptyContent={query.trim() ? 'No contacts match your search.' : 'No contacts available to add.'}
            selection={multiple ? { selectedKeys: new Set(selectedIds), allSelected: matches.some(person => !person.disabled) && matches.filter(person => !person.disabled).every(person => selectedIds.includes(person.id)),
              onToggle: toggle,
              onToggleAll: () => {
                if (disabled) return
                const enabled = matches.filter(person => !person.disabled).map(person => person.id)
                onSelectionChange(enabled.every(id => selectedIds.includes(id)) ? selectedIds.filter(id => !enabled.includes(id)) : [...new Set([...selectedIds, ...enabled])])
              },
              selectAllLabel: 'Select all contacts', getRowLabel: person => person.name,
              isSelectable: person => !disabled && !person.disabled } : undefined}
            columns={[
              ...(!multiple ? [{ id: 'select', header: 'Select', width: '60px', render: (person: ParticipantOption) => <input type="radio" name={name} aria-label={person.name} checked={selectedIds.includes(person.id)} disabled={disabled || person.disabled} style={{ accentColor: interaction.selected }} onChange={() => toggle(person)} /> }] : []),
              { id: 'name', header: 'Contact', width: '1.4fr', render: person => <PersonName>{person.name}</PersonName> },
              { id: 'detail', header: 'Details', width: '1fr', render: person => <span style={{ color: colors.textSecondary }}>{person.disabled ? 'Already registered' : person.group || person.detail || '—'}</span> },
            ]} />}
      </div>
      <p role="status" style={{ margin: 0 }}>{selectedIds.length} selected</p>
    </>}
    {error && (state !== 'error' || mode === 'new') && <Notice variant="error">{error}</Notice>}
  </div>
}