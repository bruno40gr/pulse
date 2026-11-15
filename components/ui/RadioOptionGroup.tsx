'use client'

import { useId } from 'react'
import { interaction, colors, radius, spacing, typography } from '@/lib/tokens'
import styles from './RadioOptionGroup.module.css'

type RadioOption = { id: string; label: string; description?: string }

/** Native single-selection semantics with a full-row target and shared type roles. */
export function RadioOptionGroup({ label, value, options, onChange, layout = 'stacked', hideLabel = false }: {
  label: string
  value: string
  options: RadioOption[]
  onChange: (value: string) => void
  layout?: 'stacked' | 'inline'
  hideLabel?: boolean
}) {
  const name = useId()
  return <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    <legend style={{ ...typography.label, color: colors.text, padding: 0, marginBottom: spacing.sm, ...(hideLabel ? { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', margin: 0, whiteSpace: 'nowrap' } as const : {}) }}>{label}</legend>
    <div style={{ display: 'grid', gridTemplateColumns: layout === 'inline' ? 'repeat(2, minmax(0, 1fr))' : undefined, gap: spacing.sm }}>
      {options.map(option => {
        const selected = value === option.id
        const descriptionId = `${name}-${option.id}-description`
        return <label key={option.id} style={{
          display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr)', alignItems: layout === 'inline' ? 'center' : 'start', gap: spacing.md,
          padding: spacing.md, border: `1px solid ${selected ? interaction.selected : colors.border}`,
          borderRadius: radius.md, background: selected ? interaction.selectedSurface : colors.surface, cursor: 'pointer',
        }}>
          <input className={styles.radio} type="radio" name={name} value={option.id} checked={selected} aria-label={option.label}
            aria-describedby={option.description ? descriptionId : undefined} onChange={() => onChange(option.id)}
            style={{ width: 18, height: 18, margin: '1px 0 0', accentColor: interaction.selected }} />
          <span style={{ display: 'grid', gap: spacing.xs, minWidth: 0 }}>
            <span style={{ ...typography.bodySmall, fontWeight: typography.weightMedium, color: colors.text }}>{option.label}</span>
            {option.description && <span id={descriptionId} style={{ ...typography.helper, color: colors.textSecondary }}>{option.description}</span>}
          </span>
        </label>
      })}
    </div>
  </fieldset>
}