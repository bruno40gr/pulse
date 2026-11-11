'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from './Input'
import { ButtonBase } from './ButtonBase'
import { ControlButton } from './ControlButton'
import styles from './SearchSelect.module.css'
import { colors, radius, shadows, spacing, typography } from '@/lib/tokens'

export type SearchSelectOption = { value: string; label: string; content?: ReactNode; disabled?: boolean }

/** Search-first single-selection dropdown. Parent owns opening and dismissal. */
export function SearchSelect({ label, options, onSelect, onClose, closeLabel = 'Close options' }: {
  label: string
  options: SearchSelectOption[]
  onSelect: (value: string) => void
  onClose: () => void
  closeLabel?: string
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const matches = options.filter(option => option.label.toLowerCase().includes(query.trim().toLowerCase()))
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) onClose() }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [onClose])
  useEffect(() => { if (active >= 0) root.current?.querySelector(`#${CSS.escape(`${id}-option-${active}`)}`)?.scrollIntoView({ block: 'nearest' }) }, [active, id])
  return <div ref={root} style={{ position: 'relative', minWidth: 0 }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) onClose() }} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
  }}>
    <div style={{ position: 'relative', minWidth: 0 }}>
        <Search size={16} aria-hidden="true" style={{ position: 'absolute', left: 12, top: 13, color: colors.textSecondary }} />
        <Input className={styles.search} autoFocus role="combobox" aria-label={label} placeholder={label} aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-list`} aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined} value={query} style={{ paddingLeft: 36, paddingRight: 44 }} onChange={event => { setQuery(event.target.value); setActive(-1) }} onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            const enabled = matches.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0)
            if (enabled.length) {
              const position = enabled.indexOf(active)
              setActive(position < 0 ? enabled[event.key === 'ArrowDown' ? 0 : enabled.length - 1] : enabled[(position + (event.key === 'ArrowDown' ? 1 : enabled.length - 1)) % enabled.length])
            }
          }
          if (event.key === 'Enter') { event.preventDefault(); if (active >= 0 && matches[active] && !matches[active].disabled) onSelect(matches[active].value) }
        }} />
      <ControlButton style={{ position: 'absolute', right: 5, top: 5 }} type="button" kind="icon" aria-label={closeLabel} onClick={onClose}><X size={17} aria-hidden="true" /></ControlButton>
    </div>
    <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box', marginTop: 4, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, boxShadow: shadows.sm, maxHeight: 240, overflowY: 'auto' }}>
      <div role="listbox" id={`${id}-list`} aria-label={`${label} results`}>
        {matches.map((option, index) => <ButtonBase key={option.value} id={`${id}-option-${index}`} type="button" role="option" aria-selected={active === index} aria-disabled={option.disabled || undefined} disabled={option.disabled} tabIndex={-1} onPointerDown={event => event.preventDefault()} onMouseEnter={() => { if (!option.disabled) setActive(index) }} onClick={() => onSelect(option.value)} style={{ width: '100%', display: 'block', textAlign: 'left', border: 0, padding: `${spacing.sm} ${spacing.md}`, background: active === index ? colors.surfaceMuted : colors.surface, color: colors.text, fontFamily: typography.fontSans, fontSize: typography.sizeBase, opacity: option.disabled ? .5 : 1, cursor: option.disabled ? 'default' : 'pointer' }}>{option.content || option.label}</ButtonBase>)}
      </div>
      {!matches.length && <div role="status" style={{ padding: spacing.md, fontSize: typography.sizeSm, color: colors.textSecondary }}>No matches</div>}
    </div>
  </div>
}
