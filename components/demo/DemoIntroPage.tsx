'use client'

import { CSSProperties, useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui'
import { TENANT_BRAND, setActiveTenantId } from '@/lib/tenant'
import { colors, radius, shadows, spacing, typography } from '@/lib/tokens'
import { trackDemoEvent } from '@/lib/demo-analytics'

const demoEnvironments = [
  {
    tenantId: TENANT_BRAND.kumon.id,
    name: 'Try Kumon Academy',
    environmentName: 'Kumon Academy',
    accent: colors.teal,
  },
  {
    tenantId: TENANT_BRAND.sacramentoMartialArts.id,
    name: 'Try Cobra Kai',
    environmentName: 'Cobra Kai',
    accent: colors.crimson,
  },
] as const

const introCopy = 'Hey, Cohen helps your team reach students, parents, and customers with the information that matters. Built for schools, studios, and small businesses where communication is personal.'

const previewHighlights = [
  'Welcome a student back to class',
  'Customize messages with your brand and voice',
  'Track campaign performance and follow-up conversations',
] as const

const serifLogoStyle: CSSProperties = {
  fontSize: '32px',
  fontWeight: 600,
  letterSpacing: '-0.02em',
  lineHeight: 1,
  fontFamily: 'var(--font-pridi), serif',
  color: colors.text,
}

export default function DemoIntroPage({ overlay = false }: { overlay?: boolean }) {
  const router = useRouter()
  const [launchingTenant, setLaunchingTenant] = useState<string | null>(null)
  const [isExiting, setIsExiting] = useState(false)
  const [hoveredButton, setHoveredButton] = useState<string | null>(null)

  useEffect(() => {
    trackDemoEvent({ eventType: 'demo_intro_viewed', path: '/demo' })
  }, [])

  const handleLaunch = async (tenantId: string, environmentName: string) => {
    setIsExiting(true)
    setLaunchingTenant(tenantId)

    await new Promise(resolve => setTimeout(resolve, 260))

    await trackDemoEvent({
      eventType: 'demo_environment_selected',
      tenantId,
      path: '/demo',
      metadata: { environmentName },
    })

    setActiveTenantId(tenantId)

    await trackDemoEvent({
      eventType: 'demo_entered_app',
      tenantId,
      path: '/dashboard',
      metadata: { source: 'demo_intro' },
    })

    router.push('/dashboard')
  }

  return (
    <main
      style={{
        minHeight: overlay ? 'auto' : '100vh',
        fontFamily: typography.fontSans,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: overlay ? '32px' : '24px',
        position: overlay ? 'fixed' : 'relative',
        inset: overlay ? 0 : 'auto',
        zIndex: overlay ? 999 : 'auto',
        pointerEvents: overlay ? 'none' : 'auto',
      }}
    >
      {overlay && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            mixBlendMode: 'multiply',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            pointerEvents: 'none',
          }}
        />
      )}

      <section
        style={{
          position: 'relative',
          zIndex: 1,
          width: 'min(100%, 1120px)',
          maxHeight: '800px',
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius['2xl'],
          boxShadow: shadows.xl,
          padding: '40px',
          overflow: 'hidden',
          opacity: isExiting ? 0 : 1,
          transform: isExiting ? 'translateY(10px) scale(0.985)' : 'translateY(0) scale(1)',
          transition: 'opacity 260ms ease, transform 260ms ease',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ marginBottom: spacing['2xl'] }}>
          <span style={serifLogoStyle}>
            Hey, Cohen
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(340px, 0.92fr)', gap: spacing['4xl'], alignItems: 'center' }}>
          <div style={{ maxWidth: '420px', justifySelf: 'center' }}>
            <h1 style={{ ...typography.h1, color: colors.text, margin: `0 0 ${spacing.md}` }}>
              Simple messaging for businesses built on relationships.
            </h1>

            <p style={{ fontSize: typography.sizeLg, color: colors.textSecondary, lineHeight: 1.7, margin: `0 0 ${spacing['2xl']}` }}>
              {introCopy}
            </p>

            <div style={{ marginBottom: spacing['2xl'] }}>
              <div style={{ fontSize: typography.sizeLg, fontWeight: typography.weightBold, color: colors.text, marginBottom: spacing.md, letterSpacing: '-0.01em' }}>Try this</div>
              <div style={{ display: 'grid', gap: spacing.md }}>
                {previewHighlights.map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md, ...typography.body, color: colors.textSecondary }}>
                    <span style={{ color: colors.crimson, fontSize: '18px', lineHeight: 1.2 }}>✦</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.lg }}>
              {demoEnvironments.map((environment) => (
                <Button
                  key={environment.tenantId}
                  size="lg"
                  style={{
                    background: hoveredButton === environment.tenantId ? colors.crimsonDark : colors.crimson,
                    color: colors.surface,
                    justifyContent: 'center',
                    minHeight: '56px',
                    whiteSpace: 'nowrap',
                    fontSize: typography.sizeMd,
                    paddingInline: '18px',
                    transition: 'background 180ms ease, transform 180ms ease, box-shadow 180ms ease',
                    boxShadow: hoveredButton === environment.tenantId ? '0 10px 24px rgba(255, 0, 68, 0.24)' : '0 6px 18px rgba(255, 0, 68, 0.16)',
                    transform: hoveredButton === environment.tenantId ? 'translateY(-1px)' : 'translateY(0)',
                  }}
                  onClick={() => handleLaunch(environment.tenantId, environment.environmentName)}
                  onMouseEnter={() => setHoveredButton(environment.tenantId)}
                  onMouseLeave={() => setHoveredButton(current => (current === environment.tenantId ? null : current))}
                  disabled={launchingTenant !== null}
                >
                  {launchingTenant === environment.tenantId ? 'Opening demo...' : environment.name}
                  <ArrowRight size={16} />
                </Button>
              ))}
            </div>

            <div style={{ marginTop: spacing['2xl'], display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              <p style={{ ...typography.bodySmall, color: colors.textMuted, margin: 0 }}>
                Feel free to play around, send messages, and have fun. Everything in the demo is fictional.
              </p>
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              minHeight: '620px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                background: colors.background,
                borderRadius: '42px',
                overflow: 'hidden',
                height: '580px',
                boxShadow: shadows.lg,
                border: '10px solid #111827',
                width: 'min(100%, 330px)',
                margin: '0 auto',
                position: 'relative',
                zIndex: 2,
              }}
            >
              <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', width: 96, height: 20, borderRadius: radius.full, background: '#111827', zIndex: 3 }} />
              <div style={{ height: '100%', background: '#F2F2F7', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '18px 18px 10px', background: 'rgba(248,248,248,0.94)', borderBottom: '0.5px solid rgba(60,60,67,0.18)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#111827', marginBottom: 10 }}>
                    <span>9:41</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>􀙇</span>
                      <span>􀛨</span>
                      <span>100%</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: '#007AFF', fontSize: '18px', lineHeight: 1 }}>‹</span>
                    <Image
                      src="/demo-avatars/adult-woman-2.jpg"
                      alt="Maya Chen"
                      width={32}
                      height={32}
                      style={{ borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827', lineHeight: 1.2 }}>Maya</div>
                      <div style={{ fontSize: '12px', color: '#8E8E93', lineHeight: 1.2 }}>Text Message</div>
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, padding: '18px 14px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#FFFFFF' }}>
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <div style={{ background: '#E5E5EA', color: '#636366', borderRadius: radius.full, padding: '4px 10px', fontSize: '11px' }}>
                        Today 4:12 PM
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 4 }}>
                      <div style={{ position: 'relative', maxWidth: '86%' }}>
                        <div style={{ background: '#0A84FF', color: '#FFFFFF', borderRadius: '20px 20px 6px 20px', padding: '12px 14px', fontSize: '15px', lineHeight: 1.35, boxShadow: '0 1px 1px rgba(0,0,0,0.08)' }}>
                          Hey Maya! Come back to class this Wednesday. Ms. Rachel has a great next piece picked out for you.
                        </div>
                        <div style={{ position: 'absolute', left: 12, bottom: -16, background: '#FFFFFF', borderRadius: radius.full, boxShadow: '0 1px 2px rgba(0,0,0,0.14)', padding: '2px 6px', fontSize: '13px', lineHeight: 1 }}>
                          ❤️
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{ background: '#E5E5EA', color: '#8E8E93', borderRadius: '20px 20px 20px 6px', padding: '10px 14px', fontSize: '15px', lineHeight: 1, letterSpacing: '0.18em' }}>
                        . . .
                      </div>
                    </div>
                  </div>

                  <div style={{ paddingTop: 16 }}>
                    <div style={{ background: '#F2F2F7', borderRadius: '22px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#8E8E93', fontSize: '14px' }}>
                      <span>Message</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span>＋</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
