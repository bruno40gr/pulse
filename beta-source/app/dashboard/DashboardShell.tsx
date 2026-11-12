'use client'


import { ControlButton } from '@/beta-source/components/ui/ControlButton'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, Menu } from 'lucide-react'
import TenantBrand from '@/beta-source/components/layout/TenantBrand'
import { Button } from '@/beta-source/components/ui/Button'
import LogoutButton from '@/beta-source/components/layout/LogoutButton'
import IdentityProvider from '@/beta-source/components/layout/IdentityProvider'
import DemoBanner from '@/beta-source/components/ui/DemoBanner'
import { ClaimReminderModal } from '@/beta-source/components/account/ClaimReminderModal'
import { colors, typography, radius, spacing } from '@/beta-source/lib/tokens'
import { useIsMobile } from '@/beta-source/lib/useMediaQuery'
import { applyDisplayFontSize, readDisplayFontSize } from '@/beta-source/lib/display-preferences'
import NotificationBell from '@/beta-source/components/notifications/NotificationBell'
import { getActiveTenantId } from '@/beta-source/lib/tenant'
import { CONVERSATIONS_HOME_EVENT } from '@/beta-source/lib/conversation-display'
import { LEAD_COUNT_EVENT } from '@/beta-source/lib/lead-count'
import { startVisiblePolling } from '@/beta-source/lib/visible-polling'

const CONVERSATION_COUNT_EVENT = 'pulse:conversation-count-changed'

