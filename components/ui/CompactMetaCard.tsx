'use client'

import type { CSSProperties, ReactNode } from 'react'
import { colors, radius, spacing, typography } from '@/lib/tokens'

interface CompactMetaCardProps {
  children: ReactNode
  style?: CSSProperties
  fullWidth?: boolean
  align?: 'center' | 'start'
}

export function CompactMetaCard({ children, style, fullWidth = false, align = 'center' }: CompactMetaCardProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: align === 'start' ? 'flex-start' : 'center',
        minHeight: `calc(${typography.sizeSm} * 2 + ${spacing.sm})`,
        padding: `${spacing.xs} ${spacing.sm}`,
        borderRadius: radius.lg,
        border: `1px solid ${colors.border}`,
        background: colors.surface,
        color: colors.text,
        fontSize: typography.sizeSm,
        fontWeight: typography.weightSemibold,
        lineHeight: 1.2,
        fontFamily: typography.fontSans,
        width: fullWidth ? '100%' : undefined,
        maxWidth: fullWidth ? '100%' : undefined,
        minWidth: 0,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  )
}