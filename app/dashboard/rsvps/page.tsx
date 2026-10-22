'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, EmptyState, FieldLabel, FieldValue, Notice, PageContainer, PageHeader, ResponsiveDataTable, SurfacePanel, type DataTableColumn } from '@/components/ui'
import { colors, spacing, typography } from '@/lib/tokens'
import { getActiveTenantId } from '@/lib/tenant'
import { rsvpCsv, type EventRsvp, type RsvpWorkspace } from '@/lib/event-rsvps'

const columns: DataTableColumn<EventRsvp, string>[] = [
  { id: 'name', header: 'Name', width: 'minmax(0, 1fr)', render: row => row.name },
  { id: 'email', header: 'Email', width: 'minmax(0, 1.5fr)', render: row => row.email },
  { id: 'party_size', header: 'Party size', width: 'minmax(0, .5fr)', align: 'right', render: row => row.party_size },
  { id: 'created_at', header: 'Submitted', width: 'minmax(0, 1fr)', render: row => new Date(row.created_at).toLocaleString() },
]

export default function RsvpsPage() {
  const [workspace, setWorkspace] = useState<RsvpWorkspace | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/event-rsvps?tenant=${encodeURIComponent(getActiveTenantId())}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load RSVPs.')
      setWorkspace(data)
    } catch (issue) {
      setWorkspace(null)
      setError(issue instanceof Error ? issue.message : 'Could not load RSVPs.')
    } finally { setBusy(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  function exportCsv() {
    if (!workspace) return
    const url = URL.createObjectURL(new Blob(['\uFEFF', rsvpCsv(workspace.rows)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'grand-opening-rsvps.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <PageContainer>
    <PageHeader title="Grand Opening RSVPs" subtitle="Guest list only — these RSVPs do not create leads or contacts." right={<div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
      <Button variant="secondary" disabled={busy} onClick={() => void load()}>Refresh</Button>
      <Button disabled={!workspace || busy} onClick={exportCsv}>Export CSV</Button>
    </div>} />
    {error && <Notice variant="error" title="Could not load RSVPs" style={{ marginBottom: spacing.xl }}>{error}</Notice>}
    {workspace && <>
      <section aria-label="RSVP totals" style={{ display: 'flex', gap: spacing.xl, flexWrap: 'wrap', marginBottom: spacing.xl }}>
        <SurfacePanel style={{ flex: 1, minWidth: 0 }}>
          <FieldLabel>RSVP parties</FieldLabel>
          <FieldValue style={typography.h1}>{workspace.parties.toLocaleString()}</FieldValue>
        </SurfacePanel>
        <SurfacePanel style={{ flex: 1, minWidth: 0 }}>
          <FieldLabel>Total guests</FieldLabel>
          <FieldValue style={typography.h1}>{workspace.guests.toLocaleString()}</FieldValue>
        </SurfacePanel>
      </section>
      <p style={{ ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.xl }}>Party size includes the person submitting. Totals cover the entire guest list.</p>
    </>}
    <div aria-busy={busy} aria-label="Grand Opening guest list">
      <ResponsiveDataTable
        rows={workspace?.rows ?? []}
        columns={columns}
        getRowKey={row => row.id}
        loading={busy}
        ariaLabel="Grand Opening guest list"
        emptyContent={<EmptyState title={error ? 'Guest list unavailable' : 'No RSVPs yet'} description={error ? 'Refresh to try loading the guest list again.' : 'New submissions will appear here when guests RSVP.'} />}
      />
    </div>
  </PageContainer>
}