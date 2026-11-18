'use client'

import { useEffect, useState } from 'react'
import { Badge, Button, Notice, Select, Tabs, SectionTitle } from '@/components/ui'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { ResponsiveDataTable, type DataTableColumn } from '@/components/ui/DataGridTable'
import { TableResultCount, TableSearchControl } from '@/components/ui/TableWorkspaceControls'
import { useRouter } from 'next/navigation'
import { isShowcaseRecovery } from '@/lib/showcase-email-recovery'
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
const labels: Record<Status, string> = { sent: 'Accepted by Gmail', failed: 'Failed', unknown: 'Needs verification', sending: 'In progress or needs verification' }
type FollowUpRow = { destination: string; name: string; students: string; status: Status | 'unattempted' }
type FollowUpData = { rows: FollowUpRow[]; started: boolean; canSend: boolean; closed: boolean }
const followUpColumns: DataTableColumn<FollowUpRow, never>[] = [
  { id: 'students', header: 'Student(s)', width: '23%', render: row => row.students || '—' },
  { id: 'name', header: 'Recipient name', width: '23%', render: row => row.name || '—' },
  { id: 'email', header: 'Email address', width: '34%', render: row => <span style={{ overflowWrap: 'anywhere' }}>{row.destination}</span> },
  { id: 'status', header: 'Status', width: '20%', render: row => row.status === 'unattempted' ? 'Not sent' : labels[row.status] },
]
const receiptColumns: DataTableColumn<Receipt, never>[] = [
  { id: 'email', header: 'Email address', width: '46%', render: row => <span style={{ overflowWrap: 'anywhere' }}>{row.destination}</span> },
  { id: 'status', header: 'Status', width: '26%', render: row => labels[row.status] },
  { id: 'time', header: 'Attempt recorded', width: '28%', render: row => new Date(row.created_at).toLocaleString() },
]

