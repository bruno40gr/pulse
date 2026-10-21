'use client'

import { useEffect, useState } from 'react'
import { Button, Input, Notice, SectionTitle, SurfacePanel } from '@/components/ui'
import { colors, spacing, typography } from '@/lib/tokens'

export default function PersonalEmailSignoff({ tenantId }: { tenantId: string }) {
  const [signoff, setSignoff] = useState({ name: '', role: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setSaved(false); setConnected(false)
    fetch(`/api/account/email-signoff?tenant=${encodeURIComponent(tenantId)}`, { cache: 'no-store' }).then(async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Your email sign-off could not be loaded.')
      if (!active) return
      setConnected(data.connected === true)
      if (!data.connected) return
      setSignoff({ name: data.name, role: data.role }); setStorageAvailable(data.storageAvailable)
    }).catch(error => { if (active) setError(error.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [tenantId])
  const save = async () => {
    setBusy(true); setError(''); setSaved(false)
    try {
      const response = await fetch(`/api/account/email-signoff?tenant=${encodeURIComponent(tenantId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(signoff) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Your email sign-off could not be saved.')
      setSignoff({ name: data.name, role: data.role }); setSaved(true)
    } catch (error) { setError(error instanceof Error ? error.message : 'Your email sign-off could not be saved.') } finally { setBusy(false) }
  }
  if (loading || !connected) return null
  return <SurfacePanel padding={spacing['3xl']} style={{ ...typography.body, marginBottom: spacing.xl }}>
    <SectionTitle>Your email sign-off</SectionTitle>
    {loading ? <p>Loading your sign-off…</p> : !storageAvailable ? <div style={{ display: 'grid', gap: spacing.lg }}>
      {!error && <Notice title="Sign-off customization isn’t enabled yet">
        Emails use your profile name below. Once customization is enabled, you can edit your name and add a role here.
      </Notice>}
      {!error && <div aria-label="Your current email sign-off" style={{ padding: spacing.lg, background: colors.surfaceMuted, color: colors.text, overflowWrap: 'anywhere' }}>
        <div style={{ ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm }}>Your signature</div>
        <strong>{signoff.name || 'No personal sign-off'}</strong>
      </div>}
    </div> : <div style={{ display: 'grid', gap: spacing.lg }}>
      <Input label="Sign emails as" aria-label="Sign emails as" value={signoff.name} maxLength={200} disabled={busy} onChange={event => { setSignoff(current => ({ ...current, name: event.target.value })); setSaved(false) }} hint="Leave blank for no personal sign-off." />
      <Input label="Role" aria-label="Role" value={signoff.role} maxLength={200} disabled={busy} onChange={event => { setSignoff(current => ({ ...current, role: event.target.value })); setSaved(false) }} hint="Your job title, shown below your name." />
      <div aria-label="Your sign-off preview" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: spacing.lg, background: colors.surfaceMuted, color: colors.text }}><div style={{ ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm }}>Preview</div>{signoff.name ? <><strong>{signoff.name}</strong>{signoff.role && <div>{signoff.role}</div>}</> : 'No personal sign-off'}</div>
      <div><Button disabled={busy || !storageAvailable} onClick={() => void save()}>{busy ? 'Saving…' : 'Save sign-off'}</Button></div>
    </div>}
    {error && <Notice variant="error" style={{ marginTop: spacing.lg }}>{error}</Notice>}
    {saved && <Notice style={{ marginTop: spacing.lg }}>Your sign-off is saved. Reopen the inbox to use it.</Notice>}
  </SurfacePanel>
}