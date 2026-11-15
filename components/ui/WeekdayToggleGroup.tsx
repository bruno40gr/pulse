'use client'

import { ControlButton } from './ControlButton'
import { interaction, colors, spacing, typography } from '@/lib/tokens'

export const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

/** A stable Monday–Sunday row; full weekday names remain available to assistive tech. */
export function WeekdayToggleGroup({ label = 'Select days', value, onChange }: {
  label?: string
  value: string[]
  onChange: (days: string[]) => void
}) {
  return <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
    <legend style={{ ...typography.label, color: colors.textSecondary, padding: 0, marginBottom: spacing.sm }}>{label}</legend>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: spacing.xs, width: '100%', maxWidth: 332 }}>
      {weekdays.map(day => {
        const selected = value.includes(day)
        return <ControlButton key={day} kind="toggle" type="button" selected={selected} aria-pressed={selected} aria-label={day}
          onClick={() => onChange(weekdays.filter(item => item === day ? !selected : value.includes(item)))}
          style={{ padding: 0, minWidth: 0, width: '100%', minHeight: 44, background: 'transparent', color: colors.text, fontWeight: typography.weightMedium }}>
          <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: '100%', maxWidth: 44, aspectRatio: '1', borderRadius: '50%', background: selected ? interaction.selected : 'transparent', color: selected ? interaction.onSelected : colors.text }}>{day[0]}</span>
        </ControlButton>
      })}
    </div>
  </fieldset>
}