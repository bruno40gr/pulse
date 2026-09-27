'use client'

import { useState } from 'react'
import { colors, radius, spacing, typography } from '@/lib/tokens'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const send = async () => {
    if (!email.trim()) return
    setLoading(true)
    await fetch('/api/account/recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    setMessage('If that email belongs to an active Headliner account, a password-reset link is on its way.')
    setLoading(false)
  }

  return (
    <main style={authPageStyle}><section style={authCardStyle}>
      <h1 style={{ ...typography.h1, margin: 0 }}>Reset your password</h1>
      <p style={{ ...typography.body, color: colors.textSecondary }}>Enter the email for your claimed staff account.</p>
      <label style={authLabelStyle}>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void send() }} autoComplete="email" style={authFieldStyle} /></label>
      {message && <p role="status" style={{ color: colors.success, ...typography.bodySmall }}>{message}</p>}
      <button type="button" onClick={() => void send()} disabled={loading || !email.trim()} style={authSubmitStyle}>{loading ? 'Sending…' : 'Send reset link'}</button>
      <a href="/login" style={{ display: 'inline-block', marginTop: spacing.lg, color: colors.crimson, fontSize: typography.sizeSm }}>Return to sign in</a>
    </section></main>
  )
}

const authPageStyle: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.background, padding: spacing.lg }
const authCardStyle: React.CSSProperties = { width: 'min(100%, 440px)', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius['2xl'], padding: spacing['4xl'], boxShadow: '0 18px 50px rgba(20, 30, 34, 0.08)' }
const authLabelStyle: React.CSSProperties = { display: 'grid', gap: spacing.xs, fontFamily: typography.fontSans, fontSize: typography.sizeSm, fontWeight: typography.weightMedium }
const authFieldStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: `${spacing.md} ${spacing.lg}`, border: `1px solid ${colors.border}`, borderRadius: radius.lg, fontFamily: typography.fontSans, fontSize: typography.sizeMd }
const authSubmitStyle: React.CSSProperties = { width: '100%', marginTop: spacing.xl, padding: spacing.md, border: 'none', borderRadius: radius.lg, background: colors.action, color: colors.surface, fontFamily: typography.fontSans, fontSize: typography.sizeMd, fontWeight: typography.weightSemibold, cursor: 'pointer' }