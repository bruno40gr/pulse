'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { LeadTableControls } from '@/components/leads/LeadTableControls'
import { defaultLeadTablePreferences, type LeadTablePreferences } from '@/lib/lead-table-preferences'
import { spacing } from '@/lib/tokens'

export function LeadToolbarShowcase() {
  const [preferences, setPreferences] = useState<LeadTablePreferences>(defaultLeadTablePreferences)
  const [actionFirst, setActionFirst] = useState(false)
  const [status, setStatus] = useState('all')
  return <section style={{ marginBottom: spacing['2xl'] }}>
    <SectionLabel>Table toolbar</SectionLabel>
    <p>Secondary toolbar buttons and toolbar selects share typography, border, radius, and a 42px minimum height. The columns trigger uses Button, not a custom disclosure.</p>
    <div role="group" aria-label="Table toolbar example" style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button variant="secondary" size="toolbar" aria-pressed={actionFirst} onClick={() => setActionFirst(value => !value)}>Action first{actionFirst ? ' ✓' : ''}</Button>
      <Button variant="secondary" size="toolbar" disabled>Export CSV</Button>
      <Select controlSize="toolbar" aria-label="Example status filter" fullWidth={false} value={status} onChange={event => setStatus(event.target.value)}>
        <option value="all">Status: All</option>
        <option value="new">Status: New</option>
      </Select>
      <LeadTableControls columns={[{ id: 'name', label: 'Name' }, { id: 'email', label: 'Email' }, { id: 'source', label: 'Source / form' }]} preferences={preferences} onChange={setPreferences} />
    </div>
  </section>
}