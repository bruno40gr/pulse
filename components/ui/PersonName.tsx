'use client'

import type { ComponentPropsWithoutRef } from 'react'
import { ControlButton } from './ControlButton'
import { colors, typography } from '@/lib/tokens'

const nameStyle = {
  fontFamily: typography.fontSans,
  fontSize: typography.size15,
  fontWeight: typography.weightBold,
  color: colors.text,
  textDecoration: 'none',
  minWidth: 0,
  overflowWrap: 'anywhere' as const,
}

/** The shared name treatment for people in CRM lists and conversations. */
export function PersonName({ children, ...props }: { children: React.ReactNode }) {
  return <span {...props} style={nameStyle}>{children}</span>
}

export function PersonNameButton({ style, ...props }: ComponentPropsWithoutRef<'button'>) {
  return <ControlButton kind="link" {...props} style={{ ...style, ...nameStyle }} />
}