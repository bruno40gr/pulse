'use client'


import { Button } from '@/components/ui/Button'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { colors, radius, spacing, typography } from '@/lib/tokens'

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    Promise.all([
      createClient().auth.getUser(),
      fetch('/api/account/me').then(async response => ({ ok: response.ok, body: await response.json() })),
    ]).then(([{ data }, membership]) => {
      const valid = Boolean(data.user) && membership.ok && membership.body.canUpdateCredentials
      setReady(valid)
      if (!valid) setError('This password-reset link is invalid, expired, or not linked to an active staff account.')
    })
  }, [])

  const save = async () => {
    if (password.length < 10) return setError('Use at least 10 characters for your password.')
    if (password !== confirmation) return setError('The passwords do not match.')
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }
    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <main style={authPageStyle}><section style={authCardStyle}>
      <h1 style={{ ...typography.h1, margin: 0 }}>Choose a new password</h1>
      <p style={{ ...typography.body, color: colors.textSecondary }}>Use at least 10 characters.</p>
      {ready && <div style={{ display: 'grid', gap: spacing.lg }}>
        <label style={authLabelStyle}>New password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" style={authFieldStyle} /></label>
        <label style={authLabelStyle}>Confirm password<input type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void save() }} autoComplete="new-password" style={authFieldStyle} /></label>
      </div>}
      {error && <p role="alert" style={{ color: colors.error, ...typography.bodySmall }}>{error}</p>}
      {ready ? <Button variant="primary" size="sm" type="button" onClick={() => void save()} disabled={saving} style={{ width: '100%', marginTop: spacing.xl }}>{saving ? 'Saving…' : 'Save password'}</Button> : <a href="/forgot-password" style={{ color: colors.crimson, fontSize: typography.sizeSm }}>Request another reset link</a>}
    </section></main>
  )
}

const authPageStyle: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.background, padding: spacing.lg }
const authCardStyle: React.CSSProperties = { width: 'min(100%, 440px)', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius['2xl'], padding: spacing['4xl'], boxShadow: '0 18px 50px rgba(20, 30, 34, 0.08)' }
const authLabelStyle: React.CSSProperties = { display: 'grid', gap: spacing.xs, fontFamily: typography.fontSans, fontSize: typography.sizeSm, fontWeight: typography.weightMedium }
const authFieldStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: `${spacing.md} ${spacing.lg}`, border: `1px solid ${colors.border}`, borderRadius: radius.lg, fontFamily: typography.fontSans, fontSize: typography.sizeMd }
const authSubmitStyle: React.CSSProperties = { width: '100%', marginTop: spacing.xl, padding: spacing.md, border: 'none', borderRadius: radius.lg, background: colors.action, color: colors.surface, fontFamily: typography.fontSans, fontSize: typography.sizeMd, fontWeight: typography.weightSemibold, cursor: 'pointer' }