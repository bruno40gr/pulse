'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { ButtonBase } from '@/components/ui/ButtonBase'
import { colors, radius, spacing, typography } from '@/lib/tokens'

export function StudentMultiSelect({ label, ariaLabel, value, options, onChange }: {
  label: string
  ariaLabel: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const selected = value.split(',').map(item => item.trim()).filter(Boolean)
  const choices = [...options, ...selected.filter(item => !options.some(option => option.value === item)).map(item => ({ value: item, label: item }))]
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    // The app's dialog stack handles Escape during document capture. Consume it
    // first so dismissing an open dropdown does not also dismiss its lead panel.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !root.current?.contains(event.target as Node)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', close)
    window.addEventListener('keydown', escape, true)
    return () => { document.removeEventListener('pointerdown', close); window.removeEventListener('keydown', escape, true) }
  }, [open])
  const focusOption = (index: number) => {
    const items = root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')
    if (items?.length) items[(index + items.length) % items.length].focus()
  }
  return <div ref={root} style={{ position: 'relative', minWidth: 0 }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <label id={`${id}-label`} style={{ ...typography.label, color: colors.text, display: 'block', marginBottom: spacing.xs }}>{label}</label>
    <ButtonBase ref={trigger} type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(current => !current)} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); requestAnimationFrame(() => focusOption(event.key === 'ArrowUp' ? choices.length - 1 : 0)) }
      if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false) }
    }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, width: '100%', textAlign: 'left', border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: `${spacing.sm} ${spacing.md}`, fontSize: typography.sizeBase, fontFamily: typography.fontSans, color: colors.text, background: colors.surface, cursor: 'pointer' }}>
      <span>{selected.length ? selected.map(item => choices.find(option => option.value === item)?.label || item).join(', ') : 'Select…'}</span><ChevronDown size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
    </ButtonBase>
    {open && <div id={id} role="listbox" aria-label={ariaLabel} aria-multiselectable="true" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, maxHeight: 240, overflowY: 'auto', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md }}>
      {choices.map((option, index) => <ButtonBase type="button" key={option.value} role="option" aria-selected={selected.includes(option.value)} onClick={() => onChange(choices.filter(item => item.value === option.value ? !selected.includes(item.value) : selected.includes(item.value)).map(item => item.value).join(', '))} onKeyDown={event => {
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); focusOption(event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1)) }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus() }
      }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: `${spacing.sm} ${spacing.md}`, border: 0, borderBottom: `1px solid ${colors.border}`, textAlign: 'left', fontFamily: typography.fontSans, fontSize: typography.sizeBase, color: colors.text, background: selected.includes(option.value) ? colors.surfaceMuted : colors.surface, cursor: 'pointer' }}>{option.label}{selected.includes(option.value) && <Check size={16} aria-hidden="true" />}</ButtonBase>)}
    </div>}
  </div>
}