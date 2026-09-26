'use client'

import type { CSSProperties } from 'react'
import { colors, spacing, typography } from '@/lib/tokens'

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
}

export function Tabs<T extends string>({ items, activeKey, onChange, style, compact = false }: TabsProps<T>) {
  return (
    <div style={{ display: 'flex', gap: spacing.xs, borderBottom: `1px solid ${colors.border}`, ...style }}>
      {items.map((tab) => {
        const active = tab.key === activeKey
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${active ? colors.crimson : 'transparent'}`,
              marginBottom: '-1px',
              padding: compact ? `${spacing.sm} ${spacing.xs}` : `${spacing.md} ${spacing.lg}`,
              fontSize: compact ? typography.sizeSm : typography.sizeMd,
              fontWeight: active ? typography.weightSemibold : typography.weightMedium,
              color: active ? colors.text : colors.textMuted,
              cursor: 'pointer',
              fontFamily: typography.fontSans,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: compact ? 'center' : undefined,
              gap: spacing.xs,
              flex: compact ? '1 1 0' : undefined,
              minWidth: 0,
              whiteSpace: 'nowrap',
            }}
          >
            <span>{tab.label}</span>
            {!compact && typeof tab.count === 'number' && (
              <span style={{ color: active ? colors.textSecondary : colors.textMuted, fontSize: typography.sizeMd }}>{tab.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}