'use client'

import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { spacing, typography, colors } from '@/lib/tokens'
export type TablePersonView = 'none' | 'family'

export function TablePersonViewToggle({ value, onChange, ariaLabel = 'Table view', individualLabel = 'Students' }: { value: TablePersonView; onChange: (view: TablePersonView) => void; ariaLabel?: string; individualLabel?: string }) {
  return <div role="group" aria-label={ariaLabel} style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, whiteSpace: 'nowrap', fontFamily: typography.fontSans, fontSize: typography.sizeBase, color: colors.textSecondary }}>
    <span>View as:</span>
    <span style={{ color: value === 'none' ? colors.text : colors.textMuted }}>{individualLabel}</span>
    <ToggleSwitch label="Families" checked={value === 'family'} onChange={checked => onChange(checked ? 'family' : 'none')} hideLabel />
    <span style={{ color: value === 'family' ? colors.text : colors.textMuted }}>Families</span>
  </div>
}
