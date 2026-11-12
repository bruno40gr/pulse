'use client'

import { useId, type SelectHTMLAttributes } from 'react'
import styles from './FormControl.module.css'
import { colors, typography, radius, spacing } from '@/beta-source/lib/tokens'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  fullWidth?: boolean
  wrapperStyle?: React.CSSProperties
}

export function Select({ label, hint, style, children, fullWidth = true, wrapperStyle, id, className, 'aria-describedby': describedBy, ...props }: SelectProps) {
  const generatedId = useId()
  const controlId = id || generatedId
  const hintId = `${controlId}-hint`
  return (
    <div data-labeled-field={label ? '' : undefined} className={styles.field} style={{ gap: spacing.xs, width: fullWidth ? '100%' : 'auto', minWidth: 0, maxWidth: '100%', ...wrapperStyle }}>
      {label && (
        <label htmlFor={controlId} style={{ ...typography.label, color: colors.text }}>
          {label}
        </label>
      )}
      <select
        id={controlId}
        className={[styles.control, styles.select, className].filter(Boolean).join(' ')}
        aria-describedby={[describedBy, hint ? hintId : undefined].filter(Boolean).join(' ') || undefined}
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          paddingBlock: spacing.sm,
          paddingLeft: spacing.md,
          fontSize: typography.sizeBase,
          fontFamily: typography.fontSans,
          color: colors.text,
          backgroundColor: colors.surface,
          minHeight: 42,
          width: fullWidth ? '100%' : 'auto',
          minWidth: 0,
          maxWidth: '100%',
          boxSizing: 'border-box' as const,
          cursor: 'pointer',
          ...style,
        }}
        {...props}
      >
        {children}
      </select>
      {hint && <span id={hintId} style={{ ...typography.helper, color: colors.textMuted }}>{hint}</span>}
    </div>
  )
}