'use client'

import type { CSSProperties, ReactNode } from 'react'
import { colors, radius, spacing, typography } from '@/lib/tokens'

interface DataGridTableProps {
  columns: string
  header: ReactNode
  children: ReactNode
  style?: CSSProperties
}

interface DataGridRowProps {
  columns: string
  children: ReactNode
  style?: CSSProperties
  as?: 'div' | 'button'
  onClick?: () => void
}

export function DataGridTable({ columns, header, children, style }: DataGridTableProps) {
  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.xl, overflow: 'hidden', width: '100%', ...style }}>
      <div style={{ display: 'grid', gridTemplateColumns: columns, gap: spacing.md, padding: spacing.md, borderBottom: `1px solid ${colors.border}`, background: colors.surfaceMuted, color: colors.textSecondary, fontSize: typography.sizeXs, fontFamily: typography.fontSans, minWidth: 0 }}>
        {header}
      </div>
      {children}
    </div>
  )
}

export function DataGridRow({ columns, children, style, as = 'div', onClick }: DataGridRowProps) {
  const sharedStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: columns,
    gap: spacing.md,
    padding: spacing.md,
    borderBottom: `1px solid ${colors.borderLight}`,
    alignItems: 'center',
    textAlign: 'left',
    width: '100%',
    minWidth: 0,
    background: colors.surface,
    ...style,
  }

  if (as === 'button') {
    return (
      <button type="button" onClick={onClick} style={sharedStyle}>
        {children}
      </button>
    )
  }

  return <div style={sharedStyle}>{children}</div>
}