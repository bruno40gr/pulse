'use client'

import { useId, type ReactNode } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { ControlButton } from './ControlButton'
import { Button } from './Button'
import { interaction, colors, radius, spacing, typography } from '@/lib/tokens'
import styles from './TableWorkspaceControls.module.css'

/** Count and contextual actions occupy the same reserved row, never adding table height. */
export function TableResultsSlot({ result, contextual }: { result: ReactNode; contextual?: ReactNode }) {
  return <div className={styles.results} data-table-results>
    <div className={styles.resultLayer} inert={!!contextual} aria-hidden={!!contextual} style={{ visibility: contextual ? 'hidden' : 'visible', fontFamily: typography.fontSans, fontSize: typography.sizeBase, fontWeight: typography.weightMedium, color: colors.textSecondary }}>{result}</div>
    {contextual && <div className={styles.resultLayer}>{contextual}</div>}
  </div>
}

export function TableResultCount({ children }: { children: ReactNode }) {
  return <p role="status" style={{ margin: 0, fontFamily: typography.fontSans, fontSize: typography.sizeBase, fontWeight: typography.weightMedium, color: colors.textSecondary }}>{children}</p>
}

/** Search presentation is shared; each workspace owns query execution. */
export function TableSearchControl({ value, onChange, onSearch, onClear, label, placeholder, busy = false }: {
  value: string; onChange: (value: string) => void; onSearch: () => void; onClear: () => void; label: string; placeholder: string; busy?: boolean
}) {
  return <form role="search" aria-label={label} onSubmit={event => { event.preventDefault(); onSearch() }} style={{ display: 'flex', alignItems: 'center', minWidth: 0, boxSizing: 'border-box', minHeight: 46, background: colors.surface, border: `1px solid ${colors.textSecondary}`, borderRadius: radius.md, padding: `${spacing.xs} ${spacing.sm}`, gap: spacing.sm }}>
    <Search size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
    <input type="search" aria-label={label} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} style={{ flex: 1, width: 0, minWidth: 0, border: 0, outline: 'none', fontSize: typography.sizeBase, fontFamily: typography.fontSans, background: 'transparent' }} />
    {value && <ControlButton type="button" kind="icon" aria-label="Clear search" onClick={onClear}><X size={15} /></ControlButton>}
    <Button type="submit" size="sm" disabled={busy || !value.trim()} style={{ whiteSpace: 'nowrap' }}>{busy ? 'Searching…' : 'Search'}</Button>
  </form>
}

export function TableFiltersButton({ onClick, count = 0 }: { onClick: () => void; count?: number }) {
  return <Button type="button" variant="secondary" size="toolbar" aria-label="Filters" onClick={onClick}><SlidersHorizontal size={16} aria-hidden="true" />Filters{count > 0 && <span aria-label={`${count} filters applied`}>({count})</span>}</Button>
}

/** Composition slots, not domain-specific search/filter logic. */
export function TableDiscoveryToolbar({ search, filters, view, preferences, chips }: {
  search: ReactNode; filters: ReactNode; view: ReactNode; preferences: ReactNode; chips?: ReactNode
}) {
  return <div style={{ marginBottom: spacing.sm }}>
    <div role="group" aria-label="Table discovery" style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 280px', maxWidth: 820, minWidth: 0 }}>{search}</div>
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
    <Button size="toolbar" variant="ghost" style={{ color: interaction.onSelected, minHeight: 32, padding: `${spacing.xs} ${spacing.md}` }} disabled={!!action.disabledReason} onClick={action.onClick}>{action.label}</Button>
    {action.disabledReason && <span id={id} style={{ position: 'absolute', width: 1, height: 1, padding: 0, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>{action.disabledReason}</span>}
  </span>
}

/** Domain adapters supply labels, eligibility and handlers; this bar owns presentation. */
export function TableContextActionBar({ resultLabel, selectedCount, selectionHint, selectionNoun, actions, onClear }: {
  resultLabel?: string; selectedCount: number; selectionHint?: string; selectionNoun?: string; actions: TableContextAction[]; onClear: () => void
}) {
  return <div className={styles.actionBar} role="region" aria-label="Table results and actions" style={{ padding: `${spacing.xs} ${spacing.md}`, borderRadius: radius.sm, border: `1px solid ${interaction.selected}`, background: interaction.selected, fontFamily: typography.fontSans }}>
    <div style={{ marginRight: 'auto', minWidth: 0 }}>
      <span role="status" style={{ fontSize: typography.sizeBase, fontWeight: typography.weightMedium, color: interaction.onSelected }}>{selectedCount > 0 ? `${selectedCount}${selectionNoun ? ` ${selectedCount === 1 ? selectionNoun.replace(/s$/, '') : selectionNoun}` : ''}${resultLabel ? ` out of ${resultLabel}` : ''} selected` : resultLabel}</span>
      {selectionHint && <div style={{ fontSize: typography.sizeSm, color: interaction.onSelected }}>{selectionHint}</div>}
    </div>
    <div role="group" aria-label="Selection actions" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs }}>
      {actions.map(action => <ContextAction key={action.id} action={action} />)}
      {selectedCount > 0 && <ControlButton kind="icon" aria-label="Clear selection" title="Clear selection" style={{ color: interaction.onSelected }} onClick={onClear}><X size={20} aria-hidden="true" /></ControlButton>}
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
  return <div data-table-toolbar-mode={active ? 'selection' : 'discovery'} style={{ display: 'grid', position: 'relative' }}>
    <div inert={active} aria-hidden={active} style={{ gridArea: '1 / 1', visibility: active ? 'hidden' : 'visible', minWidth: 0 }}>{discovery}</div>
    <div className={styles.replacementLayer} inert={!active} aria-hidden={!active} style={{ visibility: active ? 'visible' : 'hidden' }}>{contextual}</div>
  </div>
}
