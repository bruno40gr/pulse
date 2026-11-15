'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Ellipsis } from 'lucide-react'
import { ControlButton } from './ControlButton'
import { SurfacePanel } from './SurfacePanel'
import { spacing } from '@/lib/tokens'

interface OverflowMenuProps {
  label: string
  items: { label: string; onSelect: () => void }[]
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
}

export function OverflowMenu({ label, items, expanded, onExpandedChange }: OverflowMenuProps) {
  const [localOpen, setLocalOpen] = useState(false)
  const open = expanded ?? localOpen
  const setOpen = onExpandedChange ?? setLocalOpen
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus()
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open, setOpen])

  function close() { setOpen(false); trigger.current?.focus() }

  return <div ref={root} style={{ position: 'relative', flexShrink: 0 }} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }}>
    <ControlButton ref={trigger} kind="icon" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) }
    }}><Ellipsis size={20} aria-hidden="true" /></ControlButton>
    {open && <SurfacePanel padding={spacing.xs} style={{ position: 'absolute', right: 0, top: '100%', zIndex: 10, minWidth: 190, maxWidth: 'calc(100vw - 48px)' }}>
      <div ref={menu} id={id} role="menu" aria-label={label} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
        const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || [])
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : event.key === 'ArrowDown' ? (index + 1) % buttons.length : event.key === 'ArrowUp' ? (index - 1 + buttons.length) % buttons.length : -1
        if (next >= 0) { event.preventDefault(); buttons[next]?.focus() }
      }}>
        {items.map(item => <ControlButton key={item.label} kind="navigation" role="menuitem" tabIndex={-1} onClick={() => { close(); item.onSelect() }}>{item.label}</ControlButton>)}
      </div>
    </SurfacePanel>}
  </div>
}