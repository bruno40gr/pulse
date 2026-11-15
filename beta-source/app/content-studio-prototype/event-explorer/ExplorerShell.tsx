'use client'

import { useState, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import TenantBrand from '@/components/layout/TenantBrand'
import { ControlButton } from '@/components/ui/ControlButton'
import { colors, radius, spacing, typography } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'

type Screen = 'events' | 'people' | 'opportunities' | 'book' | 'groups' | 'setup'
const links: { key: Screen; label: string }[] = [
  { key: 'people', label: 'Contacts' },
  { key: 'opportunities', label: 'Opportunities' },
  { key: 'book', label: 'Enroll & Book' },
  { key: 'groups', label: 'Groups' },
  { key: 'events', label: 'Events' },
]

/** Isolated state navigation using dashboard shell tokens; no operational polling. */
export default function ExplorerShell({ screen, onNavigate, children, groupLabel = 'Groups', embedded = false }: { screen: Screen; onNavigate: (screen: Screen) => void; children: ReactNode; groupLabel?: string; embedded?: boolean }) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  if (embedded) return <>{children}</>
  const sidebar = <>
    <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}><TenantBrand height={36} /></div>
    <nav aria-label="Operations" style={{ padding: '24px 8px', flex: 1 }}>
      <div style={{ padding: '0 12px 6px', color: 'rgba(255,255,255,0.48)', fontSize: typography.sizeXs, fontWeight: typography.weightSemibold }}>Operations</div>
      {links.map(link => <ControlButton key={link.key} kind="navigation" inverse selected={screen === link.key} aria-current={screen === link.key ? 'page' : undefined} onClick={() => { onNavigate(link.key); setOpen(false) }} style={{ padding: '9px 12px', borderRadius: radius.lg, marginBottom: 2, fontSize: typography.sizeMd }}>{link.key === 'groups' ? groupLabel : link.label}</ControlButton>)}
    </nav>
    <div style={{ padding: spacing.lg, borderTop: '1px solid rgba(255,255,255,0.08)' }}><ControlButton kind="navigation" inverse selected={screen === 'setup'} onClick={() => { onNavigate('setup'); setOpen(false) }}>School Setup</ControlButton></div>
  </>
  return <div style={{ display: 'flex', width: '100%', minWidth: 0, minHeight: '100vh', fontFamily: typography.fontSans }}>
    {!isMobile && <aside style={{ width: 220, background: colors.action, display: 'flex', flexDirection: 'column', position: 'fixed', inset: '0 auto 0 0', overflowY: 'auto' }}>{sidebar}</aside>}
    {isMobile && <header style={{ position: 'fixed', inset: '0 0 auto', height: 72, background: colors.action, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', boxSizing: 'border-box', zIndex: 30 }}><ControlButton kind="icon" inverse onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={22} /></ControlButton><div style={{ width: 110 }}><TenantBrand height={28} /></div></header>}
    {isMobile && open && <><div role="presentation" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} onClick={() => setOpen(false)} /><aside role="dialog" aria-modal="true" aria-label="Navigation" onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }} style={{ position: 'fixed', inset: '0 auto 0 0', width: 'min(280px,85vw)', background: colors.action, zIndex: 50, display: 'flex', flexDirection: 'column' }}><div style={{ display: 'flex', justifyContent: 'flex-end', padding: 8 }}><ControlButton kind="close" inverse autoFocus aria-label="Close menu" onClick={() => setOpen(false)} /></div>{sidebar}</aside></>}
    <main style={{ marginLeft: isMobile ? 0 : 220, paddingTop: isMobile ? 72 : 0, flex: '1 1 0%', minWidth: 0, maxWidth: isMobile ? '100%' : 'calc(100% - 220px)', background: colors.background, color: colors.text }}>{children}</main>
  </div>
}