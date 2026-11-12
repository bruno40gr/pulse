'use client'
import { forwardRef, useId, type TextareaHTMLAttributes } from 'react'
import styles from './FormControl.module.css'
import { colors, typography, radius, spacing } from '@/beta-source/lib/tokens'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, hint, style, id, className, 'aria-describedby': describedBy, ...props }, ref) {
    const generatedId = useId()
    const controlId = id || generatedId
    const hintId = `${controlId}-hint`
    return (
      <div data-labeled-field={label ? '' : undefined} className={styles.field} style={{ gap: spacing.xs, width: '100%', minWidth: 0, maxWidth: '100%' }}>
        {label && (
          <label htmlFor={controlId} style={{ ...typography.label, color: colors.text }}>
            {label}
          </label>
        )}
        <textarea
          id={controlId}
          className={[styles.control, className].filter(Boolean).join(' ')}
          aria-describedby={[describedBy, hint ? hintId : undefined].filter(Boolean).join(' ') || undefined}
          ref={ref}
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: `${spacing.sm} ${spacing.md}`,
            fontSize: typography.sizeBase,
            fontFamily: typography.fontSans,
            color: colors.text,
            background: colors.surface,
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            resize: 'vertical' as const,
            lineHeight: 1.6,
            boxSizing: 'border-box' as const,
            ...style,
          }}
          {...props}
        />
        {hint && <span id={hintId} style={{ ...typography.helper, color: colors.textMuted }}>{hint}</span>}
      </div>
    )
  }
)
