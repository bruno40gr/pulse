'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { colors, radius, spacing, typography } from '@/lib/tokens'

type Teacher = {
  instructorId: string
  displayName: string
}

const LOGO_URL = 'https://res.cloudinary.com/diy08lj9x/image/upload/v1780713493/Asset_1_2x_a5hm0v.png'

export default function LoginPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [instructorId, setInstructorId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/access/teachers')
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Could not load teachers.')
        setTeachers(body)
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Could not load teachers.'))
  }, [])

  const handleLogin = async () => {
    if (!instructorId || !password) {
      setError('Choose your name and enter the password.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/access/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructorId, password }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not enter Pulse.')
      const nextPath = new URLSearchParams(window.location.search).get('next')
      router.push(nextPath || '/dashboard')
      router.refresh()
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Could not enter Pulse.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.background, padding: spacing.lg }}>
      <section style={{ background: colors.surface, padding: spacing['4xl'], borderRadius: radius['2xl'], border: `1px solid ${colors.border}`, boxShadow: '0 18px 50px rgba(20, 30, 34, 0.08)', width: 'min(100%, 420px)' }}>
        <img alt="Headliner Music Academy" src={LOGO_URL} style={{ display: 'block', width: 'min(100%, 250px)', height: 'auto', margin: '0 auto 36px' }} />
        <div style={{ display: 'grid', gap: spacing.lg }}>
          <label style={labelStyle}>
            Your name
            <select value={instructorId} onChange={(event) => setInstructorId(event.target.value)} disabled={loading || teachers.length === 0} style={fieldStyle}>
              <option value="">Select your name</option>
              {teachers.map((teacher) => <option key={teacher.instructorId} value={teacher.instructorId}>{teacher.displayName}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void handleLogin() }} autoComplete="current-password" style={fieldStyle} />
            <span style={passwordHintStyle}>The 4 digit alarm code</span>
          </label>
        </div>
        {error && <p role="alert" style={{ color: colors.error, fontSize: typography.sizeSm, margin: `${spacing.md} 0 0` }}>{error}</p>}
        <button type="button" onClick={() => void handleLogin()} disabled={loading || teachers.length === 0} style={{ width: '100%', padding: spacing.md, marginTop: spacing.xl, background: colors.action, color: colors.surface, border: 'none', borderRadius: radius.lg, fontSize: typography.sizeMd, fontWeight: typography.weightSemibold, cursor: loading ? 'wait' : 'pointer', fontFamily: typography.fontSans, opacity: loading || teachers.length === 0 ? 0.65 : 1 }}>
          {loading ? 'Entering Pulse…' : 'Enter Pulse'}
        </button>
      </section>
    </main>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: spacing.xs,
  color: colors.text,
  fontFamily: typography.fontSans,
  fontSize: typography.sizeSm,
  fontWeight: typography.weightMedium,
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: `${spacing.md} ${spacing.lg}`,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  background: colors.surface,
  color: colors.text,
  fontSize: typography.sizeMd,
  fontFamily: typography.fontSans,
}

const passwordHintStyle: React.CSSProperties = {
  color: colors.textMuted,
  fontSize: typography.sizeSm,
  fontWeight: typography.weightNormal,
}