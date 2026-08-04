'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAF9' }}>
      <div style={{ background: 'white', padding: '48px', borderRadius: '16px', border: '1px solid #E8E8E4', width: '400px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px', fontFamily: 'sans-serif' }}>Pulse</h1>
        <p style={{ color: '#6B6B6B', marginBottom: '32px', fontSize: '14px', fontFamily: 'sans-serif' }}>Create your account</p>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #E8E8E4', borderRadius: '8px', marginBottom: '12px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'sans-serif' }} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSignup()}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #E8E8E4', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'sans-serif' }} />
        {error && <p style={{ color: '#DC2626', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}
        <button onClick={handleSignup} disabled={loading}
          style={{ width: '100%', padding: '10px', background: '#C8392B', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', fontFamily: 'sans-serif' }}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#6B6B6B', fontFamily: 'sans-serif' }}>
          Already have an account? <a href="/login" style={{ color: '#C8392B' }}>Sign in</a>
        </p>
      </div>
    </main>
  )
}