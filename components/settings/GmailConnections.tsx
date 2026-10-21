'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, Notice, SectionTitle, Select, SurfacePanel } from '@/components/ui'
import { colors, radius, spacing, typography } from '@/lib/tokens'

type Workspace = {
  configured: boolean
  connections: { id: string; email: string; capture_from: string; last_synced_at: string | null; last_error: string | null; page_token: string | null }[]
  review: { id: string; sender: string; subject: string; body: string; sent_at: string; candidate_lead_ids: string[] }[]
  leads: { id: string; program_label: string | null; service_label: string | null; crm_contacts: { full_name: string } | { full_name: string }[] | null }[]
}

export default function GmailConnections({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<Workspace | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [connectOpen, setConnectOpen] = useState(false)
  const load = useCallback(async () => {
    const response = await fetch(`/api/gmail?tenant=${encodeURIComponent(tenantId)}`, { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || 'Mailbox settings unavailable.')
    setData(body)
  }, [tenantId])
  useEffect(() => {
    void load().catch(error => setError(error.message))
    const result = new URLSearchParams(window.location.search).get('gmail')
    if (result === 'error') setError('Google connection could not be completed. Allow both reading and sending email, then try again. If your organization restricts third-party apps, ask your Google Workspace administrator for access.')
  }, [load])

  const action = async (body: Record<string, string>) => {
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/gmail?tenant=${encodeURIComponent(tenantId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Mailbox action failed.')
      setMessage(body.action === 'sync' ? result.busy ? 'This mailbox is already syncing.' : `${result.recorded} email notes captured. ${result.review} need review.${result.more ? ' More messages remain; run Sync again or let the scheduled job continue.' : ''}` : 'Mailbox settings updated.')
      await load()
    } catch (error) { setError(error instanceof Error ? error.message : 'Mailbox action failed.') } finally { setBusy(false) }
  }
  const connect = async () => {
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/gmail/connect?tenant=${encodeURIComponent(tenantId)}`, { method: 'POST' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not connect Google.')
      window.location.assign(body.url)
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not connect Google.'); setBusy(false) }
  }

  return <SurfacePanel padding={spacing['3xl']} style={{ ...typography.body, marginBottom: spacing.xl, boxShadow: 'none' }}>
    <SectionTitle>{data?.connections.length === 0 ? 'Connect Business email' : 'Business Email'}</SectionTitle>
    <p style={{ color: colors.textSecondary, margin: 0 }}>This will allow us to send and receive email from your email provider.</p>
    <Modal isOpen={connectOpen} onClose={busy ? undefined : () => setConnectOpen(false)} size="md">
      <ModalHeader title="Connect your business email" onClose={busy ? undefined : () => setConnectOpen(false)} />
      <ModalBody style={typography.body}>
        <p>Connect the email account your team uses to communicate with customers. When you do that, Google will ask you to allow us to:</p>
        <ul style={{ paddingLeft: spacing.xl, lineHeight: 1.6 }}>
          <li><strong>Read email:</strong> to show customer conversations and keep email activity up to date.</li>
          <li><strong>Send email:</strong> to send messages you or your authorized staff choose to send from the app.</li>
        </ul>
        {error && <Notice variant="warning">{error}</Notice>}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" disabled={busy} onClick={() => setConnectOpen(false)}>Not now</Button>
        <Button disabled={busy || !data?.configured} onClick={() => void connect()}>{busy ? 'Connecting…' : 'Continue with Google'}</Button>
      </ModalFooter>
    </Modal>
    {error && <Notice variant="warning" style={{ marginTop: spacing.md }}>{error}</Notice>}
    {message && <Notice variant="info" style={{ marginTop: spacing.md }}>{message}</Notice>}
    {!data && !error && <p style={{ color: colors.textMuted, fontSize: typography.sizeBase, marginTop: spacing.lg }}>Loading…</p>}
    {data?.connections.length === 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xl }}>
      <Button onClick={() => { setError(''); setConnectOpen(true) }} disabled={busy || !data.configured}>Connect with Google</Button>
    </div>}
    {data && !data.configured && <p style={{ color: colors.textMuted }}>Google OAuth credentials and token encryption must be configured by your deployment administrator.</p>}
    {data?.connections.map(connection => <div key={connection.id} style={{ marginTop: spacing.xl }}>
      <div style={{ background: colors.surfaceMuted, borderRadius: radius.lg, padding: spacing['2xl'], display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
        <div style={{ fontSize: typography.sizeMd, color: colors.success, fontWeight: typography.weightSemibold }}>✓ Gmail connected</div>
        <div style={{ fontSize: typography.sizeBase, color: colors.text, overflowWrap: 'anywhere' }}>
          Mailbox: <span style={{ fontWeight: typography.weightMedium }}>{connection.email}</span>
        </div>
        <div style={{ fontSize: typography.sizeBase, color: colors.text }}>
          Last completed sync: {connection.last_synced_at ? new Date(connection.last_synced_at).toLocaleString() : 'Not synced yet'}{connection.page_token ? ' · Batch in progress' : ''}
        </div>
      </div>
      {connection.last_error && <Notice variant="warning">{connection.last_error}</Notice>}
      <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap', marginTop: spacing.xl }}>
        <Button variant="secondary" disabled={busy} onClick={() => void action({ action: 'sync', id: connection.id })}>Sync now</Button>
        <Button variant="secondary" disabled={busy || !data.configured} onClick={() => { setError(''); setConnectOpen(true) }}>Reconnect</Button>
        <Button variant="destructive" disabled={busy} onClick={() => { if (window.confirm(`Disconnect ${connection.email}? Existing lead notes remain. Remove Pulse access in your Google account too if you want to revoke the Google grant.`)) void action({ action: 'disconnect', id: connection.id }) }}>Disconnect</Button>
      </div>
    </div>)}
    {Boolean(data?.connections.length) && <div style={{ marginTop: spacing.md }}>
      <Button variant="ghost" disabled={busy || !data?.configured} onClick={() => { setError(''); setConnectOpen(true) }}>Connect another mailbox</Button>
    </div>}
    {Boolean(data?.review.length) && <h3 style={{ marginTop: spacing.xl }}>Emails needing lead matching</h3>}
    {data?.review.map(item => <div key={item.id} style={{ marginTop: spacing.lg, borderTop: `1px solid ${colors.border}`, paddingTop: spacing.md }}>
      <strong>{item.subject || 'Email without subject'}</strong>
      <p style={{ fontSize: typography.sizeXs, color: colors.textMuted }}>{item.sender} · {new Date(item.sent_at).toLocaleString()}</p>
      <details><summary>Read email before matching</summary><p style={{ whiteSpace: 'pre-wrap' }}>{item.body}</p></details>
      <Select label="Choose the correct lead" value={choices[item.id] || ''} onChange={event => setChoices(current => ({ ...current, [item.id]: event.target.value }))}>
        <option value="">Select a lead</option>
        {item.candidate_lead_ids.map(id => {
          const lead = data.leads.find(lead => lead.id === id)
          const contact = Array.isArray(lead?.crm_contacts) ? lead.crm_contacts[0] : lead?.crm_contacts
          return <option key={id} value={id}>{contact?.full_name || 'Lead'} · {lead?.program_label || lead?.service_label || id}</option>
        })}
      </Select>
      <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.md }}>
        <Button size="sm" disabled={busy || !choices[item.id]} onClick={() => void action({ action: 'record', id: item.id, leadId: choices[item.id] })}>Record email</Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void action({ action: 'ignore', id: item.id })}>Ignore</Button>
      </div>
    </div>)}
  </SurfacePanel>
}