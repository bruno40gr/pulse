'use client'

import type { ReactNode } from 'react'
import { SurfacePanel } from '@/components/ui/SurfacePanel'
import { ControlButton } from '@/components/ui/ControlButton'
import { colors, spacing, typography } from '@/lib/tokens'

/** Shared Contacts/teacher lesson card: identity and actions above lesson metadata. */
export function LessonCard({ title, subtitle, metadata, actions, leading, selected, onSelect, selectLabel }: {
  title: ReactNode; subtitle: ReactNode; metadata: ReactNode; actions?: ReactNode; leading?: ReactNode
  selected?: boolean; onSelect?: () => void; selectLabel?: string
}) {
  const identity = <><span style={{ ...typography.h2, margin: 0, color: colors.text, fontWeight: typography.weightBold }}>{title}</span><span style={{ ...typography.bodySmall, color: colors.textSecondary }}>{subtitle}</span></>
  return <SurfacePanel appearance="flat" padding={spacing.lg} style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.lg, minWidth: 0 }}>
      {leading}
      {onSelect ? <ControlButton kind="row" aria-label={selectLabel} aria-pressed={selected} onClick={onSelect} style={{ flex: 1, minWidth: 0, padding: 0, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', gap: spacing.xs, textAlign: 'left' }}>{identity}</ControlButton> : <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, flex: '1 1 200px', minWidth: 0 }}>{identity}</div>}
      {actions && <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, maxWidth: '100%', marginLeft: 'auto' }}>{actions}</div>}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', minWidth: 0, marginLeft: leading ? `calc(18px + ${spacing.lg})` : undefined }}>{metadata}</div>
  </SurfacePanel>
}