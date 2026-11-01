'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ControlButton } from '@/components/ui/ControlButton'
import { formatPhoneNumber } from '@/lib/phone'
import { colors, radius, spacing, typography } from '@/lib/tokens'

export type HolderRecipient = { person_id: string; name: string; phone: string | null; is_primary: boolean }

export default function HolderRecipientPicker({ holders, selectedIds, onChange }: {
  holders: HolderRecipient[]; selectedIds: string[]; onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const selected = selectedIds.flatMap(id => holders.find(holder => holder.person_id === id) || [])
  const remaining = holders.filter(holder => !selectedIds.includes(holder.person_id))
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !root.current?.contains(event.target as Node)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('keydown', escape, true)
    return () => { document.removeEventListener('pointerdown', dismiss); window.removeEventListener('keydown', escape, true) }
  }, [open])
  const add = (holder: HolderRecipient) => {
    if (!holder.phone || selectedIds.includes(holder.person_id)) return
    onChange([...selectedIds, holder.person_id])
    setOpen(false)
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-remove-id="${holder.person_id}"]`)?.focus())
  }
  return <div ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }} style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
    <ul aria-label="Account holder recipients" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
      {selected.map((holder, index) => <li key={holder.person_id} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 }}>
        <Avatar firstName={holder.name.split(' ')[0]} lastName={holder.name.split(' ').slice(1).join(' ')} size={26} />
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.sm, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: typography.sizeBase, fontWeight: typography.weightSemibold, overflowWrap: 'anywhere' }}>{holder.name}</span>
          <span style={{ fontSize: typography.sizeBase, color: colors.textSecondary }}>{formatPhoneNumber(holder.phone)}</span>
        </div>
        {selected.length > 1 && <ControlButton kind="icon" aria-label={`Remove ${holder.name}`} data-remove-id={holder.person_id} onClick={() => {
          if (selected.length <= 1) return
          onChange(selectedIds.filter(id => id !== holder.person_id))
          requestAnimationFrame(() => (root.current?.querySelector<HTMLButtonElement>('[data-remove-id]') || trigger.current)?.focus())
        }}><X size={16} aria-hidden="true" /></ControlButton>}
    {index === selected.length - 1 && remaining.length > 0 && <div style={{ position: 'relative', flexShrink: 0 }}>
      <Button ref={trigger} variant="secondary" size="sm" aria-label="Add account holder" aria-expanded={open} onClick={() => {
        if (remaining.length === 1 && remaining[0].phone) add(remaining[0])
        else setOpen(value => !value)
      }}><Plus size={14} aria-hidden="true" />Add account holder</Button>
      {open && <div role="group" aria-label="Available account holders" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 20, width: 'min(260px, calc(100vw - 64px))', padding: spacing.xs, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.sm }}>
        {remaining.map(holder => <ControlButton key={holder.person_id} kind="row" disabled={!holder.phone} onClick={() => add(holder)}>{holder.name}</ControlButton>)}
      </div>}
    </div>}
      </li>)}
    </ul>
  </div>
}
