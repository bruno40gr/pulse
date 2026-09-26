'use client'
import { forwardRef, TextareaHTMLAttributes } from 'react'
import { colors, typography, radius, spacing } from '@/lib/tokens'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, hint, style, ...props }, ref) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        {label && (
          <label style={{ fontSize: typography.sizeSm, fontWeight: typography.weightMedium, color: colors.text, fontFamily: typography.fontSans }}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: `${spacing.sm} ${spacing.md}`,
            fontSize: typography.sizeBase,
            fontFamily: typography.fontSans,
            color: colors.text,
            background: colors.surface,
            outline: 'none',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            resize: 'vertical' as const,
            lineHeight: 1.6,
            boxSizing: 'border-box' as const,
            ...style,
          }}
          {...props}
        />
        {hint && <span style={{ fontSize: typography.sizeXs, color: colors.textMuted, fontFamily: typography.fontSans }}>{hint}</span>}
      </div>
    )
  }
)
