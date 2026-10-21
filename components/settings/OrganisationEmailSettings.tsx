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
    if (!connection) { setConnectionId(result.settings?.connection_id || (result.connections.length === 1 ? result.connections[0].id : '')); setDisplayName(result.settings?.display_name || ''); setSignatureText(result.settings?.signature_text || ''); setAliases(result.settings?.aliases || []) }
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
  if (data && !data.connections.length) return null
  return <SurfacePanel padding={spacing['3xl']} style={{ ...typography.body, marginBottom: spacing.xl }}>
    <SectionTitle>Business sender</SectionTitle>
    <p style={{ ...typography.body, color: colors.textSecondary }}>Choose the business name customers see in the From field. Your personal sign-off is managed above.</p>
    {error && <Notice variant="error">{error}</Notice>}
    {notice && <Notice>{notice}</Notice>}
    {data?.warning && <Notice variant="warning">{data.warning}</Notice>}
    {data?.owner && <div style={{ display: 'grid', gap: spacing.lg }}>
      <Select label="Shared mailbox" aria-label="Shared organisation mailbox" value={connectionId} disabled={busy} onChange={event => { const id = event.target.value; setConnectionId(id); setAliases([]); void load(id).catch(error => setError(error.message)) }}>
        <option value="">Choose an organisation mailbox</option>
        {data.connections.map(connection => <option key={connection.id} value={connection.id}>{connection.email}</option>)}
      </Select>
      <Input label="Business sender name" aria-label="Business sender name" value={displayName} disabled={busy} onChange={event => setDisplayName(event.target.value)} placeholder="Your business name" />
      <details>
      <summary>Advanced sender settings (optional)</summary>
      <p style={{ ...typography.bodySmall, color: colors.textSecondary }}>Separate staff sending addresses are optional. Only Google-verified addresses explicitly assigned here can be used. You do not need aliases to send from the shared business mailbox.</p>
      <Textarea label="Legacy shared signature" value={signatureText} maxLength={5000} rows={4} disabled={busy} onChange={event => setSignatureText(event.target.value)} hint="Retained for compatibility. The current email composers use your personal sign-off instead." />
      {data.verifiedAliases.map(alias => {
        const assignment = aliases.find(item => item.email === alias.sendAsEmail)
        return <div key={alias.sendAsEmail} style={{ display: 'grid', gap: spacing.sm }}><Select label={`Who can send as ${alias.sendAsEmail}?`} aria-label={`Assign ${alias.sendAsEmail}`} value={assignment?.membershipId || ''} disabled={busy} onChange={event => {
          const member = data.members.find(member => member.id === event.target.value)
          const person = Array.isArray(member?.people) ? member.people[0] : member?.people
          setAliases(current => [...current.filter(item => item.email !== alias.sendAsEmail), ...(member ? [{ email: alias.sendAsEmail.toLowerCase(), membershipId: member.id, name: `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || alias.displayName || alias.sendAsEmail }] : [])])
        }}><option value="">Not available to staff</option>{data.members.map(member => { const person = Array.isArray(member.people) ? member.people[0] : member.people; return <option key={member.id} value={member.id}>{person?.first_name} {person?.last_name} · {person?.email}</option> })}</Select>{assignment && <><Input label={`Sender name for ${alias.sendAsEmail}`} value={assignment.name} disabled={busy} onChange={event => setAliases(current => current.map(item => item.email === alias.sendAsEmail ? { ...item, name: event.target.value } : item))} /><Textarea label={`Signature for ${alias.sendAsEmail}`} value={assignment.signatureText || ''} maxLength={5000} rows={4} disabled={busy} onChange={event => setAliases(current => current.map(item => item.email === alias.sendAsEmail ? { ...item, signatureText: event.target.value } : item))} hint="Optional. Leave blank to use the alias’s Google signature or the organisation signature." /></>}</div>
      })}
      </details>
      <div><Button disabled={busy || !connectionId || !displayName.trim() || !!data.warning} onClick={() => void save()}>{busy ? 'Saving…' : 'Save business sender'}</Button></div>
    </div>}
  </SurfacePanel>
}