async function load<T>(params: URLSearchParams, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/history/email?${params}`, { signal, cache: 'no-store' })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw new Error(result?.error || 'Email campaign history could not be loaded.')
  }
  return response.json()
}

function FollowUp({ campaign, tenant }: { campaign: Campaign; tenant: string }) {
  const router = useRouter()
  const [data, setData] = useState<FollowUpData | null>(null)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    load<FollowUpData>(new URLSearchParams({ tenant, operation: campaign.id, view: 'follow-up' }), controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [tenant, campaign.id])
  if (error) return <Notice variant="error">{error}</Notice>
  if (!data) return <p role="status">Checking the current student roster…</p>
  const remaining = data.rows.filter(row => row.status === 'unattempted').length
  const matches = data.rows.filter(row => `${row.name} ${row.students} ${row.destination}`.toLowerCase().includes(search.trim().toLowerCase()))
  return <section aria-label="Remaining recipients" style={{ display: 'grid', gap: spacing.md, minWidth: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }}>
      <SectionTitle as="h4" variant="card">{remaining} addresses not sent</SectionTitle>
      {data.canSend && remaining > 0 && <Button onClick={() => router.push(`/dashboard/inbox/bulk?recoveryOf=${campaign.id}`)}>{data.started ? 'Continue sending' : 'Compose for unsent recipients'}</Button>}
    </div>
    <Notice variant="info">The original send stopped before trying {campaign.unattempted} addresses. That list wasn’t saved, so this table uses the current enrolled roster. Addresses already attempted, including failures, are excluded. {data.closed ? 'This invitation is now closed.' : remaining > 0 && !data.canSend && 'Ask someone with send permission to send to the remaining recipients.'}</Notice>
    <TableSearchControl label="Search remaining recipients" placeholder="Search student, recipient or email" value={input} onChange={setInput} onSearch={() => { setSearch(input); setPage(1) }} onClear={() => { setInput(''); setSearch(''); setPage(1) }} />
    <TableResultCount>{matches.length} matching email addresses</TableResultCount>
    <ResponsiveDataTable rows={matches.slice((page - 1) * EMAIL_RECIPIENT_PAGE_SIZE, page * EMAIL_RECIPIENT_PAGE_SIZE)} columns={followUpColumns} getRowKey={row => row.destination} emptyContent="No matching follow-up addresses." ariaLabel="Showcase follow-up recipients" />
    {matches.length > EMAIL_RECIPIENT_PAGE_SIZE && <TablePagination page={page} pageCount={Math.ceil(matches.length / EMAIL_RECIPIENT_PAGE_SIZE)} onPageChange={setPage} ariaLabel="Follow-up recipient pages" />}
  </section>
}

function RecipientList({ campaign, tenant, failedOnly }: { campaign: Campaign; tenant: string; failedOnly: boolean }) {
  const [status, setStatus] = useState(failedOnly ? 'failed' : '')
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
  return <div style={{ display: 'grid', gap: spacing.md }}>
    <p style={{ color: colors.textSecondary }}>{failedOnly ? 'These addresses were tried, but Gmail did not accept the send. Check the address and the error before retrying. They are not included in the unsent list.' : 'Accepted by Gmail means Gmail accepted the send, not that it reached the inbox.'}</p>
    <TableSearchControl label="Search recipient email" placeholder="Search email address" value={input} onChange={value => setInput(value.slice(0, 254))} onSearch={() => { setSearch(input.trim()); setPage(1) }} onClear={() => { setInput(''); setSearch(''); setPage(1) }} />
    {!failedOnly && <div>
      <Select aria-label="Recipient status" fullWidth={false} controlSize="toolbar" value={status} onChange={e => { setPage(1); setStatus(e.target.value) }}>
        <option value="">All recorded statuses</option>
        {EMAIL_RECIPIENT_STATUSES.map(s => <option key={s} value={s}>{labels[s]}</option>)}
      </Select>
    </div>}
    {requestKey !== loadedKey ? <p role="status">Loading recipients…</p> : error ? <>
      <Notice variant="error">{error}</Notice>
      {page > 1 && <div><Button variant="secondary" size="sm" onClick={() => setPage(1)}>Return to page one</Button></div>}
    </> : filtered && <>
      <TableResultCount>{filtered.total} matching recipient records</TableResultCount>
      <ResponsiveDataTable rows={filtered.recipients} columns={receiptColumns} getRowKey={row => row.destination} emptyContent="No matching attempts." ariaLabel="Original send attempts" />
      <TablePagination page={page} pageCount={Math.max(page, Math.ceil(filtered.total / EMAIL_RECIPIENT_PAGE_SIZE))} onPageChange={setPage} ariaLabel="Recipient pages" />
    </>}
  </div>
}

export function EmailCampaignHistory({ tenant }: { tenant: string }) {
  const [data, setData] = useState<{ campaigns: Campaign[]; limited: boolean } | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<'follow-up' | 'failed' | 'attempts'>('follow-up')
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
      const recoverable = isShowcaseRecovery(tenant, campaign.id)
      const expanded = (selected ?? data.campaigns.find(item => isShowcaseRecovery(tenant, item.id))?.id) === campaign.id
      const d = campaign.diagnostic
      return <DenseSectionPanel key={campaign.id} title={campaign.subject || 'Bulk email (subject not recorded)'} actions={<Button variant="secondary" size="sm" aria-expanded={expanded} onClick={() => { setView(recoverable ? 'follow-up' : 'attempts'); setSelected(expanded ? '' : campaign.id) }}>{expanded ? 'Hide details' : recoverable ? 'View recipients' : 'View send attempts'}</Button>} contentStyle={{ display: 'grid', gap: spacing.md }}>
        {needsAttention && <div><Badge variant="warning">Needs attention</Badge></div>}
        <div>{campaign.sender && `${campaign.sender} · `}Last progress update {new Date(campaign.updatedAt).toLocaleString()}</div>
        <div>{campaign.accepted} accepted · {campaign.failed} failed · {campaign.unattempted} not sent · {campaign.uncertain} need verification · {campaign.excluded} contacts excluded</div>
        {expanded && (!recoverable || view !== 'follow-up') && (d ? <Notice variant="warning" title="Last recorded provider issue">
          {d.category === 'rate_limit' ? 'Gmail reported a sending limit. Wait before trying again.'
            : d.category === 'mailbox_access' ? 'Check the shared mailbox and its send permissions.'
              : d.category === 'uncertain' ? 'Check Gmail Sent before attempting to resend.' : 'Gmail rejected a send. Review the attempt before retrying.'}
          {d.httpStatus ? ` HTTP ${d.httpStatus}.` : ''}{d.reason ? ` ${d.reason}.` : ''}
        </Notice> : campaign.failed > 0 && <Notice variant="warning">Gmail rejected at least one send. The exact provider error was not recorded.</Notice>)}
        {expanded && recoverable && <Tabs items={[{ key: 'follow-up', label: 'Not sent' }, { key: 'failed', label: 'Failed', count: campaign.failed }, { key: 'attempts', label: 'All original attempts' }]} activeKey={view} onChange={setView} ariaLabel="Campaign recipient views" />}
        {expanded && (recoverable && view === 'follow-up' ? <FollowUp key={`${campaign.id}:${revision}`} campaign={campaign} tenant={tenant} /> : <RecipientList key={`${campaign.id}:${revision}:${view}`} campaign={campaign} tenant={tenant} failedOnly={view === 'failed'} />)}
        {!recoverable && campaign.unattempted > 0 && <p style={{ color: colors.textSecondary }}>The original recipient list wasn’t saved. This campaign can’t be resumed from history.</p>}
      </DenseSectionPanel>
    })}
  </section>
}