'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TENANT_BRAND, setActiveTenantId } from '@/lib/tenant'
import { colors, radius, shadows, spacing, typography } from '@/lib/tokens'
import { trackDemoEvent } from '@/lib/demo-analytics'

type Teacher = {
  instructorId: string
  displayName: string
}

const HEADLINER_BLACK_LOGO_URL = 'https://res.cloudinary.com/diy08lj9x/image/upload/v1780713493/Asset_1_2x_a5hm0v.png'
const KUMON_LOGO_URL = 'https://res.cloudinary.com/diy08lj9x/image/upload/v1790272843/191492c8-47a8-47ea-a108-153f4f2efa41.png'

const demos = [
  {
    tenantId: TENANT_BRAND.kumon.id,
    name: 'Kumon',
    logoUrl: KUMON_LOGO_URL,
    environmentName: 'Kumon Academy',
    invertLogo: false,
  },
  {
    tenantId: TENANT_BRAND.sacramentoMartialArts.id,
    name: 'Cobra Kai',
    logoUrl: TENANT_BRAND.sacramentoMartialArts.logoUrl,
    environmentName: 'Cobra Kai',
    invertLogo: true,
  },
] as const

export default function GatePage() {
  const router = useRouter()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [launchingTenant, setLaunchingTenant] = useState<string | null>(null)
  const [instructorId, setInstructorId] = useState('')
  const [password, setPassword] = useState('')
  const [staffError, setStaffError] = useState('')
  const [staffLoading, setStaffLoading] = useState(false)
  const [demoError, setDemoError] = useState('')

  useEffect(() => {
    fetch('/api/access/teachers')
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Could not load teachers.')
        setTeachers(body)
      })
      .catch((error) => setStaffError(error instanceof Error ? error.message : 'Could not load teachers.'))
  }, [])

  const handleDemo = async (tenantId: string, environmentName: string) => {
    setLaunchingTenant(tenantId)
    setDemoError('')
    try {
      const response = await fetch('/api/access/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not open this demo.')

      setActiveTenantId(tenantId)
      await trackDemoEvent({ eventType: 'demo_environment_selected', tenantId, path: '/demo', metadata: { environmentName } })
      router.push('/demo')
      router.refresh()
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : 'Could not open this demo.')
      setLaunchingTenant(null)
    }
  }

  const handleStaffLogin = async () => {
    if (!instructorId || !password) {
      setStaffError('Choose your name and enter the password.')
      return
    }

    setStaffLoading(true)
    setStaffError('')
    try {
      const response = await fetch('/api/access/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructorId, password }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not enter Pulse.')
      setActiveTenantId(TENANT_BRAND.headliner.id)
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : 'Could not enter Pulse.')
    } finally {
      setStaffLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.background, padding: spacing.lg }}>
      <style>{`@media (max-width: 980px) { .demo-gate-grid { grid-template-columns: 1fr !important; max-width: 420px; margin: 0 auto; } }`}</style>
      <section className="demo-gate-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 420px))', gap: spacing.xl, width: 'min(100%, 1300px)', alignItems: 'stretch' }}>
        {demos.map((demo) => (
          <section key={demo.tenantId} style={cardStyle}>
            <div style={logoAreaStyle}>
              <img alt={demo.name} src={demo.logoUrl} style={{ display: 'block', width: 'min(100%, 250px)', height: 'auto', maxHeight: '86px', objectFit: 'contain', ...(demo.invertLogo ? { filter: 'invert(1)' } : {}) }} />
            </div>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => void handleDemo(demo.tenantId, demo.environmentName)} disabled={launchingTenant !== null} style={buttonStyle(launchingTenant !== null)}>
              {launchingTenant === demo.tenantId ? 'Opening…' : 'Play with Demo'}
            </button>
          </section>
        ))}

        <section style={cardStyle}>
          <div style={logoAreaStyle}>
            <img alt="Headliner Music Academy" src={HEADLINER_BLACK_LOGO_URL} style={{ display: 'block', width: 'min(100%, 250px)', height: 'auto' }} />
          </div>
          <div style={{ display: 'grid', gap: spacing.lg }}>
            <label style={labelStyle}>
              Your name
              <select value={instructorId} onChange={(event) => setInstructorId(event.target.value)} disabled={staffLoading || teachers.length === 0} style={fieldStyle}>
                <option value="">Select your name</option>
                {teachers.map((teacher) => <option key={teacher.instructorId} value={teacher.instructorId}>{teacher.displayName}</option>)}
              </select>
            </label>
            <label style={labelStyle}>
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void handleStaffLogin() }} autoComplete="current-password" style={fieldStyle} />
              <span style={passwordHintStyle}>The 4 digit alarm code</span>
            </label>
          </div>
          {staffError && <p role="alert" style={{ color: colors.error, fontSize: typography.sizeSm, margin: `${spacing.md} 0 0` }}>{staffError}</p>}
          <button type="button" onClick={() => void handleStaffLogin()} disabled={staffLoading || teachers.length === 0} style={{ ...buttonStyle(staffLoading || teachers.length === 0), marginTop: spacing.xl }}>
            {staffLoading ? 'Entering…' : 'Enter'}
          </button>
        </section>
      </section>
      {demoError && <p role="alert" style={{ position: 'fixed', bottom: spacing.xl, color: colors.error, fontSize: typography.sizeSm }}>{demoError}</p>}
    </main>
  )
}

const cardStyle: React.CSSProperties = {
  background: colors.surface,
  padding: spacing['4xl'],
  borderRadius: radius['2xl'],
  border: `1px solid ${colors.border}`,
  boxShadow: shadows.md,
  minHeight: '360px',
  display: 'flex',
  flexDirection: 'column',
}

const logoAreaStyle: React.CSSProperties = {
  height: '118px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: spacing.xl,
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

const buttonStyle = (disabled: boolean): React.CSSProperties => ({
  width: '100%',
  padding: spacing.md,
  background: colors.action,
  color: colors.surface,
  border: 'none',
  borderRadius: radius.lg,
  fontSize: typography.sizeMd,
  fontWeight: typography.weightSemibold,
  cursor: disabled ? 'wait' : 'pointer',
  fontFamily: typography.fontSans,
  opacity: disabled ? 0.65 : 1,
})
