'use client'


import { BackControl } from '@/components/ui/BackControl'
import { Button } from '@/components/ui/Button'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { colors, radius, spacing, typography } from '@/lib/tokens'

function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    const linkError = searchParams.get('error')
    if (linkError) setError(linkError)
  }, [searchParams])

  const send = async () => {
    if (loading || !email.trim()) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid staff email address.')
    setLoading(true)
    setError('')
    try {
    const response = await fetch('/api/account/recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    if (!response.ok) throw new Error('Could not request the email.')
    setMessage('Request received. For your privacy, this does not confirm that an account exists or an email was sent. Eligible accounts receive a setup or reset email. Check spam and open only the newest link. If nothing arrives, an Owner or Admin must check your sign-in email and staff access link; repeatedly requesting links will not fix an unlinked account.')
    } catch {
      setError('We could not request a link. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={authPageStyle}><section style={authCardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}><BackControl href="/login" label="Back to sign in" /><h1 style={{ ...typography.h1, margin: 0 }}>Set up or reset your password</h1></div>
      <p style={{ ...typography.body, color: colors.textSecondary }}>Enter your staff email to request a fresh link. This works for first-time setup and existing accounts.</p>
      <label style={authLabelStyle}>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void send() }} autoComplete="email" style={authFieldStyle} /></label>
      {message && <p role="status" style={{ color: colors.success, ...typography.bodySmall }}>{message}</p>}
      {error && <p role="alert" style={{ color: colors.error, ...typography.bodySmall }}>{error}</p>}
      <Button variant="secondary" size="sm" type="button" onClick={() => void send()} disabled={loading || !email.trim()} style={{ width: '100%', marginTop: spacing.xl }}>{loading ? 'Sending…' : 'Send fresh link'}</Button>

    </section></main>
  )
}

export default function ForgotPasswordPage() {
  return <Suspense fallback={<main style={authPageStyle}><section style={authCardStyle}>Loading…</section></main>}><ForgotPasswordForm /></Suspense>
}

const authPageStyle: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.background, padding: spacing.lg }
const authCardStyle: React.CSSProperties = { width: 'min(100%, 440px)', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius['2xl'], padding: spacing['4xl'], boxShadow: '0 18px 50px rgba(20, 30, 34, 0.08)' }
const authLabelStyle: React.CSSProperties = { display: 'grid', gap: spacing.xs, fontFamily: typography.fontSans, fontSize: typography.sizeSm, fontWeight: typography.weightMedium }
const authFieldStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: `${spacing.md} ${spacing.lg}`, border: `1px solid ${colors.border}`, borderRadius: radius.lg, fontFamily: typography.fontSans, fontSize: typography.sizeMd }
const authSubmitStyle: React.CSSProperties = { width: '100%', marginTop: spacing.xl, padding: spacing.md, border: 'none', borderRadius: radius.lg, background: colors.action, color: colors.surface, fontFamily: typography.fontSans, fontSize: typography.sizeMd, fontWeight: typography.weightSemibold, cursor: 'pointer' }
