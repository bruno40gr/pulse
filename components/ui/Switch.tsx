'use client'

import { useId, type CSSProperties, type InputHTMLAttributes } from 'react'
import { interaction, colors, spacing, typography } from '@/lib/tokens'
import styles from './Switch.module.css'

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; description?: string; inline?: boolean }

/** Native keyboard-operable binary control with a single visible label. */
export function Switch({ label, description, inline = false, id, className, 'aria-describedby': describedBy, ...props }: SwitchProps) {
  const generatedId = useId()
  const controlId = id || generatedId
  return <label htmlFor={controlId} className={styles.row} style={{ fontFamily: typography.fontSans, color: colors.text, gap: spacing.lg, ...(inline ? { display: 'inline-flex', justifyContent: 'flex-start', width: 'fit-content', maxWidth: '100%' } : {}) }}>
    <span className={styles.label}>{label}{description && <span id={`${controlId}-description`} style={{ color: colors.textSecondary }}>{description}</span>}</span>
    <input aria-label={label} {...props} id={controlId} type="checkbox" role="switch" className={[styles.control, className].filter(Boolean).join(' ')} aria-describedby={[describedBy, description ? `${controlId}-description` : undefined].filter(Boolean).join(' ') || undefined} style={{ '--switch-on': interaction.selected, '--switch-off': interaction.off, '--switch-focus': interaction.focus } as CSSProperties} />
  </label>
}