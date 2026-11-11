'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, Globe, GraduationCap, LayoutDashboard, Menu, Search, Settings, Wallet } from 'lucide-react'
import { ControlButton } from '@/components/ui/ControlButton'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { SurfacePanel } from '@/components/ui/SurfacePanel'
import { Input } from '@/components/ui/Input'
import { Tabs } from '@/components/ui/Tabs'
import { colors, typography } from '@/lib/tokens'
import { defaultDestination, destinationHash, parseDestination, searchDestinations, settingsPages, workAreas, type AreaId, type Destination } from '@/lib/navigation-prototype'
import styles from './navigation.module.css'

const areaIcons = { operations: LayoutDashboard, school: GraduationCap, funding: Wallet, website: Globe }
const theme = {
  '--canvas': colors.background, '--paper': colors.surface, '--ink': colors.text,
  '--secondary': colors.textSecondary, '--line': colors.border, '--muted': colors.surfaceMuted,
  '--selected': colors.surfaceSelected, '--blue': colors.link, '--sans': typography.fontSans,
} as CSSProperties

const sampleRows: Record<AreaId | 'settings', [string, string, string][]> = {
  operations: [['Follow up with new families', 'Leads · 3 inquiries waiting for a first response', 'Today'], ['Welcome the next generation of musicians', 'Communications · 2 unread conversations', 'Inbox'], ['Prepare for the winter showcase', 'Notes · Staff planning and next steps', 'This week']],
  school: [['Northside studio', 'Locations & rooms · 3 teaching rooms', 'Configured'], ['Private music lessons', 'Services & programs · Piano, guitar, drums and voice', 'Active'], ['Winter term', 'Academic calendar · Fictional term dates for this study', 'Draft']],
  funding: [['Morgan Rivera', 'Funded students · Community Arts Scholarship', 'Active'], ['Community Arts Scholarship', 'Funding programs · Student tuition support', 'Open'], ['Winter tuition review', 'Overview · Review student funding before the new term', 'To review']],
  website: [['Winter student showcase', 'Event · A celebration of our student musicians', 'Published'], ['Meet our new voice teacher', 'Article · Stories from our school', 'Draft'], ['Winter enrollment is open', 'Announcement · Share what is happening next', 'Published'], ['Spring scholarship applications', 'Deadline · Applications close before the new term', 'Draft'], ['A great first performance', 'Community post · A moment from our school community', 'Published']],
  settings: [['Team & permissions', 'Invite colleagues and manage access—not teacher profiles', 'Global'], ['Integrations', 'Connect the services your school uses', 'Global'], ['Billing & security', 'Manage your subscription and account protection', 'Global']],
}

const contentTypes: Record<string, string> = { Events: 'Event', Deadlines: 'Deadline', Announcements: 'Announcement', Articles: 'Article', 'Community posts': 'Community post' }

function areaLabel(area: Destination['area']) {
  return workAreas.find(item => item.id === area)?.label || 'Settings'
}

function restoreFocus(element: HTMLElement | null) {
  requestAnimationFrame(() => element?.focus())
}

