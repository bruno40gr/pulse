'use client'

import type { SelectHTMLAttributes } from 'react'
import { colors, typography, radius, spacing } from '@/lib/tokens'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  fullWidth?: boolean
  wrapperStyle?: React.CSSProperties
}

export function Select({ label, hint, style, children, fullWidth = true, wrapperStyle, ...props }: SelectProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, width: fullWidth ? '100%' : 'auto', minWidth: 0, maxWidth: '100%', ...wrapperStyle }}>
      {label && (
        <label style={{ ...typography.label, color: colors.text }}>
          {label}
        </label>
      )}
      <select
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          padding: `${spacing.sm} ${spacing.md}`,
          fontSize: typography.sizeBase,
          fontFamily: typography.fontSans,
          color: colors.text,
          background: colors.surface,
          outline: 'none',
          width: fullWidth ? '100%' : 'auto',
          minWidth: 0,
          maxWidth: '100%',
          boxSizing: 'border-box' as const,
          cursor: 'pointer',
          appearance: 'auto',
          ...style,
        }}
        {...props}
      >
        {children}
      </select>
      {hint && <span style={{ ...typography.helper, color: colors.textMuted }}>{hint}</span>}
    </div>
  )
}