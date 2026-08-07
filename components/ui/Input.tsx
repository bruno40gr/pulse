'use client'
import { InputHTMLAttributes } from 'react'
import { colors, typography, radius, spacing } from '@/lib/tokens'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export function Input({ label, hint, error, style, ...props }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, width: '100%' }}>
      {label && (
        <label style={{ fontSize: typography.sizeSm, fontWeight: typography.weightMedium, color: colors.text, fontFamily: typography.fontSans }}>
          {label}
        </label>
      )}
      <input
        style={{
          border: `1px solid ${error ? colors.errorBorder : colors.border}`,
          borderRadius: radius.md,
          padding: `${spacing.sm} ${spacing.md}`,
          fontSize: typography.sizeBase,
          fontFamily: typography.fontSans,
          color: colors.text,
          background: colors.surface,
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box' as const,
          ...style,
        }}
        {...props}
      />
      {hint && !error && <span style={{ fontSize: typography.sizeXs, color: colors.textMuted, fontFamily: typography.fontSans }}>{hint}</span>}
      {error && <span style={{ fontSize: typography.sizeXs, color: colors.error, fontFamily: typography.fontSans }}>{error}</span>}
    </div>
  )
}