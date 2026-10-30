'use client'

import type { CSSProperties, ReactNode } from 'react'
import { colors, radius, shadows, spacing } from '@/lib/tokens'

interface SurfacePanelProps {
  children: ReactNode
  style?: CSSProperties
  padding?: string
  tone?: 'default' | 'muted' | 'warm'
  appearance?: 'raised' | 'flat'
}

const toneStyles: Record<NonNullable<SurfacePanelProps['tone']>, CSSProperties> = {
  default: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
  },
  muted: {
    background: colors.surfaceMuted,
    border: `1px solid ${colors.borderLight}`,
  },
  warm: {
    background: '#FCFBF8',
    border: `1px solid ${colors.border}`,
  },
}

export function SurfacePanel({ children, style, padding = spacing.xl, tone = 'default', appearance = 'raised' }: SurfacePanelProps) {
  return (
    <div
      style={{
        borderRadius: appearance === 'flat' ? radius.lg : radius.xl,
        boxShadow: appearance === 'flat' ? 'none' : shadows.sm,
        padding,
        ...toneStyles[tone],
        ...(appearance === 'flat' && tone === 'muted' ? { border: 'none' } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  )
}