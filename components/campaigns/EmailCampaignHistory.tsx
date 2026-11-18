'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Badge, Button, Input, Notice, Select } from '@/components/ui'
import { TablePagination } from '@/components/ui/TablePagination'
import { EMAIL_RECIPIENT_PAGE_SIZE, EMAIL_RECIPIENT_STATUSES } from '@/lib/bulk-email-history'
import { colors, spacing } from '@/lib/tokens'

type Campaign = {
  id: string; subject: string | null; sender: string | null; updatedAt: string
  accepted: number; failed: number; unattempted: number; uncertain: number; excluded: number
  diagnostic: { httpStatus: number | null; reason: string | null; category: string | null } | null
}
type Status = typeof EMAIL_RECIPIENT_STATUSES[number]
type Receipt = { destination: string; status: Status; created_at: string }
const labels: Record<Status, string> = { sent: 'Accepted by Gmail', failed: 'Rejected', unknown: 'Needs verification', sending: 'In progress or needs verification' }

async function load<T>(params: URLSearchParams, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/history/email?${params}`, { signal, cache: 'no-store' })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw new Error(result?.error || 'Email campaign history could not be loaded.')
  }
  return response.json()
}

function RecipientList({ campaign, tenant }: { campaign: Campaign; tenant: string }) {
  const [status, setStatus] = useState('')
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<{ recipients: Receipt[]; total: number } | null>(null)
  const [error, setError] = useState('')
  const requestKey = JSON.stringify([page, status, search])
  const [loadedKey, setLoadedKey] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ tenant, operation: campaign.id, page: String(page), status, q: search })
    load<{ recipients: Receipt[]; total: number }>(params, controller.signal).then(data => {
      if (!controller.signal.aborted) { setResult(data); setError(''); setLoadedKey(requestKey) }
    }).catch(e => {
      if (!controller.signal.aborted) { setResult(null); setError(e.message); setLoadedKey(requestKey) }
    })
    return () => controller.abort()
  }, [campaign.id, tenant, page, status, search, requestKey])
  const filtered = requestKey === loadedKey ? result : null
  const submit = (event: FormEvent) => { event.preventDefault(); setPage(1); setSearch(input.trim()) }
  return <div style={{ display: 'grid', gap: spacing.md }}>
    <p>These are recorded attempt rows. Unattempted addresses and excluded contacts aren’t listed in this ledger. Gmail acceptance does not establish inbox delivery.</p>
    <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
      <Input aria-label="Search recipient email" placeholder="Search email address" value={input} maxLength={254} onChange={e => setInput(e.target.value)} />
      <Button type="submit" variant="secondary" size="sm">Search</Button>
      <Select aria-label="Recipient status" fullWidth={false} value={status} onChange={e => { setPage(1); setStatus(e.target.value) }}>
        <option value="">All recorded statuses</option>
        {EMAIL_RECIPIENT_STATUSES.map(s => <option key={s} value={s}>{labels[s]}</option>)}
      </Select>
    </form>
    {requestKey !== loadedKey ? <p role="status">Loading recipients…</p> : error ? <>
      <Notice variant="error">{error}</Notice>
      {page > 1 && <div><Button variant="secondary" size="sm" onClick={() => setPage(1)}>Return to page one</Button></div>}
    </> : filtered && <>
      <p role="status">{filtered.total} matching recipient records</p>
      {filtered.recipients.length > 0 && <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', textAlign: 'left' }} aria-label="Email campaign recipients">
          <thead><tr><th scope="col">Email address</th><th scope="col">Status</th><th scope="col">Attempt recorded</th></tr></thead>
          <tbody>{filtered.recipients.map(row => <tr key={row.destination}>
            <td style={{ paddingBlock: spacing.xs, overflowWrap: 'anywhere' }}>{row.destination}</td>
            <td>{labels[row.status]}</td><td>{new Date(row.created_at).toLocaleString()}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <TablePagination page={page} pageCount={Math.max(page, Math.ceil(filtered.total / EMAIL_RECIPIENT_PAGE_SIZE))} onPageChange={setPage} ariaLabel="Recipient pages" />
    </>}
  </div>
}

export function EmailCampaignHistory({ tenant }: { tenant: string }) {
  const [data, setData] = useState<{ campaigns: Campaign[]; limited: boolean } | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    load<{ campaigns: Campaign[]; limited: boolean }>(new URLSearchParams({ tenant }), controller.signal)
      .then(result => { if (!controller.signal.aborted) { setData(result); setError('') } })
      .catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [tenant, revision])
  return <section aria-labelledby="email-campaign-heading" style={{ display: 'grid', gap: spacing.md, marginBottom: spacing.xl }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
      <h2 id="email-campaign-heading">Email campaigns</h2>
      <Button variant="secondary" size="sm" onClick={() => setRevision(value => value + 1)}>Refresh email history</Button>
    </div>
    {error ? <Notice variant="error">{error}</Notice> : data === null ? <p role="status">Loading email campaigns…</p>
      : data.campaigns.length === 0 && <p>No email campaigns recorded.</p>}
    {data?.limited && <Notice>Showing campaigns found in the 200 most recent email progress records.</Notice>}
    {data?.campaigns.map(campaign => {
      const needsAttention = campaign.failed > 0 || campaign.uncertain > 0 || campaign.unattempted > 0
      const expanded = selected === campaign.id
      const d = campaign.diagnostic
      return <article key={campaign.id} style={{ border: `1px solid ${colors.border}`, padding: spacing.md, display: 'grid', gap: spacing.sm }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
          <h3>{campaign.subject || 'Bulk email (subject not recorded)'}</h3>
          {needsAttention && <Badge variant="warning">Needs attention</Badge>}
        </div>
        <div>{campaign.sender && `${campaign.sender} · `}Last progress update {new Date(campaign.updatedAt).toLocaleString()}</div>
        <div>{campaign.accepted} accepted · {campaign.failed} rejected · {campaign.unattempted} not attempted · {campaign.uncertain} need verification · {campaign.excluded} contacts excluded</div>
        {d ? <Notice variant="warning" title="Last recorded provider issue">
          {d.category === 'rate_limit' ? 'Gmail reported a sending limit. Wait before trying again.'
            : d.category === 'mailbox_access' ? 'Check the shared mailbox and its send permissions.'
              : d.category === 'uncertain' ? 'Check Gmail Sent before attempting to resend.' : 'Gmail rejected a send. Review the attempt before retrying.'}
          {d.httpStatus ? ` HTTP ${d.httpStatus}.` : ''}{d.reason ? ` ${d.reason}.` : ''}
        </Notice> : campaign.failed > 0 && <Notice variant="warning">Gmail rejected at least one send. The exact provider error was not recorded.</Notice>}
        <div><Button variant="secondary" size="sm" aria-expanded={expanded} onClick={() => setSelected(expanded ? null : campaign.id)}>{expanded ? 'Hide recipients' : 'View recipients'}</Button></div>
        {expanded && <RecipientList key={`${campaign.id}:${revision}`} campaign={campaign} tenant={tenant} />}
      </article>
    })}
  </section>
}