export default function NavigationPrototype() {
  const [variant, setVariant] = useState<'switcher' | 'groups'>('switcher')
  const [destination, setDestination] = useState<Destination>(defaultDestination)
  const [expanded, setExpanded] = useState<string[]>(['operations'])
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dialog, setDialog] = useState<'search' | 'help' | null>(null)
  const [query, setQuery] = useState('')
  const lastVisited = useRef<Partial<Record<Destination['area'], string>>>({})
  const switcher = useRef<HTMLDivElement>(null)
  const switcherTrigger = useRef<HTMLButtonElement>(null)
  const drawerTrigger = useRef<HTMLButtonElement>(null)
  const sidebar = useRef<HTMLElement>(null)
  const modal = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const activeArea = workAreas.find(area => area.id === destination.area)

  useEffect(() => {
    const sync = () => {
      const next = parseDestination(window.location.hash)
      setDestination(next)
      lastVisited.current[next.area] = next.page
      setExpanded(current => current.includes(next.area) ? current : [...current, next.area])
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    if (!switcherOpen) return
    const dismiss = (event: PointerEvent) => {
      if (!switcher.current?.contains(event.target as Node)) setSwitcherOpen(false)
    }
    const first = switcher.current?.querySelector<HTMLButtonElement>('[data-area-option]')
    first?.focus()
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [switcherOpen])

  useEffect(() => {
    if (!dialog && !drawerOpen) return
    const priorOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const container = dialog ? modal.current : sidebar.current
    const focusable = () => Array.from(container?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input') || []).filter(element => element.getClientRects().length > 0)
    ;(dialog === 'search' ? container?.querySelector<HTMLInputElement>('input') : focusable()[0])?.focus()
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const elements = focusable()
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', trap)
    return () => {
      document.body.style.overflow = priorOverflow
      document.removeEventListener('keydown', trap)
    }
  }, [dialog, drawerOpen])

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        previousFocus.current = document.activeElement as HTMLElement
        setQuery(''); setDrawerOpen(false); setSwitcherOpen(false); setDialog('search')
      }
      if (event.key === 'Escape') {
        if (dialog) { setDialog(null); restoreFocus(previousFocus.current) }
        else if (switcherOpen) { setSwitcherOpen(false); switcherTrigger.current?.focus() }
        else if (drawerOpen) { setDrawerOpen(false); restoreFocus(drawerTrigger.current) }
      }
    }
    document.addEventListener('keydown', keyboard)
    return () => document.removeEventListener('keydown', keyboard)
  }, [dialog, switcherOpen, drawerOpen])

  function navigate(next: Destination) {
    lastVisited.current[next.area] = next.page
    setDestination(next)
    setExpanded(current => current.includes(next.area) ? current : [...current, next.area])
    if (window.location.hash !== destinationHash(next)) window.location.hash = destinationHash(next)
    setSwitcherOpen(false); setDrawerOpen(false); setDialog(null)
    if (drawerOpen) restoreFocus(drawerTrigger.current)
    else if (dialog) restoreFocus(previousFocus.current)
    else if (switcherOpen) switcherTrigger.current?.focus()
  }

  function openDialog(kind: 'search' | 'help') {
    previousFocus.current = drawerOpen ? drawerTrigger.current : document.activeElement as HTMLElement
    setQuery(''); setSwitcherOpen(false); setDrawerOpen(false); setDialog(kind)
  }

  function navLinks(area: Destination['area'], pages: readonly string[]) {
    return pages.map(page => (
      <a key={page} href={destinationHash({ area, page })} aria-current={destination.area === area && destination.page === page ? 'page' : undefined}
        onClick={event => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault(); navigate({ area, page })
        }}>
        <span>{page}</span>
        {area === 'operations' && (page === 'Leads' || page === 'Communications') && <span className={styles.count}>{page === 'Leads' ? 3 : 2}</span>}
      </a>
    ))
  }

  const metricData = destination.area === 'website'
    ? [['Published', '3', 'Visible on the sample website'], ['Drafts', '2', 'Ready for your next idea'], ['Content types', '5', 'One shared content workspace']]
    : destination.area === 'funding'
      ? [['Funded students', '18', 'Across your funding programs'], ['Active programs', '3', 'Supporting access to music'], ['Needs review', '2', 'Before the next tuition cycle']]
      : destination.area === 'school'
        ? [['Teaching locations', '2', 'Space for every kind of musician'], ['Teachers', '12', 'Your school’s teaching team'], ['Programs', '6', 'Your offerings, in one place']]
        : [['New inquiries', '3', 'Families ready to get started'], ['Active students', '128', 'Learning and making music'], ['Unread conversations', '2', 'Keep the conversation going']]
  const rows = sampleRows[destination.area].filter(row => destination.area !== 'website' || !contentTypes[destination.page] || row[1].startsWith(`${contentTypes[destination.page]} ·`))

  return (
    <div className={styles.root} style={theme}>
      <header className={styles.studyBar} inert={drawerOpen || !!dialog}>
        <div className={styles.studyLabel}><span className={styles.tag}>Navigation study</span><small>Same school. Four work areas.</small></div>
        <Tabs items={[{ key: 'switcher', label: 'A · Area switcher' }, { key: 'groups', label: 'B · Sidebar groups' }]} activeKey={variant} onChange={key => { setVariant(key); setSwitcherOpen(false) }} variant="prominent" controlSize="toolbar" ariaLabel="Navigation variant" />
      </header>
      <div className={styles.shell}>
        <div className={styles.scrim} data-open={drawerOpen} onClick={() => { setDrawerOpen(false); restoreFocus(drawerTrigger.current) }} aria-hidden="true" />
        <aside ref={sidebar} className={styles.sidebar} data-open={drawerOpen} aria-label="School navigation" role={drawerOpen ? 'dialog' : undefined} aria-modal={drawerOpen || undefined} inert={!!dialog}>
          <div className={styles.brand}><span className={styles.mark}>H</span><div><strong>Headliner</strong><small>Music Academy · Sample school</small></div><ControlButton className={styles.mobileOnly} kind="close" aria-label="Close navigation" onClick={() => { setDrawerOpen(false); restoreFocus(drawerTrigger.current) }} /></div>
          <ControlButton kind="navigation" onClick={() => openDialog('search')}><Search size={16} />Jump to…<span className={styles.count}>⌘ K</span></ControlButton>
          {variant === 'switcher' && <div className={styles.switcherWrap} ref={switcher}>
            <div className={styles.eyebrow}>Work area</div>
            <div className={styles.switcher}><ControlButton ref={switcherTrigger} kind="row" aria-expanded={switcherOpen} aria-controls="area-options" onClick={() => setSwitcherOpen(value => !value)}><span className={styles.sectionHeading}>{activeArea ? (() => { const Icon = areaIcons[activeArea.id]; return <Icon size={17} /> })() : <Settings size={17} />}{areaLabel(destination.area)}</span><ChevronDown size={15} /></ControlButton></div>
            {switcherOpen && <div id="area-options" className={styles.popover} role="group" aria-label="Choose a work area" onKeyDown={event => {
              if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
              event.preventDefault()
              const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-area-option]'))
              const current = options.indexOf(document.activeElement as HTMLButtonElement)
              options[event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length]?.focus()
            }}>
              <div className={styles.eyebrow} style={{ marginTop: 8 }}>Switch work area</div>
              {workAreas.map(area => { const Icon = areaIcons[area.id]; return <ControlButton key={area.id} data-area-option kind="navigation" selected={destination.area === area.id} onClick={() => navigate({ area: area.id, page: lastVisited.current[area.id] || area.pages[0] })}><Icon size={18} /><span className={styles.areaText}>{area.label}<small>{area.description}</small></span>{destination.area === area.id && <Check size={16} />}</ControlButton> })}
            </div>}
          </div>}
          <nav className={styles.nav} aria-label="Work area pages">
            {variant === 'switcher' ? navLinks(destination.area, activeArea?.pages || settingsPages) : workAreas.map(area => { const Icon = areaIcons[area.id]; const isOpen = expanded.includes(area.id); return <div className={styles.group} key={area.id}>
              <ControlButton kind="row" aria-expanded={isOpen} aria-controls={`group-${area.id}`} onClick={() => setExpanded(current => isOpen ? current.filter(id => id !== area.id) : [...current, area.id])}><span className={styles.sectionHeading}><Icon size={16} />{area.label}</span>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</ControlButton>
              {isOpen && <div id={`group-${area.id}`} style={{ paddingLeft: 12 }}>{navLinks(area.id, area.pages)}</div>}
            </div> })}
            {variant === 'groups' && destination.area === 'settings' && navLinks('settings', settingsPages)}
          </nav>
          <footer className={styles.footer}>
            <ControlButton kind="navigation" selected={destination.area === 'settings'} onClick={() => navigate({ area: 'settings', page: lastVisited.current.settings || settingsPages[0] })}><Settings size={16} />Settings</ControlButton>
            <ControlButton kind="navigation" onClick={() => openDialog('help')}><CircleHelp size={16} />About this prototype</ControlButton>
            <div className={styles.profile}><span className={styles.avatar}>AL</span><div>Alex Lee<div className={styles.muted}>School administrator · Fictional</div></div></div>
          </footer>
        </aside>
        <main className={styles.main} inert={drawerOpen || !!dialog}>
          <div className={styles.topbar}>
            <ControlButton ref={drawerTrigger} kind="icon" className={styles.mobileOnly} aria-label="Open navigation" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Menu size={20} /></ControlButton>
            <div className={styles.breadcrumbs}><span className={styles.muted}>Headliner</span><ChevronRight size={12} /><span>{areaLabel(destination.area)}</span><ChevronRight size={12} /><strong>{destination.page}</strong></div>
            <span className={styles.demoBadge}>Prototype · Fictional data · No live changes</span>
          </div>
          <div className={styles.content}>
            <div className={styles.pageHeading}><span className={styles.muted}>{areaLabel(destination.area)}</span><h1>{destination.page}</h1><p>{destination.area === 'settings' ? 'Manage access and connections for your school. Teaching and school configuration stay in School Setup.' : activeArea?.description}{destination.area === 'website' ? '. One content library, with focused views for every format.' : destination.area === 'settings' ? '' : '.'}</p></div>
            {destination.area !== 'settings' && <div className={styles.metrics}>{metricData.map(([label, value, caption]) => <SurfacePanel key={label} appearance="flat"><span className={styles.muted}>{label}</span><div className={styles.metric}>{value}</div><small className={styles.muted}>{caption}</small></SurfacePanel>)}</div>}
            <DenseSectionPanel headingLevel="h2" title={destination.area === 'website' ? (destination.page === 'All content' ? 'Your content' : destination.page) : destination.area === 'settings' ? 'Account administration' : destination.area === 'school' ? 'School at a glance' : 'At a glance'} actions={<span className={styles.tag}>Sample content</span>}>
              <div className={styles.rows}>{rows.map(([title, detail, status]) => <div className={styles.row} key={title}><span className={styles.avatar}>{destination.area === 'website' ? <BookOpen size={14} /> : <ArrowRight size={14} />}</span><div className={styles.rowTitle}><strong>{title}</strong><small>{detail}</small></div><span className={styles.status}>{status}</span></div>)}</div>
            </DenseSectionPanel>
            <div className={styles.guide}><CircleHelp size={17} style={{ flexShrink: 0, marginTop: 2 }} /><p>{variant === 'switcher' ? 'Try switching to School Setup, then Website, then back. Each area remembers your last page for this session.' : 'Expand a few groups and jump between areas. Compare visibility against the longer sidebar.'} Search jumps across all four areas and Settings. Browser Back retraces your pages. This is a navigation study, not a working editor.</p></div>
          </div>
        </main>
      </div>
      {dialog && <div className={styles.overlay} onClick={event => { if (event.target === event.currentTarget) { setDialog(null); restoreFocus(previousFocus.current) } }}>
        <div ref={modal} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="navigation-dialog-title">
          <div className={styles.dialogHeader}><h2 id="navigation-dialog-title">{dialog === 'search' ? 'Jump to a page' : 'Try the navigation'}</h2><ControlButton kind="close" aria-label="Close dialog" onClick={() => { setDialog(null); restoreFocus(previousFocus.current) }} /></div>
          {dialog === 'search' ? <><Input autoFocus label="Search all work areas" placeholder="Try pricing, students, or articles…" value={query} onChange={event => setQuery(event.target.value)} /><div className={styles.searchResults}>{searchDestinations(query).map(item => <a key={`${item.area}/${item.page}`} href={destinationHash(item)} onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(item) }}>{item.page}<small>{areaLabel(item.area)}</small></a>)}{searchDestinations(query).length === 0 && <p className={styles.muted}>No pages found. Try a different name.</p>}</div></> : <div className={styles.muted} style={{ lineHeight: 1.8 }}><p>Compare A (one work area at a time) with B (expandable groups). Switching variants preserves your current page.</p><ol><li>Find a new lead in Operations.</li><li>Find lesson pricing in School Setup.</li><li>Find a funded student.</li><li>Find an article in Website.</li><li>Return to your last Operations page.</li></ol><p>The school identity stays fixed. School switching, real records, publishing, and unsaved-edit protection are outside this prototype. All data is fictional.</p></div>}
        </div>
      </div>}
    </div>
  )
}