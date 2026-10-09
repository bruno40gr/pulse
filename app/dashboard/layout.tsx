'use client'


import { ControlButton } from '@/components/ui/ControlButton'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import TenantBrand from '@/components/layout/TenantBrand'
import LogoutButton from '@/components/layout/LogoutButton'
import IdentityProvider from '@/components/layout/IdentityProvider'
import DemoBanner from '@/components/ui/DemoBanner'
import { ClaimReminderModal } from '@/components/account/ClaimReminderModal'
import { colors, typography, radius, spacing } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'
import { applyDisplayFontSize, readDisplayFontSize } from '@/lib/display-preferences'
import NotificationBell from '@/components/notifications/NotificationBell'
import { getActiveTenantId } from '@/lib/tenant'

const CONVERSATION_COUNT_EVENT = 'pulse:conversation-count-changed'

const NAV_GROUPS = [
  {
    label: 'Operations',
    links: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/dashboard/leads', label: 'Leads' },
      { href: '/dashboard/notes', label: 'Notes' },
      { href: '/dashboard/contacts', label: 'Contacts' },
      { href: '/dashboard/inbox', label: 'Conversations' },
      { href: '/dashboard/history', label: 'Campaigns' },
      { href: '/dashboard/staff', label: 'Staff' },
    ],
  },
  {
    label: 'Funding',
    links: [
      { href: '/dashboard/funding/students', label: 'Funded Students' },
      { href: '/dashboard/funding/programs', label: 'Funding Programs' },
    ],
  },
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

  // Mounts after login (including personal-auth redirects); entering Conversations
  // also checks. The server shares one five-minute throttle across all staff.
  const pathname = usePathname()
  const recoveryChecked = useRef(false)
  useEffect(() => {
    if (recoveryChecked.current && pathname !== '/dashboard/inbox') return
    recoveryChecked.current = true
    void fetch(`/api/inbox/reconcile?tenant=${getActiveTenantId()}`, { method: 'POST' })
      .then(response => {
        if (!response.ok && response.status !== 403) console.warn('Message recovery check unavailable.')
      }).catch(() => console.warn('Message recovery check unavailable.'))
  }, [pathname])

  useEffect(() => {
    applyDisplayFontSize(readDisplayFontSize())
    return () => {
      document.documentElement.style.fontSize = ''
    }
  }, [])

  const closeMenu = () => setMenuOpen(false)

  return (
    <IdentityProvider>
    <div style={{ display: 'flex', width: '100%', minWidth: 0, minHeight: '100vh', fontFamily: typography.fontSans }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside style={{ width: '220px', background: colors.action, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh' }}>
          <SidebarBody onNavigate={closeMenu} />
        </aside>
      )}

      {/* Mobile top bar */}
      {isMobile && (
        <header style={{ position: 'fixed', top: 0, left: 0, right: 0, minHeight: '72px', background: colors.action, display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', boxSizing: 'border-box', zIndex: 30 }}>
          <ControlButton kind="icon" type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" >
            <Menu size={22} />
          </ControlButton>
          <div style={{ flex: '0 1 110px', minWidth: 0 }}><TenantBrand height={28} maxWidth="100%" width="100%" /></div>
          <div style={{ flex: 1, minWidth: 0 }}><NotificationBell inverse variant="user" onNavigate={closeMenu} /></div>
        </header>
      )}

      {/* Mobile drawer */}
      {isMobile && menuOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} onClick={closeMenu} />
          <div style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: 'min(280px, 85vw)', background: colors.action, zIndex: 50, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <TenantBrand height={32} maxWidth="70%" width="70%" />
              <ControlButton kind="icon" type="button" onClick={closeMenu} aria-label="Close menu" >
                <X size={20} />
              </ControlButton>
            </div>
            <SidebarBody onNavigate={closeMenu} showBrand={false} />
          </div>
        </>
      )}

      {/* Main content */}
      <main style={{ marginLeft: isMobile ? 0 : '220px', paddingTop: isMobile ? '72px' : 0, flex: '1 1 0%', minWidth: 0, maxWidth: isMobile ? '100%' : 'calc(100% - 220px)', background: colors.background, color: colors.text }}>
        <DemoBanner />
        {children}
      </main>
      <ClaimReminderModal />
    </div>
    </IdentityProvider>
  )
}

function SidebarBody({ onNavigate, showBrand = true }: { onNavigate: () => void; showBrand?: boolean }) {
  const pathname = usePathname()
  const [conversationCount, setConversationCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    let countRevision = 0
    const pendingReads = new Set<string>()
    const loadCount = async () => {
      if (pendingReads.size > 0) return
      const revision = ++countRevision
      try {
        const tenantId = getActiveTenantId()
        const response = await fetch(`/api/inbox?tenant=${tenantId}&count_only=1`, { cache: 'no-store' })
        const data = await response.json()
        if (!cancelled && response.ok && revision === countRevision && pendingReads.size === 0) setConversationCount(typeof data.count === 'number' ? data.count : 0)
      } catch {}
    }

    void loadCount()
    const interval = window.setInterval(loadCount, 5000)
    const handleCountChange = (event: Event) => {
      countRevision += 1
      if (event instanceof CustomEvent && typeof event.detail?.threadKey === 'string') {
        if (event.detail.pending) pendingReads.add(event.detail.threadKey)
        else pendingReads.delete(event.detail.threadKey)
      }
      const delta = event instanceof CustomEvent && typeof event.detail?.delta === 'number'
        ? event.detail.delta
        : null
      if (delta === null) {
        void loadCount()
        return
      }
      setConversationCount((current) => Math.max(0, current + delta))
      if (pendingReads.size === 0) void loadCount()
    }
    window.addEventListener(CONVERSATION_COUNT_EVENT, handleCountChange)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener(CONVERSATION_COUNT_EVENT, handleCountChange)
    }
  }, [])

  return (
    <>
      {showBrand && (
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}><TenantBrand height={36} maxWidth="100%" width="100%" /></div>
          </div>
        </div>
      )}
      <nav style={{ flex: 1, padding: '12px 8px' }}>
        {NAV_GROUPS.map(group => (
          <div key={group.label} style={{ marginTop: spacing.md }}>
            <div style={{ padding: '0 12px 6px', color: 'rgba(255,255,255,0.48)', fontSize: typography.sizeXs, fontWeight: typography.weightSemibold }}>{group.label}</div>
            {group.links.map(({ href, label }) => {
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{label}</span>
                    {href === '/dashboard/inbox' && conversationCount > 0 && (
                      <span aria-label={`${conversationCount} unread messages`} title={`${conversationCount} unread messages`} style={{ minWidth: 19, height: 19, padding: '0 5px', borderRadius: radius.full, background: colors.crimson, color: '#fff', fontSize: 10, fontWeight: typography.weightBold, lineHeight: '19px', textAlign: 'center' }}>
                        {conversationCount}
                      </span>
                    )}
                  </span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <div style={{ padding: '12px 8px 12px 8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <NotificationBell inverse variant="user" onNavigate={onNavigate} />
        <Link
          href="/dashboard/settings"
          onClick={onNavigate}
          style={{
            ...navLinkStyle,
            ...(isNavLinkActive('/dashboard/settings', pathname)
              ? { background: 'rgba(255,255,255,0.08)', color: colors.surface, fontWeight: typography.weightSemibold }
              : {}),
          }}
        >
          Settings
        </Link>
        <LogoutButton onLogout={onNavigate} />
      </div>
    </>
  )
}

