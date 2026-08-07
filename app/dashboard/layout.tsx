import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TenantSwitcher from '@/components/layout/TenantSwitcher'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      {/* Sidebar */}
      <aside style={{ width: '220px', background: '#1A1A1A', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh' }}>
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #2A2A2A' }}>
          <span style={{ color: 'white', fontSize: '18px', fontWeight: 700, letterSpacing: '0.02em' }}>Pulse</span>
        </div>
        <TenantSwitcher />
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {[
            { href: '/dashboard', label: 'Dashboard' },
            { href: '/dashboard/contacts', label: 'Contacts' },
            { href: '/dashboard/inbox', label: 'Inbox' },
            { href: '/dashboard/history', label: 'History' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} style={{ display: 'block', padding: '9px 12px', borderRadius: '8px', color: '#A0A0A0', textDecoration: 'none', fontSize: '14px', marginBottom: '2px' }}>
              {label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: '12px 8px', borderTop: '1px solid #2A2A2A' }}>
          <div style={{ padding: '0 12px 6px', fontSize: '10px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Brand</div>
          <Link href="/dashboard/design" style={{ display: 'block', padding: '9px 12px', borderRadius: '8px', color: '#A0A0A0', textDecoration: 'none', fontSize: '14px', marginBottom: '2px' }}>
            Design System
          </Link>
        </div>
        <div style={{ padding: '12px 8px 12px 8px', borderTop: '1px solid #2A2A2A' }}>
          <Link href="/dashboard/settings" style={{ display: 'block', padding: '9px 12px', borderRadius: '8px', color: '#A0A0A0', textDecoration: 'none', fontSize: '14px' }}>
            Settings
          </Link>
        </div>
      </aside>
      {/* Main content */}
      <main style={{ marginLeft: '220px', flex: 1, background: '#FAFAF9', color: '#1A1A1A' }}>
        {children}
      </main>
    </div>
  )
}