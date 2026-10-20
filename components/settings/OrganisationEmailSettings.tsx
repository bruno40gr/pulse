'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Input, Notice, SectionTitle, Select, SurfacePanel, Textarea } from '@/components/ui'
import type { OrganisationAlias, OrganisationEmailSettings as Settings } from '@/lib/organisation-email-policy'
import { spacing, typography, colors } from '@/lib/tokens'

type Member = { id: string; people: { first_name: string; last_name: string; email: string } | { first_name: string; last_name: string; email: string }[] }
type Workspace = { owner: boolean; settings: Settings | null; connections: { id: string; email: string }[]; members: Member[]; verifiedAliases: { sendAsEmail: string; displayName?: string }[]; warning: string }

export default function OrganisationEmailSettings({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<Workspace | null>(null)
  const [connectionId, setConnectionId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [signatureText, setSignatureText] = useState('')
  const [aliases, setAliases] = useState<OrganisationAlias[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async (connection?: string) => {
    const response = await fetch(`/api/communications/email-settings?tenant=${encodeURIComponent(tenantId)}${connection ? `&connection=${encodeURIComponent(connection)}` : ''}`, { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Email settings unavailable.')
    setData(result)
    if (!connection) { setConnectionId(result.settings?.connection_id || ''); setDisplayName(result.settings?.display_name || ''); setSignatureText(result.settings?.signature_text || ''); setAliases(result.settings?.aliases || []) }
  }, [tenantId])
  useEffect(() => { void load().catch(error => setError(error.message)) }, [load])
  async function save() {
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/communications/email-settings?tenant=${encodeURIComponent(tenantId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connectionId, displayName, signatureText, aliases: aliases.filter(alias => alias.membershipId) }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Settings could not be saved.')
      setNotice('Organisation email saved. Authorised staff can now use the shared sender and their assigned aliases.')
      await load()
    } catch (error) { setError(error instanceof Error ? error.message : 'Settings could not be saved.') } finally { setBusy(false) }
  }
  if (data && !data.owner) return null
  return <SurfacePanel style={{ marginBottom: spacing.xl }}>
    <SectionTitle>Organisation email</SectionTitle>
    <p style={{ ...typography.body, color: colors.textSecondary }}>Set up one shared organisation mailbox. Staff can send as the organisation or as their assigned, verified same-domain alias. Personal mailboxes cannot be used for sending.</p>
    {error && <Notice variant="error">{error}</Notice>}
    {notice && <Notice>{notice}</Notice>}
    {data?.warning && <Notice variant="warning">{data.warning}</Notice>}
    {data?.owner && <div style={{ display: 'grid', gap: spacing.lg }}>
      <Select label="Shared mailbox" aria-label="Shared organisation mailbox" value={connectionId} disabled={busy} onChange={event => { const id = event.target.value; setConnectionId(id); setAliases([]); void load(id).catch(error => setError(error.message)) }}>
        <option value="">Choose an organisation mailbox</option>
        {data.connections.map(connection => <option key={connection.id} value={connection.id}>{connection.email}</option>)}
      </Select>
      {!data.connections.length && <p>Connect the shared Google mailbox in Gmail settings below first.</p>}
      <Input label="Organisation sender name" value={displayName} disabled={busy} onChange={event => setDisplayName(event.target.value)} placeholder="Your organisation" />
      <Textarea label="Organisation signature" value={signatureText} maxLength={5000} rows={4} disabled={busy} onChange={event => setSignatureText(event.target.value)} hint="Optional. Leave blank to use the shared mailbox’s Google signature or the organisation signature below." />
      {data.verifiedAliases.map(alias => {
        const assignment = aliases.find(item => item.email === alias.sendAsEmail)
        return <div key={alias.sendAsEmail} style={{ display: 'grid', gap: spacing.sm }}><Select label={`Who can send as ${alias.sendAsEmail}?`} aria-label={`Assign ${alias.sendAsEmail}`} value={assignment?.membershipId || ''} disabled={busy} onChange={event => {
          const member = data.members.find(member => member.id === event.target.value)
          const person = Array.isArray(member?.people) ? member.people[0] : member?.people
          setAliases(current => [...current.filter(item => item.email !== alias.sendAsEmail), ...(member ? [{ email: alias.sendAsEmail.toLowerCase(), membershipId: member.id, name: `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || alias.displayName || alias.sendAsEmail }] : [])])
        }}><option value="">Not available to staff</option>{data.members.map(member => { const person = Array.isArray(member.people) ? member.people[0] : member.people; return <option key={member.id} value={member.id}>{person?.first_name} {person?.last_name} · {person?.email}</option> })}</Select>{assignment && <><Input label={`Sender name for ${alias.sendAsEmail}`} value={assignment.name} disabled={busy} onChange={event => setAliases(current => current.map(item => item.email === alias.sendAsEmail ? { ...item, name: event.target.value } : item))} /><Textarea label={`Signature for ${alias.sendAsEmail}`} value={assignment.signatureText || ''} maxLength={5000} rows={4} disabled={busy} onChange={event => setAliases(current => current.map(item => item.email === alias.sendAsEmail ? { ...item, signatureText: event.target.value } : item))} hint="Optional. Leave blank to use the alias’s Google signature or the organisation signature." /></>}</div>
      })}
      <p style={{ ...typography.bodySmall, color: colors.textSecondary }}>Add and verify sender aliases and their signatures on the shared mailbox in Google first, then assign them here. All members with messaging permission can use the organisation sender. Each member alias is available only to its assigned member. If an alias has no Google signature, the organisation signature below is used with its sender name.</p>
      <div><Button disabled={busy || !connectionId || !displayName.trim() || !!data.warning} onClick={() => void save()}>{busy ? 'Saving…' : 'Save organisation email'}</Button></div>
    </div>}
  </SurfacePanel>
}