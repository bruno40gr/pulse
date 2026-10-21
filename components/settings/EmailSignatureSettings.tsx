'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import { colors, spacing, typography } from '@/lib/tokens'
import type { ConversationSignature } from '@/lib/conversation-signature'

export default function EmailSignatureSettings({ tenantId }: { tenantId: string }) {
  const [signature, setSignature] = useState<ConversationSignature>({ company: '', name: '', phone: '', logoUrl: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/conversations/signature?tenant=${encodeURIComponent(tenantId)}`, { cache: 'no-store' })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load signature settings.')
        if (!active) return
        setSignature({ company: data.company, name: data.name, title: data.title || '', phone: data.phone, logoUrl: data.logoUrl })
        if (!data.storageAvailable) setError('Saving signatures requires Migration 025. Ask your administrator to apply it.')
      })
      .catch(error => { if (active) setError(error.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [tenantId])

  const save = async () => {
    setBusy(true); setError(''); setSaved(false)
    try {
      const response = await fetch(`/api/conversations/signature?tenant=${encodeURIComponent(tenantId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(signature) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save signature.')
      setSaved(true)
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save signature.') } finally { setBusy(false) }
  }

  return <section id="email-signature" aria-label="Email signature" style={{ ...typography.body, padding: spacing['3xl'], border: `1px solid ${colors.border}`, borderRadius: 12, background: colors.surface, marginBottom: spacing.xl }}>
    <h2 style={{ ...typography.h2, marginTop: 0 }}>Email signature</h2>
    <p style={{ color: colors.textSecondary }}>Shared by this workspace. Use your public company name, not an internal staging label. Leave the signature name blank to use the signed-in sender’s name.</p>
    <p style={{ color: colors.textSecondary }}>Use a black/dark logo designed for white email backgrounds. This is separate from the app logo. No email address or sign-off is added.</p>
    {loading ? <p>Loading signature…</p> : <>
      {([['company', 'Public company name'], ['name', 'Signature name (optional)'], ['title', 'Shared admin title (optional)'], ['phone', 'Public contact phone number'], ['logoUrl', 'Black/dark email logo URL (HTTPS)']] as const).map(([key, label]) => <label key={key} style={{ ...typography.label, display: 'block', marginTop: spacing.lg }}>
        {label}
        <input type={key === 'phone' ? 'tel' : key === 'logoUrl' ? 'url' : 'text'} value={signature[key] || ''} onChange={event => { setSignature(current => ({ ...current, [key]: event.target.value })); setSaved(false) }} style={{ fontFamily: typography.fontSans, fontSize: typography.sizeBase, display: 'block', width: '100%', boxSizing: 'border-box', marginTop: spacing.sm, padding: spacing.md, border: `1px solid ${colors.border}`, borderRadius: 8, background: colors.surface, color: colors.text }} />
      </label>)}
      <div aria-label="Signature preview" style={{ background: '#fff', color: '#111', padding: spacing.xl, marginTop: spacing.xl, border: `1px solid ${colors.border}`, borderRadius: 8 }}>
        <strong>{signature.name || 'Sender’s name'}</strong>
        {signature.title && <div>{signature.title}</div>}
        {signature.company && <div>{signature.company}</div>}
        {signature.phone && <div>{signature.phone}</div>}
        {/^https:\/\//i.test(signature.logoUrl) && <img src={signature.logoUrl} alt={signature.company || 'Email logo'} width={176} style={{ display: 'block', marginTop: spacing.md, maxWidth: '100%', height: 'auto' }} />}
      </div>
      <div style={{ marginTop: spacing.xl }}><Button onClick={() => void save()} disabled={busy || !signature.phone.trim()}>{busy ? 'Saving…' : 'Save email signature'}</Button></div>
    </>}
    {error && <p role="alert" style={{ color: colors.error }}>{error}</p>}
    {saved && <p role="status">Email signature saved. Reopen the inbox to use the updated signature.</p>}
  </section>
}