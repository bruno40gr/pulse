'use client'


import { ControlButton } from '@/components/ui/ControlButton'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import TenantBrand from '@/components/layout/TenantBrand'
import LogoutButton from '@/components/layout/LogoutButton'
import IdentityProvider from '@/components/layout/IdentityProvider'
import WorkAreaNavigation from '@/components/layout/WorkAreaNavigation'
import type { NavigationAccess } from '@/lib/work-area-navigation'
import DemoBanner from '@/components/ui/DemoBanner'
import { ClaimReminderModal } from '@/components/account/ClaimReminderModal'
import { colors, typography } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'
import { applyDisplayFontSize, readDisplayFontSize } from '@/lib/display-preferences'
import NotificationBell from '@/components/notifications/NotificationBell'
import { getActiveTenantId } from '@/lib/tenant'
import { LEAD_COUNT_EVENT } from '@/lib/lead-count'
import { startVisiblePolling } from '@/lib/visible-polling'
import { useDialogLayer } from '@/lib/useDialogLayer'

const CONVERSATION_COUNT_EVENT = 'pulse:conversation-count-changed'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)
  const drawer = useDialogLayer(isMobile && menuOpen, closeMenu)

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

  return (
    <IdentityProvider>
    <div style={{ display: 'flex', width: '100%', minWidth: 0, minHeight: '100vh', fontFamily: typography.fontSans }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside style={{ width: '252px', background: colors.action, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100dvh', zIndex: 35 }}>
          <SidebarBody onNavigate={closeMenu} />
        </aside>
      )}

      {/* Mobile top bar */}
      {isMobile && (
        <header style={{ position: 'fixed', top: 0, left: 0, right: 0, minHeight: '72px', background: colors.action, display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', boxSizing: 'border-box', zIndex: 30 }}>
          <ControlButton kind="icon" inverse type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen} >
            <Menu size={22} />
          </ControlButton>
          <div style={{ flex: '0 1 110px', minWidth: 0 }}><TenantBrand height={28} maxWidth="100%" width="100%" /></div>
          <div style={{ flex: 1, minWidth: 0 }}><NotificationBell inverse variant="user" onNavigate={closeMenu} /></div>
        </header>
      )}

      {/* Mobile drawer */}
      {isMobile && menuOpen && drawer.mounted && createPortal(
        <div ref={drawer.rootRef}>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} onClick={closeMenu} />
          <div ref={drawer.dialogRef} role="dialog" aria-modal="true" aria-label="School navigation" tabIndex={-1} style={{ position: 'fixed', top: 0, left: 0, height: '100dvh', width: 'min(280px, 85vw)', background: colors.action, zIndex: 50, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <TenantBrand height={32} maxWidth="70%" width="70%" />
              <ControlButton kind="close" inverse type="button" onClick={closeMenu} aria-label="Close menu"  />
            </div>
            <SidebarBody onNavigate={closeMenu} showBrand={false} />
          </div>
        </div>, document.body,
      )}

      {/* Main content */}
      <main style={{ marginLeft: isMobile ? 0 : '252px', paddingTop: isMobile ? '72px' : 0, flex: '1 1 0%', minWidth: 0, maxWidth: isMobile ? '100%' : 'calc(100% - 252px)', background: colors.background, color: colors.text }}>
        <DemoBanner />
        {children}
      </main>
      <ClaimReminderModal />
    </div>
    </IdentityProvider>
  )
}

function SidebarBody({ onNavigate, showBrand = true }: { onNavigate: () => void; showBrand?: boolean }) {
  const [navigationAccess, setNavigationAccess] = useState<NavigationAccess>({})
  const [conversationCount, setConversationCount] = useState(0)
  const [leadCount, setLeadCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/account/me?tenant=${encodeURIComponent(getActiveTenantId())}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => { if (response.ok) setNavigationAccess(await response.json()) })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  useEffect(() => {
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
  }, [])

  useEffect(() => {
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
      <div style={{ padding: '12px 8px 0' }}>
        <NotificationBell inverse variant="user" onNavigate={onNavigate} />
      </div>
      <WorkAreaNavigation access={navigationAccess} leadCount={leadCount} conversationCount={conversationCount} onNavigate={onNavigate} />
      <div style={{ padding: '0 8px 12px' }}>
        <LogoutButton onLogout={onNavigate} />
      </div>
    </>
  )
}

