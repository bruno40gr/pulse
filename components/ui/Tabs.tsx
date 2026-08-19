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
}

export function Tabs<T extends string>({ items, activeKey, onChange, style }: TabsProps<T>) {
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
              padding: `${spacing.sm} ${spacing.md}`,
              fontSize: typography.sizeSm,
              fontWeight: active ? typography.weightSemibold : typography.weightMedium,
              color: active ? colors.text : colors.textMuted,
              cursor: 'pointer',
              fontFamily: typography.fontSans,
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing.xs,
            }}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span style={{ color: active ? colors.textSecondary : colors.textMuted }}>{tab.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}