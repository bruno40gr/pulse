'use client'
import { ButtonBase } from '@/components/ui/ButtonBase'


import type { CSSProperties } from 'react'
import { interaction, semanticColors, colors, radius, spacing, typography } from '@/lib/tokens'

export interface TabItem<T extends string = string> {
  key: T
  label: string
  count?: number
  countAppearance?: 'bubble'
  notificationCount?: number
}

interface TabsProps<T extends string = string> {
  items: TabItem<T>[]
  activeKey: T
  onChange: (key: T) => void
  style?: CSSProperties
  compact?: boolean
  variant?: 'underline' | 'prominent'
  ariaLabel?: string
  controlSize?: 'default' | 'toolbar'
}

export function Tabs<T extends string>({ items, activeKey, onChange, style, compact = false, variant = 'underline', ariaLabel, controlSize = 'default' }: TabsProps<T>) {
  const prominent = variant === 'prominent'
  const toolbar = controlSize === 'toolbar'

  return (
    <div role={ariaLabel ? 'group' : undefined} aria-label={ariaLabel} style={{
      display: 'flex',
      gap: prominent ? spacing.sm : spacing.xs,
      borderBottom: prominent ? 'none' : `1px solid ${colors.border}`,
      padding: prominent ? spacing.xs : 0,
      borderRadius: prominent ? radius.lg : 0,
      background: prominent ? colors.surfaceMuted : 'transparent',
      ...(toolbar ? { padding: spacing.xs, gap: 2, border: `1px solid ${colors.border}`, borderRadius: radius.md, boxSizing: 'border-box', minHeight: 46, height: 'auto', alignItems: 'stretch', flexShrink: 0 } : {}),
      ...style,
    }}>
      {items.map((tab) => {
        const active = tab.key === activeKey
        return (
          <ButtonBase
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            aria-pressed={active}
            style={{
              background: prominent && active ? interaction.selectedSurface : 'transparent',
              border: prominent ? `1px solid ${active ? interaction.selected : 'transparent'}` : 'none',
              ...(!prominent ? { borderBottom: `2px solid ${active ? interaction.selected : 'transparent'}` } : {}),
              borderRadius: prominent ? radius.md : 0,
              boxShadow: prominent && active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              marginBottom: prominent ? 0 : '-1px',
              padding: compact ? `${spacing.sm} ${spacing.xs}` : prominent ? `${spacing.md} ${spacing.xl}` : `${spacing.md} ${spacing.lg}`,
              fontSize: typography.sizeMd,
              fontWeight: active ? typography.weightSemibold : typography.weightMedium,
              color: active ? interaction.selectedText : colors.textMuted,
              cursor: 'pointer',
              fontFamily: typography.fontSans,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: compact ? 'center' : undefined,
              gap: spacing.xs,
              flex: compact || prominent ? '1 1 0' : undefined,
              minWidth: 0,
              whiteSpace: 'nowrap',
              ...(toolbar ? { padding: `${spacing.xs} ${spacing.sm}`, fontSize: typography.sizeBase, lineHeight: 1.4, minHeight: 36, height: 'auto', boxSizing: 'border-box', borderRadius: radius.sm, margin: 0, boxShadow: 'none', flex: '1 0 auto' } : {}),
            }}
          >
            <span>{tab.label}</span>
            {typeof tab.notificationCount === 'number' && tab.notificationCount > 0 && <span
              aria-label={`${tab.notificationCount} new ${tab.label.toLowerCase()}`}
              style={{ display: 'inline-block', minWidth: 19, height: 19, padding: '0 5px', boxSizing: 'border-box',
                borderRadius: radius.full, background: semanticColors.newLead.border, color: colors.surface, fontSize: typography.sizeXs,
                fontWeight: typography.weightBold, lineHeight: '19px', textAlign: 'center' }}>
              {tab.notificationCount}
            </span>}
            {(!compact || tab.countAppearance === 'bubble') && typeof tab.count === 'number' && (
              <span style={{
                color: active ? colors.textSecondary : colors.textMuted,
                fontSize: typography.sizeSm,
                padding: prominent || tab.countAppearance === 'bubble' ? '1px 6px' : 0,
                borderRadius: radius.full,
                background: prominent || tab.countAppearance === 'bubble' ? colors.backgroundSecondary : 'transparent',
              }}>{tab.count}</span>
            )}
          </ButtonBase>
        )
      })}
    </div>
  )
}