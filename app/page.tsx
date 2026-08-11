import Link from 'next/link'
import { colors, typography, radius, spacing } from '@/lib/tokens'

export default function LandingPage() {
  return (
    <main style={{ minHeight: '100vh', background: colors.action, display: 'flex', flexDirection: 'column', fontFamily: typography.fontSans }}>
      {/* Nav */}
      <nav style={{ padding: '20px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: colors.surface, fontSize: typography.sizeXl, fontWeight: typography.weightBold, letterSpacing: '0.02em' }}>Pulse</span>
        <div style={{ display: 'flex', gap: spacing.lg, alignItems: 'center' }}>
          <Link href="/login" style={{ color: colors.textMuted, fontSize: typography.sizeMd, textDecoration: 'none' }}>Sign in</Link>
          <Link href="/signup" style={{ background: colors.crimson, color: colors.surface, padding: `${spacing.sm} ${spacing.xl}`, borderRadius: radius.lg, fontSize: typography.sizeMd, textDecoration: 'none', fontWeight: typography.weightMedium }}>Get started</Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 48px', textAlign: 'center' }}>
        <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: radius['2xl'], padding: `${spacing.xs} ${spacing.lg}`, marginBottom: spacing['3xl'], display: 'inline-block' }}>
          <span style={{ color: colors.textMuted, fontSize: typography.sizeBase }}>Smart SMS for small businesses</span>
        </div>
        <h1 style={{ fontSize: '64px', fontWeight: typography.weightBold, color: colors.surface, margin: '0 0 24px', lineHeight: 1.1, maxWidth: '800px' }}>
          Simple messaging for businesses built on relationships.
        </h1>
        <p style={{ fontSize: typography.sizeXl, color: colors.textSecondary, marginBottom: spacing['4xl'], maxWidth: '520px', lineHeight: 1.6 }}>
          Pulse helps your team reach students, parents, and customers with the information that matters. Write your message, describe who should receive it, and Pulse takes care of the rest. Designed for schools, studios, and small businesses where communication is personal and every message comes from a familiar voice.
        </p>
        <div style={{ display: 'flex', gap: spacing.lg }}>
          <Link href="/signup" style={{ background: colors.crimson, color: colors.surface, padding: `${spacing.lg} ${spacing['3xl']}`, borderRadius: radius.lg, fontSize: typography.sizeLg, textDecoration: 'none', fontWeight: typography.weightSemibold }}>
            Start for free
          </Link>
          <Link href="/demo" style={{ background: 'transparent', color: colors.surface, padding: `${spacing.lg} ${spacing['3xl']}`, borderRadius: radius.lg, fontSize: typography.sizeLg, textDecoration: 'none', fontWeight: typography.weightMedium, border: `1px solid rgba(255,255,255,0.12)` }}>
            Try the demo
          </Link>
        </div>
      </div>

      {/* How it works */}
      <div style={{ padding: '80px 48px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <h2 style={{ textAlign: 'center', color: colors.surface, fontSize: typography.size3xl, fontWeight: typography.weightSemibold, marginBottom: '64px' }}>How it works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['3xl'], maxWidth: '900px', margin: '0 auto' }}>
          {[
            { step: '01', title: 'Bring your contacts', body: 'Import the spreadsheet you already use. Pulse organizes your contacts and prepares them for messaging in just a few minutes.' },
            { step: '02', title: 'Tell Pulse who it\'s for', body: 'Tell Pulse who should receive it. Whether it\'s tomorrow\'s students, families with overdue invoices, or everyone taking piano lessons, Pulse identifies the right people and builds the recipient list for you.' },
            { step: '03', title: 'Send your message', body: 'Your message reaches exactly the people who need it, at the right time, from a business they already know and trust. Simple for your team. Clear for your customers.' },
          ].map(({ step, title, body }) => (
            <div key={step} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: radius['2xl'], padding: spacing['3xl'] }}>
              <div style={{ color: colors.crimson, fontSize: typography.sizeBase, fontWeight: typography.weightSemibold, marginBottom: spacing.lg }}>{step}</div>
              <h3 style={{ color: colors.surface, fontSize: typography.sizeXl, fontWeight: typography.weightSemibold, marginBottom: spacing.md }}>{title}</h3>
              <p style={{ color: colors.textSecondary, fontSize: typography.sizeMd, lineHeight: 1.6, margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div style={{ padding: '80px 48px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <h2 style={{ color: colors.surface, fontSize: typography.size3xl, fontWeight: typography.weightSemibold, marginBottom: spacing.lg }}>
          Never miss a reason to reach out
        </h2>
        <p style={{ color: colors.textSecondary, fontSize: typography.sizeXl, lineHeight: 1.6, maxWidth: '640px', margin: '0 auto' }}>
          Pulse uncovers meaningful opportunities to connect — from upcoming recitals and birthdays to milestones, renewals, missed lessons, and students who may need a little encouragement.
        </p>
      </div>

      {/* Footer */}
      <div style={{ padding: `${spacing['3xl']} 48px`, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: colors.textMuted, fontSize: typography.sizeBase }}>© 2026 Pulse by Layered Labs</span>
        <Link href="/login" style={{ color: colors.textMuted, fontSize: typography.sizeBase, textDecoration: 'none' }}>Sign in</Link>
      </div>
    </main>
  )
}