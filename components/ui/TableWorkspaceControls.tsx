'use client'

import { useId, type ReactNode } from 'react'
import { ControlButton } from './ControlButton'
import { Button } from './Button'
import { colors, radius, spacing, typography } from '@/lib/tokens'

/** Composition slots, not domain-specific search/filter logic. */
export function TableDiscoveryToolbar({ search, filters, view, preferences, chips }: {
  search: ReactNode; filters: ReactNode; view: ReactNode; preferences: ReactNode; chips?: ReactNode
}) {
  return <div style={{ marginBottom: spacing.sm }}>
    <div role="group" aria-label="Table discovery" style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 640px', maxWidth: 820, minWidth: 0 }}>{search}</div>
      {filters}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap', maxWidth: '100%' }}>{view}{preferences}</div>
    </div>
    {chips && <div aria-label="Applied filters" style={{ display: 'flex', gap: spacing.xs, flexWrap: 'wrap', marginTop: spacing.sm }}>{chips}</div>}
  </div>
}

export type TableContextAction = {
  id: string; label: string; onClick: () => void; disabledReason?: string
}

function ContextAction({ action }: { action: TableContextAction }) {
  const id = useId()
  return <span tabIndex={action.disabledReason ? 0 : undefined} aria-describedby={action.disabledReason ? id : undefined} title={action.disabledReason}>
    <Button size="toolbar" variant="ghost" style={{ color: colors.surface, padding: `${spacing.xs} ${spacing.md}` }} disabled={!!action.disabledReason} onClick={action.onClick}>{action.label}</Button>
    {action.disabledReason && <span id={id} style={{ position: 'absolute', width: 1, height: 1, padding: 0, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>{action.disabledReason}</span>}
  </span>
}

/** Domain adapters supply labels, eligibility and handlers; this bar owns presentation. */
export function TableContextActionBar({ resultLabel, selectedCount, selectionHint, actions, onClear }: {
  resultLabel?: string; selectedCount: number; selectionHint?: string; actions: TableContextAction[]; onClear: () => void
}) {
  return <div role="region" aria-label="Table results and actions" style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap', minHeight: 52, boxSizing: 'border-box', padding: `${spacing.xs} ${spacing.md}`, marginBottom: spacing.lg, borderRadius: radius.sm, border: `1px solid ${colors.link}`, background: colors.link, fontFamily: typography.fontSans }}>
    <div style={{ marginRight: 'auto', flex: '1 1 240px' }}>
      <span role="status" style={{ fontSize: typography.sizeBase, fontWeight: typography.weightSemibold, color: colors.surface }}>{resultLabel}{selectedCount > 0 ? `${resultLabel ? ' · ' : ''}${selectedCount} selected` : ''}</span>
      {selectionHint && <div style={{ fontSize: typography.sizeSm, color: colors.surface }}>{selectionHint}</div>}
    </div>
    <div role="group" aria-label="Selection actions" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs }}>
      {actions.map(action => <ContextAction key={action.id} action={action} />)}
      <span style={{ display: 'inline-flex', width: 48, minWidth: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>{selectedCount > 0 && <ControlButton kind="close" aria-label="Clear selection" title="Clear selection" style={{ color: colors.surface }} onClick={onClear} />}</span>
    </div>
  </div>
}
/** Both modes share a grid cell and stay mounted; inactive controls are inert and hidden. */
export function TableToolbarMode({ discovery, contextual, placement = 'replace' }: { discovery: ReactNode; contextual?: ReactNode; placement?: 'replace' | 'below' }) {
  if (placement === 'below') return <div data-table-toolbar-mode="stacked">
    {discovery}
    {contextual}
  </div>
  const active = !!contextual
  return <div data-table-toolbar-mode={active ? 'selection' : 'discovery'} style={{ display: 'grid' }}>
    <div inert={active} aria-hidden={active} style={{ gridArea: '1 / 1', visibility: active ? 'hidden' : 'visible', minWidth: 0 }}>{discovery}</div>
    <div inert={!active} aria-hidden={!active} style={{ gridArea: '1 / 1', visibility: active ? 'visible' : 'hidden', minWidth: 0 }}>{contextual}</div>
  </div>
}
