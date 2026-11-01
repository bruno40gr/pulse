'use client'

import { ControlButton } from './ControlButton'
import { colors } from '@/lib/tokens'

/** Shared sliding switch, originally used by Notes' hide-done control. */
export function ToggleSwitch({ checked, onChange, label, hideLabel = false }: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hideLabel?: boolean
}) {
  return <ControlButton kind="toggle" type="button" role="switch" aria-checked={checked}
    aria-label={hideLabel ? label : undefined} onClick={() => onChange(!checked)} style={{ whiteSpace: 'nowrap' }}>
    {!hideLabel && <span>{label}</span>}
    <span aria-hidden="true" style={{ position: 'relative', display: 'inline-block', width: 36, height: 20,
      borderRadius: 999, background: checked ? colors.action : colors.textMuted, transition: 'background 0.15s ease', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: checked ? 18 : 2, width: 16, height: 16,
        borderRadius: '50%', background: colors.surface, boxShadow: '0 1px 2px rgba(0,0,0,0.25)', transition: 'left 0.15s ease' }} />
    </span>
  </ControlButton>
}