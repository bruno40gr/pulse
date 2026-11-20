'use client'

import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { ControlButton } from '@/components/ui/ControlButton'
import { colors, radius, spacing, typography } from '@/lib/tokens'

export function MultiSelect({ label, ariaLabel, value, options, onChange, selectionSummary, minSelected = 0, menuMinWidth, appearance = 'field', summaryLabels = [], disabled = false }: {
  label: string
  ariaLabel: string
  value: string[]
  options: { value: string; label: string; disabled?: boolean; group?: string }[]
  onChange: (value: string[]) => void
  selectionSummary?: string
  minSelected?: number
  menuMinWidth?: number
  appearance?: 'field' | 'subtle'
  summaryLabels?: string[]
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const selected = value
  const choices: { value: string; label: string; disabled?: boolean; group?: string }[] = [...options, ...selected.filter(item => !options.some(option => option.value === item)).map(item => ({ value: item, label: item }))]
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
  return <div ref={root} style={{ position: 'relative', minWidth: 0, ...(appearance === 'subtle' ? { display: 'grid', width: 'max-content', maxWidth: '100%' } : {}) }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    {appearance === 'subtle' && [...new Set([...options.map(option => option.label), ...summaryLabels])].map(text => <span key={text} aria-hidden="true" style={{ gridArea: '1 / 1', visibility: 'hidden', height: 0, whiteSpace: 'nowrap', paddingInline: spacing.xs, paddingRight: 28, fontSize: typography.sizeBase, fontFamily: typography.fontSans, fontWeight: typography.weightSemibold }}>{text}</span>)}
    {label && <label id={`${id}-label`} style={{ ...typography.label, color: colors.text, display: 'block', marginBottom: spacing.xs }}>{label}</label>}
    <ControlButton ref={trigger} type="button" kind={appearance === 'subtle' ? 'subtle' : 'row'} disabled={disabled} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(current => !current)} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); requestAnimationFrame(() => focusOption(event.key === 'ArrowUp' ? choices.length - 1 : 0)) }
      if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false) }
    }} style={{ gridArea: appearance === 'subtle' ? '1 / 1' : undefined, minWidth: appearance === 'subtle' ? 0 : undefined }}>
      <span>{selectionSummary ?? (selected.length ? selected.map(item => choices.find(option => option.value === item)?.label || item).join(', ') : 'Select…')}</span><ChevronDown size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
    </ControlButton>
    {open && <div id={id} role="listbox" aria-label={ariaLabel} aria-multiselectable="true" style={{ position: 'absolute', top: '100%', left: 0, right: 0, minWidth: menuMinWidth ? `min(${menuMinWidth}px, calc(100vw - 80px))` : undefined, zIndex: 10, maxHeight: 240, overflowY: 'auto', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md }}>
      {choices.map((option, index) => <Fragment key={option.value}>{option.group && option.group !== choices[index - 1]?.group && <div role="presentation" style={{ padding: `${spacing.xs} ${spacing.sm}`, ...typography.label, color: colors.textMuted }}>{option.group}</div>}<ControlButton type="button" role="option" kind="row" selected={selected.includes(option.value)} disabled={option.disabled} aria-disabled={option.disabled || (selected.includes(option.value) && selected.length <= minSelected) || undefined} aria-selected={selected.includes(option.value)} onClick={() => {
        if (option.disabled || (selected.includes(option.value) && selected.length <= minSelected)) return
        onChange(choices.filter(item => item.value === option.value ? !selected.includes(item.value) : selected.includes(item.value)).map(item => item.value))
      }} onKeyDown={event => {
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); focusOption(event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1)) }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus() }
      }}>{option.label}{selected.includes(option.value) && <Check size={16} aria-hidden="true" />}</ControlButton></Fragment>)}
    </div>}
  </div>
}