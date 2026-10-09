'use client'


import { Button } from '@/components/ui/Button'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { colors, radius, spacing, typography } from '@/lib/tokens'
import { setActiveTenantId } from '@/lib/tenant'

type Teacher = { instructorId: string; displayName: string; accountClaimed: boolean }
const LOGO_URL = 'https://res.cloudinary.com/diy08lj9x/image/upload/v1780713493/Asset_1_2x_a5hm0v.png'

function safeNext(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/dashboard'
}

function LoginForm() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [instructorId, setInstructorId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingTeachers, setLoadingTeachers] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedTeacher = useMemo(
    () => teachers.find(teacher => teacher.instructorId === instructorId) || null,
    [instructorId, teachers],
  )

  useEffect(() => {
    const linkError = searchParams.get('error')
    if (linkError) setError(linkError)
  }, [searchParams])

  useEffect(() => {
    let mounted = true
    fetch('/api/access/teachers')
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Could not load staff accounts.')
        if (mounted) setTeachers(body)
      })
      .catch(requestError => {
        if (mounted) setError(requestError instanceof Error ? requestError.message : 'Could not load staff accounts.')
      })
      .finally(() => { if (mounted) setLoadingTeachers(false) })
    return () => { mounted = false }
  }, [])

  const submit = async () => {
    if (!instructorId || !password) return setError('Choose your name and enter your password.')
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/access/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructorId, password }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not sign in.')
      if (typeof body.tenantId === 'string') setActiveTenantId(body.tenantId)
      router.push(safeNext(searchParams.get('next')))
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={pageStyle}>
      <div style={loginStackStyle}>
        <section style={cardStyle}>
          {/* The brand asset is remotely managed and intentionally rendered at its intrinsic aspect ratio. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Headliner Music Academy" src={LOGO_URL} style={{ display: 'block', width: 'min(100%, 250px)', height: 'auto', margin: '0 auto 30px' }} />
          <div style={{ display: 'grid', gap: spacing.lg }}>
            <label style={labelStyle}>
              Your name
              <select
                value={instructorId}
                onChange={event => { setInstructorId(event.target.value); setPassword(''); setError('') }}
                disabled={loading || loadingTeachers}
                style={fieldStyle}
                autoComplete="username"
              >
                <option value="">{loadingTeachers ? 'Loading staff…' : 'Select your name'}</option>
                {teachers.map(teacher => (
                  <option key={teacher.instructorId} value={teacher.instructorId}>
                    {teacher.accountClaimed ? `✓ ${teacher.displayName}` : teacher.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Password
              <input
                type="password"
                inputMode={selectedTeacher?.accountClaimed ? 'text' : 'numeric'}
                value={password}
                onChange={event => setPassword(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter') void submit() }}
                autoComplete="current-password"
                style={fieldStyle}
              />
              {!selectedTeacher?.accountClaimed && <span style={hintStyle}>Enter door code</span>}
            </label>
            {selectedTeacher?.accountClaimed && (
              <a href="/forgot-password" style={forgotStyle}>Forgot your password?</a>
            )}
          </div>
          {error && <p role="alert" style={errorStyle}>{error}</p>}
          <Button variant="secondary" size="sm" type="button" onClick={() => void submit()} disabled={loading || loadingTeachers || teachers.length === 0} style={{ width: '100%', marginTop: spacing.xl }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </section>
        <a href="/demo" style={demoLinkStyle}>Or explore the demo.</a>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return <Suspense fallback={<main style={pageStyle}><section style={cardStyle}>Loading…</section></main>}><LoginForm /></Suspense>
}

const pageStyle: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.background, padding: spacing.lg }
const loginStackStyle: React.CSSProperties = { width: 'min(100%, 440px)', display: 'grid', gap: spacing.lg, justifyItems: 'stretch' }
const cardStyle: React.CSSProperties = { background: colors.surface, padding: spacing['4xl'], borderRadius: radius['2xl'], border: `1px solid ${colors.border}`, boxShadow: '0 18px 50px rgba(20, 30, 34, 0.08)', width: 'min(100%, 440px)' }
const labelStyle: React.CSSProperties = { display: 'grid', gap: spacing.xs, color: colors.text, fontFamily: typography.fontSans, fontSize: typography.sizeSm, fontWeight: typography.weightMedium }
const fieldStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: `${spacing.md} ${spacing.lg}`, border: `1px solid ${colors.border}`, borderRadius: radius.lg, background: colors.surface, color: colors.text, fontSize: typography.sizeMd, fontFamily: typography.fontSans }
const hintStyle: React.CSSProperties = { color: colors.textMuted, fontSize: typography.sizeXs, fontWeight: typography.weightNormal, lineHeight: 1.4 }
const forgotStyle: React.CSSProperties = { color: colors.crimson, fontFamily: typography.fontSans, fontSize: typography.sizeSm, textDecoration: 'none', justifySelf: 'start' }
const errorStyle: React.CSSProperties = { color: colors.error, fontFamily: typography.fontSans, fontSize: typography.sizeSm, margin: `${spacing.md} 0 0` }
const submitStyle: React.CSSProperties = { width: '100%', padding: spacing.md, marginTop: spacing.xl, background: colors.action, color: colors.surface, border: 'none', borderRadius: radius.lg, fontSize: typography.sizeMd, fontWeight: typography.weightSemibold, cursor: 'pointer', fontFamily: typography.fontSans }
const demoLinkStyle: React.CSSProperties = { color: colors.tealDark, fontFamily: typography.fontSans, fontSize: typography.sizeSm, lineHeight: 1.5, textAlign: 'center', textUnderlineOffset: 3 }