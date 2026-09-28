'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { colors, radius, spacing, typography } from '@/lib/tokens'
import { setActiveTenantId } from '@/lib/tenant'

type ClaimContext = { status: 'invited' | 'active'; email: string; name: string }

export default function ClaimPage() {
  const [context, setContext] = useState<ClaimContext | null>(null)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const supabase = createClient()
      await new Promise(resolve => setTimeout(resolve, 150))
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setError('This invitation link is invalid or expired. Ask an Owner or Admin to resend it.')
        setLoading(false)
        return
      }
      const response = await fetch('/api/account/claim')
      const body = await response.json()
      if (cancelled) return
      if (!response.ok) setError(body.error || 'This invitation cannot be claimed.')
      else if (body.status === 'active') router.replace('/dashboard')
      else setContext(body)
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [router])

  const activate = async () => {
    if (password.length < 10) return setError('Use at least 10 characters for your password.')
    if (password !== confirmation) return setError('The passwords do not match.')
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/account/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not activate your account.')
      if (typeof body.tenantId === 'string') setActiveTenantId(body.tenantId)
      const { data: sessionData } = await createClient().auth.getSession()
      if (!sessionData.session) throw new Error('Your account was activated, but sign-in could not be completed. Return to sign in with your new password.')
      router.replace('/dashboard')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not activate your account.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main style={authPageStyle}>
      <section style={authCardStyle}>
        <h1 style={{ ...typography.h1, margin: 0, color: colors.text }}>Set up your personal password.</h1>
        <p style={{ ...typography.body, color: colors.textSecondary, margin: `${spacing.sm} 0 ${spacing.xl}` }}>
          {loading ? 'Checking your invitation…' : context ? `Welcome${context.name ? `, ${context.name}` : ''}. Choose a personal password for ${context.email}.` : 'We could not verify this invitation.'}
        </p>
        {context && (
          <div style={{ display: 'grid', gap: spacing.lg }}>
            <label style={authLabelStyle}>New password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" style={authFieldStyle} /><span style={authHintStyle}>At least 10 characters.</span></label>
            <label style={authLabelStyle}>Confirm password<input type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void activate() }} autoComplete="new-password" style={authFieldStyle} /></label>
          </div>
        )}
        {error && <p role="alert" style={{ color: colors.error, fontSize: typography.sizeSm, lineHeight: 1.5 }}>{error}</p>}
        {context ? <button type="button" onClick={() => void activate()} disabled={saving} style={authSubmitStyle}>{saving ? 'Activating…' : 'Activate account'}</button> : !loading && <a href="/login" style={{ color: colors.crimson, fontSize: typography.sizeSm }}>Return to sign in</a>}
      </section>
    </main>
  )
}

const authPageStyle: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.background, padding: spacing.lg }
const authCardStyle: React.CSSProperties = { width: 'min(100%, 460px)', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius['2xl'], padding: spacing['4xl'], boxShadow: '0 18px 50px rgba(20, 30, 34, 0.08)' }
const authLabelStyle: React.CSSProperties = { display: 'grid', gap: spacing.xs, fontFamily: typography.fontSans, fontSize: typography.sizeSm, fontWeight: typography.weightMedium, color: colors.text }
const authFieldStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: `${spacing.md} ${spacing.lg}`, border: `1px solid ${colors.border}`, borderRadius: radius.lg, fontFamily: typography.fontSans, fontSize: typography.sizeMd }
const authHintStyle: React.CSSProperties = { color: colors.textMuted, fontSize: typography.sizeXs, fontWeight: typography.weightNormal }
const authSubmitStyle: React.CSSProperties = { width: '100%', marginTop: spacing.xl, padding: spacing.md, border: 'none', borderRadius: radius.lg, background: colors.action, color: colors.surface, fontFamily: typography.fontSans, fontSize: typography.sizeMd, fontWeight: typography.weightSemibold, cursor: 'pointer' }