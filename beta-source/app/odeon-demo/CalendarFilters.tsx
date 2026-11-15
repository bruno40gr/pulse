'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { colors, radius, spacing } from '@/lib/tokens'

/** Compact calendar filter using the shared checkbox, with OR selection per field. */
export function CalendarFilter({ label, options, value, onChange }: { label: string; options: { id: string; name: string }[]; value: string[]; onChange: (value: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  return <div ref={root} style={{ position: 'relative' }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); root.current?.querySelector('button')?.focus() } }}>
    <Button size="toolbar" variant="secondary" aria-expanded={open} aria-controls={open ? `calendar-filter-${label}` : undefined} onClick={() => setOpen(!open)}>{label}: {value.length ? options.filter(option => value.includes(option.id)).map(option => option.name).join(', ') : 'All'} <ChevronDown size={14} aria-hidden="true" /></Button>
    {open && <div id={`calendar-filter-${label}`} role="group" aria-label={`${label} filters`} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 30, width: 'min(260px, 75vw)', maxHeight: 320, overflowY: 'auto', padding: spacing.md, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md }}>
      <Checkbox label={`All ${label.toLowerCase()}`} checked={!value.length} onChange={() => onChange([])} />
      {options.map(option => <Checkbox key={option.id} label={option.name} checked={value.includes(option.id)} onChange={() => onChange(value.includes(option.id) ? value.filter(id => id !== option.id) : [...value, option.id])} />)}
    </div>}
  </div>
}