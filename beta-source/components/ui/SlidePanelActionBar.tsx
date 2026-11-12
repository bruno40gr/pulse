'use client'

import type { ReactNode } from 'react'
import { colors, spacing } from '@/beta-source/lib/tokens'

/** Shared communication toolbar; callers retain routing and availability rules. */
export function SlidePanelActionBar({ children, isMobile }: { children: ReactNode; isMobile: boolean }) {
  return <div style={{
    display: 'flex',
    alignItems: isMobile ? 'stretch' : 'center',
    flexDirection: isMobile ? 'column' : 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    padding: isMobile ? '12px 16px' : `${spacing.md} ${spacing.lg}`,
    flexShrink: 0,
    minWidth: 0,
    borderBottom: `1px solid ${colors.borderLight}`,
    background: colors.surface,
  }}>{children}</div>
}