import Link from 'next/link'
import TenantSwitcher from '@/components/layout/TenantSwitcher'
import DemoBanner from '@/components/ui/DemoBanner'
import { colors, typography, radius, spacing } from '@/lib/tokens'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: typography.fontSans }}>
      {/* Sidebar */}
      <aside style={{ width: '220px', background: colors.action, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh' }}>
        <div style={{ padding: '24px 20px 16px', borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
          <span style={{ color: colors.surface, fontSize: typography.sizeXl, fontWeight: typography.weightBold, letterSpacing: '0.02em' }}>Pulse</span>
        </div>
        <TenantSwitcher />
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {[
            { href: '/dashboard', label: 'Dashboard' },
            { href: '/dashboard/contacts', label: 'Contacts' },
            { href: '/dashboard/inbox', label: 'Inbox' },
            { href: '/dashboard/history', label: 'Campaigns' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} style={{ display: 'block', padding: '9px 12px', borderRadius: radius.lg, color: colors.textMuted, textDecoration: 'none', fontSize: typography.sizeMd, marginBottom: '2px' }}>
              {label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: '12px 8px', borderTop: `1px solid rgba(255,255,255,0.08)` }}>
          <div style={{ padding: '0 12px 6px', ...typography.helper, color: colors.textSecondary }}>Brand</div>
          <Link href="/dashboard/design" style={{ display: 'block', padding: '9px 12px', borderRadius: radius.lg, color: colors.textMuted, textDecoration: 'none', fontSize: typography.sizeMd, marginBottom: '2px' }}>
            Design System
          </Link>
        </div>
        <div style={{ padding: '12px 8px 12px 8px', borderTop: `1px solid rgba(255,255,255,0.08)` }}>
          <Link href="/dashboard/settings" style={{ display: 'block', padding: '9px 12px', borderRadius: radius.lg, color: colors.textMuted, textDecoration: 'none', fontSize: typography.sizeMd }}>
            Settings
          </Link>
        </div>
      </aside>
      {/* Main content */}
      <main style={{ marginLeft: '220px', flex: 1, background: colors.background, color: colors.text }}>
        <DemoBanner />
        {children}
      </main>
    </div>
  )
}
