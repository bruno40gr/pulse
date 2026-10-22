'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageContainer } from '@/components/ui/PageContainer'
import { colors, spacing } from '@/lib/tokens'
import { getActiveTenantId } from '@/lib/tenant'
import { rsvpCsv, type RsvpWorkspace } from '@/lib/event-rsvps'

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

  return <PageContainer maxWidth="1100px">
    <PageHeader title="Grand Opening RSVPs" subtitle="Guest list only — these RSVPs do not create leads or contacts." right={<div style={{ display: 'flex', gap: spacing.sm }}>
      <Button variant="secondary" disabled={busy} onClick={() => void load()}>Refresh</Button>
      <Button disabled={!workspace || busy} onClick={exportCsv}>Export CSV</Button>
    </div>} />
    {error && <p role="alert" style={{ color: colors.error }}>{error}</p>}
    {busy && <p role="status">Loading RSVPs…</p>}
    {workspace && <>
      <section aria-label="RSVP totals" style={{ display: 'flex', gap: spacing['3xl'], flexWrap: 'wrap', marginBottom: spacing['3xl'] }}>
        <div><strong style={{ fontSize: '2rem' }}>{workspace.parties}</strong><div>RSVP parties</div></div>
        <div><strong style={{ fontSize: '2rem' }}>{workspace.guests}</strong><div>Total guests</div></div>
      </section>
      <p style={{ color: colors.textSecondary }}>Party size includes the person submitting. Totals cover the entire guest list.</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <caption style={{ textAlign: 'left', paddingBottom: spacing.md }}>Grand Opening guest list</caption>
          <thead><tr>{['Name', 'Email', 'Party size', 'Submitted'].map(label => <th key={label} scope="col" style={{ padding: spacing.md, borderBottom: `1px solid ${colors.border}` }}>{label}</th>)}</tr></thead>
          <tbody>{workspace.rows.map(row => <tr key={row.id}>
            {[row.name, row.email, row.party_size, new Date(row.created_at).toLocaleString()].map((value, index) => <td key={index} style={{ padding: spacing.md, borderBottom: `1px solid ${colors.border}`, overflowWrap: 'anywhere' }}>{value}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {!workspace.rows.length && <p>No RSVPs yet.</p>}
    </>}
  </PageContainer>
}