'use client'

import { Fragment, useEffect, useLayoutEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { ControlButton } from '@/components/ui/ControlButton'
import { colors, radius, spacing, typography } from '@/lib/tokens'

const SELECT_ALL = '__select_all__'

export function MultiSelect({ label, ariaLabel, value, options, onChange, selectionSummary, minSelected = 0, menuMinWidth, appearance = 'field', summaryLabels = [], disabled = false, selectAll = false }: {
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
  selectAll?: boolean
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: 0, top: 0, width: 220, maxHeight: 240 })
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(Math.max(rect.width, menuMinWidth || 220), window.innerWidth - 24)
      const below = window.innerHeight - rect.bottom - 12
      const above = rect.top - 12
      const upward = below < 180 && above > below
      const maxHeight = Math.min(240, Math.max(80, upward ? above : below))
      setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: upward ? Math.max(12, rect.top - maxHeight - 4) : rect.bottom + 4, width, maxHeight })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, menuMinWidth])
  const id = useId()
  const selected = value
  const actualChoices: { value: string; label: string; disabled?: boolean; group?: string }[] = [...options, ...selected.filter(item => !options.some(option => option.value === item)).map(item => ({ value: item, label: item }))]
  const choices: { value: string; label: string; disabled?: boolean; group?: string }[] = selectAll && actualChoices.length ? [{ value: SELECT_ALL, label: 'Select all' }, ...actualChoices] : actualChoices
  const enabledChoices = actualChoices.filter(option => !option.disabled)
  const allSelected = enabledChoices.length > 0 && enabledChoices.every(option => selected.includes(option.value))
  const isSelected = (choice: string) => choice === SELECT_ALL ? allSelected : selected.includes(choice)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false) }
    // The app's dialog stack handles Escape during document capture. Consume it
    // first so dismissing an open dropdown does not also dismiss its lead panel.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || (!root.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node))) return
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
    const items = menu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')
    if (items?.length) items[(index + items.length) % items.length].focus()
  }
  return <div ref={root} style={{ position: 'relative', minWidth: 0, ...(appearance === 'subtle' ? { display: 'grid', width: 'max-content', maxWidth: '100%' } : {}) }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget) && !menu.current?.contains(event.relatedTarget)) setOpen(false) }}>
    {appearance === 'subtle' && [...new Set([...options.map(option => option.label), ...summaryLabels])].map(text => <span key={text} aria-hidden="true" style={{ gridArea: '1 / 1', visibility: 'hidden', height: 0, whiteSpace: 'nowrap', paddingInline: spacing.xs, paddingRight: 28, fontSize: typography.sizeBase, fontFamily: typography.fontSans, fontWeight: typography.weightSemibold }}>{text}</span>)}
    {label && <label id={`${id}-label`} style={{ ...typography.label, color: colors.text, display: 'block', marginBottom: spacing.xs }}>{label}</label>}
    <ControlButton ref={trigger} type="button" kind={appearance === 'subtle' ? 'subtle' : 'row'} disabled={disabled} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(current => !current)} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); requestAnimationFrame(() => focusOption(event.key === 'ArrowUp' ? choices.length - 1 : 0)) }
      if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false) }
    }} style={{ gridArea: appearance === 'subtle' ? '1 / 1' : undefined, minWidth: appearance === 'subtle' ? 0 : undefined, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surface, minHeight: 38, paddingInline: spacing.sm }}>
      <span>{selectionSummary ?? (selected.length ? selected.map(item => choices.find(option => option.value === item)?.label || item).join(', ') : 'Select…')}</span><ChevronDown size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
    </ControlButton>
    {open && createPortal(<div ref={menu} id={id} role="listbox" aria-label={ariaLabel} aria-multiselectable="true" style={{ position: 'fixed', ...position, zIndex: 2100, overflowY: 'auto', boxSizing: 'border-box', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: spacing.xs }}>
      {choices.map((option, index) => <Fragment key={option.value}>{option.group && option.group !== choices[index - 1]?.group && <div role="presentation" style={{ padding: `${spacing.xs} ${spacing.sm}`, ...typography.label, color: colors.textMuted }}>{option.group}</div>}<ControlButton type="button" role="option" kind="row" selected={isSelected(option.value)} disabled={option.disabled} aria-disabled={option.disabled || (option.value !== SELECT_ALL && selected.includes(option.value) && selected.length <= minSelected) || undefined} aria-selected={isSelected(option.value)} onClick={() => {
        if (option.disabled || (option.value !== SELECT_ALL && selected.includes(option.value) && selected.length <= minSelected)) return
        if (option.value === SELECT_ALL) {
          const next = allSelected ? selected.filter(item => !enabledChoices.some(choice => choice.value === item)) : actualChoices.filter(choice => selected.includes(choice.value) || !choice.disabled).map(choice => choice.value)
          if (next.length >= minSelected) onChange(next)
          return
        }
        onChange(actualChoices.filter(item => item.value === option.value ? !selected.includes(item.value) : selected.includes(item.value)).map(item => item.value))
      }} onKeyDown={event => {
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); focusOption(event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1)) }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus() }
      }}>{option.label}{isSelected(option.value) && <Check size={16} aria-hidden="true" />}</ControlButton></Fragment>)}
    </div>, root.current?.closest('[role="dialog"]') || document.body)}
  </div>
}