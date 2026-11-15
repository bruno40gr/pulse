'use client'

import { useId, type ComponentPropsWithRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { interaction, colors, spacing, typography } from '@/lib/tokens'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode
  description?: string
}

/** Unlabelled primitive for table cells; callers must supply an accessible name. */
export function CheckboxInput({ style, ...props }: Omit<ComponentPropsWithRef<'input'>, 'type'>) {
  return <input {...props} type="checkbox" style={{ width: 18, height: 18, margin: 0, flexShrink: 0, ...style, accentColor: interaction.selected }} />
}

/** Shared native checkbox with consistent option typography and descriptive text. */
export function Checkbox({ label, description, id, style, 'aria-describedby': describedBy, ...props }: CheckboxProps) {
  const generatedId = useId()
  const controlId = id || generatedId
  return <label htmlFor={controlId} style={{ display: 'flex', flexDirection: 'row', alignItems: description ? 'flex-start' : 'center', gap: spacing.sm, minHeight: 32, fontFamily: typography.fontSans, fontSize: typography.sizeBase, fontWeight: typography.weightNormal, lineHeight: 1.5, color: colors.text, cursor: props.disabled ? 'default' : 'pointer' }}>
    <CheckboxInput {...props} id={controlId} aria-describedby={[describedBy, description ? `${controlId}-description` : undefined].filter(Boolean).join(' ') || undefined} style={{ margin: description ? '2px 0 0' : 0, ...style }} />
    <span>{label}{description && <span id={`${controlId}-description`} style={{ display: 'block', marginTop: spacing.xs, fontSize: typography.sizeSm, color: colors.textSecondary }}>{description}</span>}</span>
  </label>
}
