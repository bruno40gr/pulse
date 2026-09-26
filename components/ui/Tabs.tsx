'use client'

import type { CSSProperties } from 'react'
import { colors, radius, spacing, typography } from '@/lib/tokens'

export interface TabItem<T extends string = string> {
  key: T
  label: string
  count?: number
}

interface TabsProps<T extends string = string> {
  items: TabItem<T>[]
  activeKey: T
  onChange: (key: T) => void
  style?: CSSProperties
  compact?: boolean
  variant?: 'underline' | 'prominent'
}

export function Tabs<T extends string>({ items, activeKey, onChange, style, compact = false, variant = 'underline' }: TabsProps<T>) {
  const prominent = variant === 'prominent'

  return (
    <div style={{
      display: 'flex',
      gap: prominent ? spacing.sm : spacing.xs,
      borderBottom: prominent ? 'none' : `1px solid ${colors.border}`,
      padding: prominent ? spacing.xs : 0,
      borderRadius: prominent ? radius.lg : 0,
      background: prominent ? colors.surfaceMuted : 'transparent',
      ...style,
    }}>
      {items.map((tab) => {
        const active = tab.key === activeKey
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            aria-pressed={active}
            style={{
              background: prominent && active ? colors.surface : 'transparent',
              border: prominent ? `1px solid ${active ? colors.border : 'transparent'}` : 'none',
              borderBottom: prominent ? undefined : `2px solid ${active ? colors.crimson : 'transparent'}`,
              borderRadius: prominent ? radius.md : 0,
              boxShadow: prominent && active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              marginBottom: prominent ? 0 : '-1px',
              padding: compact ? `${spacing.sm} ${spacing.xs}` : prominent ? `${spacing.md} ${spacing.xl}` : `${spacing.md} ${spacing.lg}`,
              fontSize: compact ? typography.sizeSm : typography.sizeMd,
              fontWeight: active ? typography.weightSemibold : typography.weightMedium,
              color: active ? colors.text : colors.textMuted,
              cursor: 'pointer',
              fontFamily: typography.fontSans,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: compact ? 'center' : undefined,
              gap: spacing.xs,
              flex: compact || prominent ? '1 1 0' : undefined,
              minWidth: 0,
              whiteSpace: 'nowrap',
            }}
          >
            <span>{tab.label}</span>
            {!compact && typeof tab.count === 'number' && (
              <span style={{
                color: active ? colors.textSecondary : colors.textMuted,
                fontSize: typography.sizeSm,
                padding: prominent ? '1px 6px' : 0,
                borderRadius: radius.full,
                background: prominent ? colors.backgroundSecondary : 'transparent',
              }}>{tab.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}