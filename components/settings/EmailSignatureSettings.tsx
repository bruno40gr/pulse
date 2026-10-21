'use client'

import { useEffect, useState } from 'react'
import { Button, Input, Notice, SectionTitle, SurfacePanel } from '@/components/ui'
import { colors, spacing, typography } from '@/lib/tokens'
import { formatSignaturePhone } from '@/lib/email-signature-fields'
import { conversationSignatureHtml } from '@/lib/conversation-signature'

export default function EmailSignatureSettings({ tenantId }: { tenantId: string }) {
  const [signoff, setSignoff] = useState({ name: '', role: '', includeCompanyLogo: false, phone: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [connected, setConnected] = useState(false)
  const [companyLogoUrl, setCompanyLogoUrl] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setSaved(false); setConnected(false)
    fetch(`/api/account/email-signoff?tenant=${encodeURIComponent(tenantId)}`, { cache: 'no-store' }).then(async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Email signature could not be loaded.')
      if (!active) return
      setConnected(data.connected === true)
      if (!data.connected) return
      setSignoff({ name: data.name, role: data.role, includeCompanyLogo: data.includeCompanyLogo === true, phone: data.phone || '' }); setCompanyLogoUrl(data.companyLogoUrl || ''); setStorageAvailable(data.storageAvailable)
    }).catch(error => { if (active) setError(error.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [tenantId])
  const save = async () => {
    setBusy(true); setError(''); setSaved(false)
    try {
      const response = await fetch(`/api/account/email-signoff?tenant=${encodeURIComponent(tenantId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(signoff) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Email signature could not be saved.')
      setSignoff({ name: data.name, role: data.role, includeCompanyLogo: data.includeCompanyLogo === true, phone: data.phone || '' }); setSaved(true)
    } catch (error) { setError(error instanceof Error ? error.message : 'Email signature could not be saved.') } finally { setBusy(false) }
  }
  if (loading || (!connected && !error)) return null
  return <SurfacePanel padding={spacing['3xl']} style={{ ...typography.body, marginBottom: spacing.xl }}>
    <SectionTitle>Email signature</SectionTitle>
    {loading ? <p>Loading your signature…</p> : !storageAvailable ? <div style={{ display: 'grid', gap: spacing.lg }}>
      {!error && <Notice title="Signature editing isn’t enabled yet">
        Emails use your profile name below. Once customization is enabled, you can edit your name and add a role here.
      </Notice>}
      {!error && <div aria-label="Your current email signature" style={{ padding: spacing.lg, background: colors.surfaceMuted, color: colors.text, overflowWrap: 'anywhere' }}>
        <div style={{ ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm }}>Your signature</div>
        <strong>{signoff.name || 'No email signature'}</strong>
      </div>}
    </div> : <div style={{ display: 'grid', gap: spacing.lg }}>
      <Input label="Name" aria-label="Name" value={signoff.name} maxLength={200} disabled={busy} onChange={event => { setSignoff(current => ({ ...current, name: event.target.value })); setSaved(false) }} />
      <Input label="Role" aria-label="Role" value={signoff.role} maxLength={200} disabled={busy} onChange={event => { setSignoff(current => ({ ...current, role: event.target.value })); setSaved(false) }} />
      <label style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <input type="checkbox" checked={signoff.includeCompanyLogo} disabled={busy} onChange={event => { setSignoff(current => ({ ...current, includeCompanyLogo: event.target.checked })); setSaved(false) }} />
        Include company logo
      </label>
      <Input label="Phone number" type="tel" inputMode="numeric" value={signoff.phone} maxLength={11} disabled={busy} placeholder="XXX-XXXXXXX" onChange={event => { setSignoff(current => ({ ...current, phone: formatSignaturePhone(event.target.value).slice(0, 11) })); setSaved(false) }} />
      <div><div style={{ ...typography.label, marginBottom: spacing.sm }}>Preview</div>
        <div aria-label="Email signature preview" style={{ overflowWrap: 'anywhere', padding: spacing.lg, background: '#fff', color: '#111', border: `1px solid ${colors.border}` }} dangerouslySetInnerHTML={{ __html: conversationSignatureHtml({ ...signoff, title: signoff.role, company: '', personal: true, logoUrl: signoff.includeCompanyLogo ? companyLogoUrl : '' }, '') }} />
      </div>
      <div><Button disabled={busy || !storageAvailable} onClick={() => void save()}>{busy ? 'Saving…' : 'Save email signature'}</Button></div>
    </div>}
    {error && <Notice variant="error" style={{ marginTop: spacing.lg }}>{error}</Notice>}
    {saved && <p role="status" style={{ marginTop: spacing.lg }}>Email signature saved.</p>}
  </SurfacePanel>
}