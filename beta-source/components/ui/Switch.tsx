'use client'

import { useId, type CSSProperties, type InputHTMLAttributes } from 'react'
import { colors, spacing, typography } from '@/beta-source/lib/tokens'
import styles from './Switch.module.css'

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; description?: string }

/** Native keyboard-operable binary control with a single visible label. */
export function Switch({ label, description, id, className, 'aria-describedby': describedBy, ...props }: SwitchProps) {
  const generatedId = useId()
  const controlId = id || generatedId
  return <label htmlFor={controlId} className={styles.row} style={{ fontFamily: typography.fontSans, color: colors.text, gap: spacing.lg }}>
    <span className={styles.label}>{label}{description && <span id={`${controlId}-description`} style={{ color: colors.textSecondary }}>{description}</span>}</span>
    <input aria-label={label} {...props} id={controlId} type="checkbox" role="switch" className={[styles.control, className].filter(Boolean).join(' ')} aria-describedby={[describedBy, description ? `${controlId}-description` : undefined].filter(Boolean).join(' ') || undefined} style={{ '--switch-on': colors.espresso, '--switch-off': colors.textMuted, '--switch-focus': colors.tealDark } as CSSProperties} />
  </label>
}