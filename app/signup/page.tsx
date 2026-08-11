'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { colors, typography, radius, spacing } from '@/lib/tokens'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async () => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.background }}>
      <div style={{ background: colors.surface, padding: spacing['4xl'], borderRadius: radius['2xl'], border: `1px solid ${colors.border}`, width: '400px' }}>
        <h1 style={{ ...typography.h1, marginBottom: spacing.sm }}>Pulse</h1>
        <p style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing['3xl'] }}>Create your account</p>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: `${spacing.md} ${spacing.lg}`, border: `1px solid ${colors.border}`, borderRadius: radius.lg, marginBottom: spacing.md, fontSize: typography.sizeMd, boxSizing: 'border-box', fontFamily: typography.fontSans }} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSignup()}
          style={{ width: '100%', padding: `${spacing.md} ${spacing.lg}`, border: `1px solid ${colors.border}`, borderRadius: radius.lg, marginBottom: spacing.lg, fontSize: typography.sizeMd, boxSizing: 'border-box', fontFamily: typography.fontSans }} />
        {error && <p style={{ color: colors.error, fontSize: typography.sizeBase, marginBottom: spacing.md }}>{error}</p>}
        <button onClick={handleSignup} disabled={loading}
          style={{ width: '100%', padding: spacing.md, background: colors.action, color: colors.surface, border: 'none', borderRadius: radius.lg, fontSize: typography.sizeMd, fontWeight: typography.weightMedium, cursor: 'pointer', fontFamily: typography.fontSans }}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
        <p style={{ textAlign: 'center', marginTop: spacing.lg, ...typography.bodySmall, color: colors.textSecondary }}>
          Already have an account? <a href="/login" style={{ color: colors.crimson }}>Sign in</a>
        </p>
      </div>
    </main>
  )
}