'use client'

import { useState } from 'react'
import { ParticipantPicker, type ParticipantOption } from '@/components/contacts/ParticipantPicker'
import { getActiveTenantId } from '@/lib/tenant'

/** Production adapter; events reuse the picker without inheriting this API. */
export function BandStudentPicker({ options, selectedIds, onSelectionChange, onCreated, state, error, disabled, onBusyChange }: {
  options: ParticipantOption[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  onCreated: (person: ParticipantOption) => void
  state: 'loading' | 'ready' | 'error'
  error?: string
  disabled?: boolean
  onBusyChange?: (busy: boolean) => void
}) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [draft, setDraft] = useState({ name: '', email: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const create = async () => {
    setCreating(true); onBusyChange?.(true); setCreateError('')
    try {
      const [first_name, ...rest] = draft.name.trim().split(/\s+/)
      const response = await fetch('/api/contacts/person', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: getActiveTenantId(), first_name, last_name: rest.join(' '), email: draft.email }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.person?.id) throw new Error(data?.error || 'Could not add that student.')
      onCreated({ id: data.person.id, name: data.person.name, detail: draft.email })
      setDraft({ name: '', email: '' }); setMode('existing')
    } catch (cause) { setCreateError(cause instanceof Error ? cause.message : 'Could not add that student.') }
    finally { setCreating(false); onBusyChange?.(false) }
  }
  return <ParticipantPicker options={options} selectedIds={selectedIds} onSelectionChange={onSelectionChange} multiple
    mode={mode} onModeChange={next => { setMode(next); setCreateError('') }} draft={draft} onDraftChange={setDraft}
    onCreate={() => void create()} creating={creating} disabled={disabled} state={state} error={createError || error} label="Band candidates" />
}