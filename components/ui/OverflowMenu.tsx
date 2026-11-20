'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [position, setPosition] = useState({ top: 0, left: 0, width: 190, maxHeight: 300 })

  useLayoutEffect(() => {
    if (!open) return
    function place() {
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(240, window.innerWidth - 16)
      const below = Math.max(0, window.innerHeight - rect.bottom - 12)
      const above = Math.max(0, rect.top - 12)
      const height = Math.min(menu.current?.parentElement?.scrollHeight || 300, 300)
      const upward = below < height && above > below
      const maxHeight = Math.min(300, upward ? above : below)
      setPosition({ width, maxHeight, left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)), top: upward ? Math.max(8, rect.top - Math.min(height, maxHeight) - 4) : rect.bottom + 4 })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])

  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus()
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false)
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || (!root.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node))) return
      event.preventDefault(); event.stopImmediatePropagation(); setOpen(false); trigger.current?.focus()
    }
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('keydown', escape, true)
    return () => { document.removeEventListener('pointerdown', dismiss); window.removeEventListener('keydown', escape, true) }
  }, [open, setOpen])

  function close() { setOpen(false); trigger.current?.focus() }

  return <div ref={root} style={{ position: 'relative', flexShrink: 0 }} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget) && !menu.current?.contains(event.relatedTarget)) setOpen(false)
  }}>
    <ControlButton ref={trigger} kind="icon" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) }
    }}><Ellipsis size={20} aria-hidden="true" /></ControlButton>
    {open && createPortal(<SurfacePanel padding={spacing.xs} style={{ position: 'fixed', ...position, zIndex: 2100, overflowY: 'auto', boxSizing: 'border-box' }}>
      <div ref={menu} id={id} role="menu" aria-label={label} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
        const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || [])
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : event.key === 'ArrowDown' ? (index + 1) % buttons.length : event.key === 'ArrowUp' ? (index - 1 + buttons.length) % buttons.length : -1
        if (next >= 0) { event.preventDefault(); buttons[next]?.focus() }
      }}>
        {items.map(item => <ControlButton key={item.label} kind="navigation" role="menuitem" tabIndex={-1} onClick={() => { close(); item.onSelect() }}>{item.label}</ControlButton>)}
      </div>
    </SurfacePanel>, root.current?.closest('[role="dialog"]') || document.body)}
  </div>
}