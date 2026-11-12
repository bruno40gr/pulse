'use client'

import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { colors, spacing, typography } from '@/beta-source/lib/tokens'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode
  description?: string
}

/** Shared native checkbox with consistent option typography and descriptive text. */
export function Checkbox({ label, description, id, style, 'aria-describedby': describedBy, ...props }: CheckboxProps) {
  const generatedId = useId()
  const controlId = id || generatedId
  return <label htmlFor={controlId} style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.sm, minHeight: 32, fontFamily: typography.fontSans, fontSize: typography.sizeBase, fontWeight: typography.weightNormal, lineHeight: 1.5, color: colors.text, cursor: props.disabled ? 'default' : 'pointer' }}>
    <input {...props} id={controlId} type="checkbox" aria-describedby={[describedBy, description ? `${controlId}-description` : undefined].filter(Boolean).join(' ') || undefined} style={{ width: 18, height: 18, flexShrink: 0, margin: '2px 0 0', accentColor: colors.link, ...style }} />
    <span>{label}{description && <span id={`${controlId}-description`} style={{ display: 'block', marginTop: spacing.xs, fontSize: typography.sizeSm, color: colors.textSecondary }}>{description}</span>}</span>
  </label>
}