const NAV_GROUPS = [
  {
    label: 'Operations',
    links: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/dashboard/leads', label: 'Leads' },
      { href: '/dashboard/rsvps', label: 'Event RSVPs' },
      { href: '/dashboard/notes', label: 'Notes' },
      { href: '/dashboard/contacts', label: 'Contacts' },
      { href: '/dashboard/enrollments', label: 'Enrollments' },
      { href: '/dashboard/inbox', label: 'Communications' },
      { href: '/dashboard/history', label: 'Campaigns' },
      { href: '/dashboard/staff', label: 'Staff' },
      { href: '/dashboard/community', label: 'Community posts' },
      { href: '/dashboard/website-content', label: 'Website Content' },
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

export default function DashboardLayout({ children, sample = false }: { children: React.ReactNode; sample?: boolean }) {
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)

  // Mounts after login (including personal-auth redirects); entering Conversations
  // also checks. The server shares one five-minute throttle across all staff.
  const pathname = usePathname()
  const recoveryChecked = useRef(false)
  useEffect(() => {
    if (sample) return
    if (recoveryChecked.current && pathname !== '/dashboard/inbox') return
    recoveryChecked.current = true
    void fetch(`/api/inbox/reconcile?tenant=${getActiveTenantId()}`, { method: 'POST' })
      .then(response => {
        if (!response.ok && response.status !== 403) console.warn('Message recovery check unavailable.')
      }).catch(() => console.warn('Message recovery check unavailable.'))
  }, [pathname, sample])

  useEffect(() => {
    applyDisplayFontSize(readDisplayFontSize())
    return () => {
      document.documentElement.style.fontSize = ''
    }
  }, [])

  const closeMenu = () => setMenuOpen(false)

  return (
    <DashboardIdentity sample={sample}>
    <div style={{ display: 'flex', width: '100%', minWidth: 0, minHeight: '100vh', fontFamily: typography.fontSans }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside style={{ width: '220px', background: colors.action, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', overflow: 'hidden' }}>
          <SidebarBody onNavigate={closeMenu} sample={sample} />
        </aside>
      )}

      {/* Mobile top bar */}
      {isMobile && (
        <header style={{ position: 'fixed', top: 0, left: 0, right: 0, minHeight: '72px', background: colors.action, display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', boxSizing: 'border-box', zIndex: 30 }}>
          <ControlButton kind="icon" type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" >
            <Menu size={22} />
          </ControlButton>
          <div style={{ flex: '0 1 110px', minWidth: 0 }}><TenantBrand height={28} maxWidth="100%" width="100%" /></div>
          <div style={{ flex: 1, minWidth: 0 }}>{sample ? null : <NotificationBell inverse variant="user" onNavigate={closeMenu} />}</div>
        </header>
      )}

      {/* Mobile drawer */}
      {isMobile && menuOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} onClick={closeMenu} />
          <div style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: 'min(280px, 85vw)', background: colors.action, zIndex: 50, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <TenantBrand height={32} maxWidth="70%" width="70%" />
              <ControlButton kind="close" type="button" onClick={closeMenu} aria-label="Close menu"  />
            </div>
            <SidebarBody onNavigate={closeMenu} showBrand={false} sample={sample} />
          </div>
        </>
      )}

      {/* Main content */}
      <main style={{ marginLeft: isMobile ? 0 : '220px', paddingTop: isMobile ? '72px' : 0, flex: '1 1 0%', minWidth: 0, maxWidth: isMobile ? '100%' : 'calc(100% - 220px)', background: colors.background, color: colors.text }}>
        {!sample && <DemoBanner />}
        {children}
      </main>
      {!sample && <ClaimReminderModal />}
    </div>
    </DashboardIdentity>
  )
}

function DashboardIdentity({ sample, children }: { sample: boolean; children: React.ReactNode }) {
  return sample ? <>{children}</> : <IdentityProvider>{children}</IdentityProvider>
}

function SidebarBody({ onNavigate, showBrand = true, sample = false }: { onNavigate: () => void; showBrand?: boolean; sample?: boolean }) {
  const [canPublishWebsite, setCanPublishWebsite] = useState(false)
  useEffect(() => {
    if (sample) return
    const controller = new AbortController()
    fetch(`/api/account/me?tenant=${encodeURIComponent(getActiveTenantId())}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => { if (response.ok) { const data = await response.json(); setCanPublishWebsite(['owner', 'admin'].includes(data.roleKey)) } })
      .catch(() => {})
    return () => controller.abort()
  }, [sample])
  const pathname = usePathname()
  const [sampleQuery, setSampleQuery] = useState('')
  useEffect(() => { if (sample) setSampleQuery(window.location.search) }, [sample, pathname])
  const search = new URLSearchParams(sampleQuery)
  const [conversationCount, setConversationCount] = useState(0)
  const [leadCount, setLeadCount] = useState(0)

  useEffect(() => {
    if (sample) return
    let cancelled = false
    let revision = 0
    const poller = startVisiblePolling(async signal => {
      const requestRevision = ++revision
      const tenantId = getActiveTenantId()
      try {
        const response = await fetch(`/api/leads?tenant=${encodeURIComponent(tenantId)}&count_only=1`, { cache: 'no-store', signal })
        const data = await response.json()
        if (!cancelled && !signal.aborted && response.ok && requestRevision === revision && tenantId === getActiveTenantId()) {
          setLeadCount(Number.isSafeInteger(data.count) && data.count >= 0 ? data.count : 0)
        }
      } catch {}
    })
    const handleCountChange = () => { revision += 1; poller.refresh() }
    window.addEventListener(LEAD_COUNT_EVENT, handleCountChange)
    return () => {
      cancelled = true
      poller.stop()
      window.removeEventListener(LEAD_COUNT_EVENT, handleCountChange)
    }
  }, [sample])

  useEffect(() => {
    if (sample) return
    let cancelled = false
    let countRevision = 0
    const pendingReads = new Set<string>()
    const poller = startVisiblePolling(async signal => {
      if (pendingReads.size > 0) return
      const revision = ++countRevision
      const tenantId = getActiveTenantId()
      try {
        const response = await fetch(`/api/inbox?tenant=${tenantId}&count_only=1`, { cache: 'no-store', signal })
        const data = await response.json()
        if (!cancelled && !signal.aborted && response.ok && revision === countRevision && pendingReads.size === 0 && tenantId === getActiveTenantId()) setConversationCount(typeof data.count === 'number' ? data.count : 0)
      } catch {}
    })
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
        poller.refresh()
        return
      }
      setConversationCount((current) => Math.max(0, current + delta))
      if (pendingReads.size === 0) poller.refresh()
    }
    window.addEventListener(CONVERSATION_COUNT_EVENT, handleCountChange)
    return () => {
      cancelled = true
      poller.stop()
      window.removeEventListener(CONVERSATION_COUNT_EVENT, handleCountChange)
    }
  }, [sample])

  return (
    <>
      {showBrand && (
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}><TenantBrand height={36} maxWidth="100%" width="100%" /></div>
          </div>
        </div>
      )}
      <div style={{ padding: '12px 8px 0' }}>
        {sample ? <Button variant="destructive" size="sm" style={{ width: '100%' }} onClick={() => { const href = `/dashboard?tenant=${encodeURIComponent(search.get('tenant') || getActiveTenantId())}`; onNavigate(); window.location.assign(href) }}><ArrowLeft size={15} aria-hidden="true" />Back to Headliner</Button> : <NotificationBell inverse variant="user" onNavigate={onNavigate} />}
      </div>
      <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 8px' }}>
        {(sample ? [{ label: 'BETA', links: [{ href: '/odeon-demo', label: 'Contacts' }, { href: '/odeon-demo?view=parent&account=demo%3Afamily-1', label: 'Parent portal' }, { href: '/odeon-demo/school-setup?experience=configured', label: 'School Setup' }] }] : NAV_GROUPS).map(group => (
          <div key={group.label} style={{ marginTop: spacing.md }}>
            <div style={{ padding: '0 12px 6px', color: 'rgba(255,255,255,0.48)', fontSize: typography.sizeXs, fontWeight: typography.weightSemibold }}>{group.label}</div>
            {group.links.filter(link => link.href !== '/dashboard/website-content' || canPublishWebsite).map(({ href, label }) => {
              const active = sample ? href.includes('screen=staff') ? search.get('screen') === 'staff' : href.includes('view=parent') ? search.get('view') === 'parent' : href.includes('school-setup') ? pathname.endsWith('/school-setup') : pathname === '/odeon-demo' && !search.get('screen') && search.get('view') !== 'parent' : isNavLinkActive(href, pathname)
              return (
                <Link
                  key={href}
                  href={href.startsWith('/odeon-demo') ? `${href}${href.includes('?') ? '&' : '?'}tenant=${encodeURIComponent(sample ? search.get('tenant') || getActiveTenantId() : getActiveTenantId())}` : href}
                  onClick={event => {
                    if (href === '/dashboard/inbox' && pathname === href && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                      event.preventDefault()
                      window.dispatchEvent(new CustomEvent(CONVERSATIONS_HOME_EVENT))
                    }
                    onNavigate?.()
                  }}
                  style={{
                    ...navLinkStyle,
                    ...(active
                      ? { background: 'rgba(255,255,255,0.08)', color: colors.surface, fontWeight: typography.weightSemibold }
                      : {}),
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{label}</span>
                    {href === '/dashboard/leads' && leadCount > 0 && (
                      <span aria-label={`${leadCount} new leads`} title={`${leadCount} new leads`} style={{ minWidth: 19, height: 19, padding: '0 5px', borderRadius: radius.full, background: colors.crimson, color: '#fff', fontSize: 10, fontWeight: typography.weightBold, lineHeight: '19px', textAlign: 'center' }}>
                        {leadCount}
                      </span>
                    )}
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
        {!sample && canPublishWebsite && (
          <div style={{ padding: '0 4px', marginBottom: spacing.sm }}>
            <Link
              href={`/odeon-demo?tenant=${encodeURIComponent(getActiveTenantId())}`}
              onClick={onNavigate}
              aria-label="BETA academy preview"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: spacing.sm,
                padding: '9px 12px',
                borderRadius: radius.lg,
                background: colors.yellow,
                color: colors.espresso,
                textDecoration: 'none',
                fontSize: typography.sizeXs,
                fontWeight: typography.weightBold,
                letterSpacing: '0.08em',
              }}
            >
              <span>BETA</span>
              <span style={{ letterSpacing: 0, fontWeight: typography.weightMedium, color: 'rgba(26,19,15,0.7)' }}>Academy preview</span>
            </Link>
          </div>
        )}
        <Link
          href={sample ? '/odeon-demo/school-setup?experience=configured' : '/dashboard/settings'}
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
        {!sample && <LogoutButton onLogout={onNavigate} />}
      </div>
    </>
  )
}
