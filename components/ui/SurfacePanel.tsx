'use client'

import type { CSSProperties, ReactNode } from 'react'
import { colors, radius, shadows, spacing } from '@/lib/tokens'

interface SurfacePanelProps {
  children: ReactNode
  style?: CSSProperties
  padding?: string
  tone?: 'default' | 'muted' | 'warm'
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

export function SurfacePanel({ children, style, padding = spacing.xl, tone = 'default' }: SurfacePanelProps) {
  return (
    <div
      style={{
        borderRadius: radius.xl,
        boxShadow: shadows.sm,
        padding,
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        ...toneStyles[tone],
        ...style,
      }}
    >
      {children}
    </div>
  )
}