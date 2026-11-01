'use client'
import { useId, type InputHTMLAttributes } from 'react'
import styles from './FormControl.module.css'
import { colors, typography, radius, spacing } from '@/lib/tokens'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export function Input({ label, hint, error, style, id, className, 'aria-describedby': describedBy, ...props }: InputProps) {
  const generatedId = useId()
  const controlId = id || generatedId
  const messageId = `${controlId}-message`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, width: '100%', minWidth: 0, maxWidth: '100%' }}>
      {label && (
        <label htmlFor={controlId} style={{ ...typography.label, color: colors.text }}>
          {label}
        </label>
      )}
      <input
        id={controlId}
        className={[styles.control, className].filter(Boolean).join(' ')}
        aria-describedby={[describedBy, hint || error ? messageId : undefined].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? true : undefined}
        style={{
          border: `1px solid ${error ? colors.error : colors.border}`,
          borderRadius: radius.md,
          padding: `${spacing.sm} ${spacing.md}`,
          fontSize: typography.sizeBase,
          fontFamily: typography.fontSans,
          color: colors.text,
          background: colors.surface,
          minHeight: 42,
          width: '100%',
          minWidth: 0,
          maxWidth: '100%',
          boxSizing: 'border-box' as const,
          ...style,
        }}
        {...props}
      />
      {hint && !error && <span id={messageId} style={{ ...typography.helper, color: colors.textMuted }}>{hint}</span>}
      {error && <span id={messageId} style={{ ...typography.helper, color: colors.error }}>{error}</span>}
    </div>
  )
}