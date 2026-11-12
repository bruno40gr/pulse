'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ControlButton } from '@/beta-source/components/ui/ControlButton'
import { SurfacePanel } from '@/beta-source/components/ui/SurfacePanel'
import styles from './CalendarTeacherFilter.module.css'

/** Browsing filter only; options come from the caller's scoped lesson data. */
export function CalendarTeacherFilter({ teachers, hidden, onChange }: { teachers: string[]; hidden: string[]; onChange: (hidden: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus()
    function dismiss(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  if (teachers.length < 2) return null
  const count = teachers.filter(name => !hidden.includes(name)).length
  function close() { setOpen(false); trigger.current?.focus() }
  return <div ref={root} className={styles.filter} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <ControlButton kind="toggle" ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true) } }}>Teachers · {count === teachers.length ? 'All' : count}<ChevronDown size={16} aria-hidden="true" /></ControlButton>
    {open && <div className={styles.menu}><SurfacePanel padding="6px">
      <div id={id} ref={menu} role="menu" aria-label="Filter teachers" onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
        const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button') || [])
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : event.key === 'ArrowDown' ? (index + 1) % buttons.length : event.key === 'ArrowUp' ? (index - 1 + buttons.length) % buttons.length : -1
        if (next >= 0) { event.preventDefault(); buttons[next]?.focus() }
      }}>
        <ControlButton kind="navigation" role="menuitem" onClick={() => onChange([])}>Show all teachers</ControlButton>
        {teachers.map(teacher => <ControlButton key={teacher} kind="navigation" role="menuitemcheckbox" aria-checked={!hidden.includes(teacher)} onClick={() => onChange(hidden.includes(teacher) ? hidden.filter(name => name !== teacher) : [...hidden, teacher])}><span aria-hidden="true" className={styles.check}>{hidden.includes(teacher) ? '' : '✓'}</span>{teacher}</ControlButton>)}
      </div>
    </SurfacePanel></div>}
  </div>
}