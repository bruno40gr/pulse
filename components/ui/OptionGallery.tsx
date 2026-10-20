'use client'

import { ControlButton } from './ControlButton'
import { spacing } from '@/lib/tokens'

type Option = { id: string; name: string }

/** Responsive single-selection gallery; shared control owns hover/active/focus states. */
export function OptionGallery({ label, options, selectedId, onSelect, disabled = false }: {
  label: string
  options: Option[]
  selectedId: string
  onSelect: (id: string) => void
  disabled?: boolean
}) {
  return <section aria-label={label} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: spacing.md }}>
    {options.map(option => <ControlButton key={option.id} kind="tab" type="button" selected={selectedId === option.id} aria-pressed={selectedId === option.id} disabled={disabled} onClick={() => onSelect(option.id)} style={{ whiteSpace: 'normal', minHeight: 48 }}>{option.name}</ControlButton>)}
  </section>
}