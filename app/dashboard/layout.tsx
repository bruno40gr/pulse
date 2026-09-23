'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import TenantSwitcher from '@/components/layout/TenantSwitcher'
import TenantBrand from '@/components/layout/TenantBrand'
import DemoBanner from '@/components/ui/DemoBanner'
import { colors, typography, radius } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/leads', label: 'Leads' },
  { href: '/dashboard/notes', label: 'Notes' },
  { href: '/dashboard/contacts', label: 'Contacts' },
  { href: '/dashboard/inbox', label: 'Conversations' },
  { href: '/dashboard/history', label: 'Campaigns' },
  { href: '/dashboard/staff', label: 'Staff' },
]

const navLinkStyle: React.CSSProperties = {
  display: 'block',
  padding: '9px 12px',
  borderRadius: radius.lg,
  color: colors.textMuted,
  textDecoration: 'none',
  fontSize: typography.sizeMd,
  marginBottom: '2px',
}

function isNavLinkActive(href: string, pathname: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: typography.fontSans }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside style={{ width: '220px', background: colors.action, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh' }}>
          <SidebarBody onNavigate={closeMenu} />
        </aside>
      )}

      {/* Mobile top bar */}
      {isMobile && (
        <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '56px', background: colors.action, display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px', zIndex: 30 }}>
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" style={{ background: 'transparent', border: 'none', color: colors.textMuted, cursor: 'pointer', display: 'flex', padding: '4px' }}>
            <Menu size={22} />
          </button>
          <TenantBrand height={28} maxWidth="150px" width="150px" />
        </header>
      )}

      {/* Mobile drawer */}
      {isMobile && menuOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} onClick={closeMenu} />
          <div style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: 'min(280px, 85vw)', background: colors.action, zIndex: 50, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <TenantBrand height={32} maxWidth="70%" width="70%" />
              <button type="button" onClick={closeMenu} aria-label="Close menu" style={{ background: 'transparent', border: 'none', color: colors.textMuted, cursor: 'pointer', display: 'flex', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            <SidebarBody onNavigate={closeMenu} showBrand={false} />
          </div>
        </>
      )}

      {/* Main content */}
      <main style={{ marginLeft: isMobile ? 0 : '220px', paddingTop: isMobile ? '56px' : 0, flex: 1, background: colors.background, color: colors.text }}>
        <DemoBanner />
        {children}
      </main>
    </div>
  )
}

function SidebarBody({ onNavigate, showBrand = true }: { onNavigate: () => void; showBrand?: boolean }) {
  const pathname = usePathname()
  return (
    <>
      {showBrand && (
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <TenantBrand height={36} maxWidth="100%" width="100%" />
        </div>
      )}
      <TenantSwitcher />
      <nav style={{ flex: 1, padding: '12px 8px' }}>
        {NAV_LINKS.map(({ href, label }) => {
          const active = isNavLinkActive(href, pathname)
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              style={{
                ...navLinkStyle,
                ...(active
                  ? { background: 'rgba(255,255,255,0.08)', color: colors.surface, fontWeight: typography.weightSemibold }
                  : {}),
              }}
            >
              {label}
            </Link>
          )
        })}
      </nav>
      <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ padding: '0 12px 6px', ...typography.helper, color: colors.textSecondary }}>Brand</div>
        <Link href="/dashboard/design" onClick={onNavigate} style={navLinkStyle}>
          Design System
        </Link>
      </div>
      <div style={{ padding: '12px 8px 12px 8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Link href="/dashboard/settings" onClick={onNavigate} style={{ ...navLinkStyle, marginBottom: 0 }}>
          Settings
        </Link>
      </div>
    </>
  )
}

