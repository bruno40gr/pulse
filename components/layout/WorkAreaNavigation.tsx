'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Check, ChevronDown, Globe, GraduationCap, LayoutDashboard, Search, Settings, Wallet } from 'lucide-react'
import { ControlButton } from '@/components/ui/ControlButton'
import { Modal, ModalBody, ModalHeader } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { colors } from '@/lib/tokens'
import { getActiveTenantId } from '@/lib/tenant'
import { CONVERSATIONS_HOME_EVENT } from '@/lib/conversation-display'
import { activeNavigationLink, canAccessBeta, rememberedAreaHref, settingsLinks, workAreaForPath, workAreasForAccess, type NavigationAccess } from '@/lib/work-area-navigation'
import styles from './WorkAreaNavigation.module.css'

const icons = { operations: LayoutDashboard, school: GraduationCap, funding: Wallet, website: Globe }

export default function WorkAreaNavigation({ access, leadCount, conversationCount, onNavigate }: {
  access: NavigationAccess; leadCount: number; conversationCount: number; onNavigate: () => void
}) {
  const pathname = usePathname()
  const areaId = workAreaForPath(pathname)
  const areas = workAreasForAccess(access)
  const area = areas.find(item => item.id === areaId)
  const links = areaId === 'settings' ? settingsLinks(access) : area!.links
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [remembered, setRemembered] = useState<Record<string, string>>({})
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const Icon = areaId === 'settings' ? Settings : icons[areaId]
  const tenant = getActiveTenantId()

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const item of workAreasForAccess(access)) {
      try { next[item.id] = rememberedAreaHref(item, sessionStorage.getItem(`pulse:work-area:${tenant}:${item.id}`)) } catch { next[item.id] = item.links[0].href }
    }
    if (areaId !== 'settings' && workAreasForAccess(access).find(item => item.id === areaId)?.links.some(link => link.href === pathname)) {
      next[areaId] = pathname
      try { sessionStorage.setItem(`pulse:work-area:${tenant}:${areaId}`, pathname) } catch { /* Navigation remains available without storage. */ }
    }
    setRemembered(next)
    setOpen(false)
  }, [pathname, tenant, access, areaId])

  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLElement>('[data-area-option]')?.focus()
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopImmediatePropagation(); setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('keydown', escape, true)
    return () => { document.removeEventListener('pointerdown', dismiss); window.removeEventListener('keydown', escape, true) }
  }, [open])

  useEffect(() => {
    const search = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setOpen(false); setQuery(''); setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', search)
    return () => window.removeEventListener('keydown', search)
  }, [])

  const searchResults = [...areas, { id: 'settings', label: 'Settings', links: settingsLinks(access) }].flatMap(item => item.links.map(link => ({ ...link, areaLabel: item.label }))).filter(link => `${link.areaLabel} ${link.label}`.toLowerCase().includes(query.trim().toLowerCase()))

  return <div className={styles.body} style={{ '--nav-border': colors.border, '--nav-paper': colors.surface, '--nav-secondary': colors.textSecondary, '--nav-focus': colors.teal, '--nav-alert': colors.crimson } as CSSProperties}>
    <div style={{ padding: '12px 12px 0' }}><ControlButton inverse kind="navigation" onClick={() => { setOpen(false); setQuery(''); setSearchOpen(true) }}><Search size={16} />Jump to…</ControlButton></div>
    <div className={styles.switcher} ref={root}>
      <div className={styles.label}>Work area</div>
      <div className={styles.trigger}><ControlButton inverse kind="row" ref={trigger} aria-expanded={open} aria-controls="work-area-options" onClick={() => setOpen(current => !current)}><span className={styles.title}><Icon size={17} />{area?.label || 'Settings'}</span><ChevronDown size={15} /></ControlButton></div>
      {open && <div className={styles.popover} id="work-area-options" role="group" aria-label="Choose a work area" onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const options = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('[data-area-option]'))
        const index = options.indexOf(document.activeElement as HTMLAnchorElement)
        options[event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length]?.focus()
      }}>{areas.map(item => { const AreaIcon = icons[item.id as keyof typeof icons]; return <Link key={item.id} data-area-option href={rememberedAreaHref(item, remembered[item.id] || null)} onClick={() => { setOpen(false); onNavigate() }} className={styles.title} style={{ padding: '12px 10px', borderRadius: 6, textDecoration: 'none', color: colors.text, background: item.id === areaId ? colors.surfaceMuted : undefined }}><AreaIcon size={18} /><span className={styles.areaText}><strong>{item.label}</strong><small>{item.description}</small></span>{item.id === areaId && <Check size={16} />}</Link> })}</div>}
    </div>
    <nav className={styles.links} aria-label={area?.label || 'Settings'}>{links.map(link => {
      const count = link.href === '/dashboard/leads' ? leadCount : link.href === '/dashboard/inbox' ? conversationCount : 0
      return <Link key={link.href} href={link.href} className={styles.link} aria-current={activeNavigationLink(link.href, pathname) ? 'page' : undefined} onClick={event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        if (link.href === '/dashboard/inbox' && pathname === link.href) { event.preventDefault(); window.dispatchEvent(new CustomEvent(CONVERSATIONS_HOME_EVENT)) }
        onNavigate()
      }}>{link.label}{count > 0 && <span className={styles.count} aria-label={`${count} ${link.href === '/dashboard/leads' ? 'new leads' : 'unread messages'}`}>{count}</span>}</Link>
    })}</nav>
    <div className={styles.footer}>
      {canAccessBeta(access) && <Link href={`/odeon-demo?tenant=${encodeURIComponent(tenant)}`} aria-label="BETA academy preview" onClick={onNavigate} className={styles.link} style={{ justifyContent: 'space-between', background: colors.yellow, color: colors.espresso, fontWeight: 700 }}><span>BETA</span><span style={{ fontSize: 12, fontWeight: 500 }}>Academy preview</span></Link>}
      <Link href="/dashboard/settings" className={styles.link} aria-current={areaId === 'settings' ? 'page' : undefined} onClick={onNavigate}><Settings size={16} />Settings</Link>
    </div>
    <Modal isOpen={searchOpen} onClose={() => setSearchOpen(false)} ariaLabel="Jump to a page" size="md">
      <ModalHeader title="Jump to a page" onClose={() => setSearchOpen(false)} />
      <ModalBody>
        <Input autoFocus label="Search all work areas" placeholder="Find contacts, articles, or settings…" value={query} onChange={event => setQuery(event.target.value)} />
        <nav aria-label="Search results" style={{ display: 'grid', gap: 4, marginTop: 16 }}>{searchResults.map(link => <Link key={link.href} href={link.href} onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; setSearchOpen(false); onNavigate() }} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, color: colors.text, textDecoration: 'none', borderRadius: 6 }}><span>{link.label}</span><small style={{ color: colors.textSecondary }}>{link.areaLabel}</small></Link>)}</nav>
        {!searchResults.length && <p>No pages found. Try a different name.</p>}
      </ModalBody>
    </Modal>
  </div>
}