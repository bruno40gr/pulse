'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ResponsiveDataTable } from './DataGridTable'
import { Input } from './Input'
import { Button } from './Button'
import { RecipientChip } from './RecipientChip'
import { PersonName } from './PersonName'
import { colors, spacing, typography } from '@/lib/tokens'

export interface PickerRecipient { id: string; name: string; detail: string; disabled?: boolean }

/** Shared SMS/email layout. The containing modal owns padding. */
export function RecipientPicker({ label, people, selected, onChange, query, onQueryChange, loading = false, fill = false, controls, detailLabel = 'Email' }: {
  label: string; people: PickerRecipient[]; selected: PickerRecipient[]; onChange: (ids: string[]) => void
  query: string; onQueryChange: (query: string) => void; loading?: boolean; fill?: boolean; controls?: ReactNode; detailLabel?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [visibleCount, setVisibleCount] = useState(10)
  const measurement = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const node = measurement.current
    if (!node) return
    const measure = () => {
      const widths = Array.from(node.querySelectorAll<HTMLElement>('[data-chip-measure]')).map(child => child.getBoundingClientRect().width)
      const suffix = node.querySelector<HTMLElement>('[data-summary-measure]')?.getBoundingClientRect().width || 0
      const width = node.clientWidth
      const gap = parseFloat(spacing.xs)
      for (let count = Math.min(10, selected.length); count >= 0; count--) {
        const items = widths.slice(0, count)
        if (count < selected.length) items.push(suffix)
        let rows = 1; let used = 0
        for (const item of items) {
          if (used > 0 && used + gap + item > width) { rows++; used = item }
          else used += (used > 0 ? gap : 0) + item
        }
        if (rows <= 2) { setVisibleCount(count); break }
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [selected])
  const selectedIds = selected.map(person => person.id)
  const eligible = people.filter(person => !person.disabled)
  const allSelected = eligible.length > 0 && eligible.every(person => selectedIds.includes(person.id))
  return <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, minWidth: 0, minHeight: 0, flex: fill ? 1 : undefined }}>
    <div style={{ flexShrink: 0 }}><Input aria-label={`Search ${label}`} placeholder="Search everyone…" value={query} onChange={event => onQueryChange(event.target.value)} /></div>
    {controls}
    <div style={{ flex: fill ? 1 : undefined, minHeight: fill ? 0 : undefined, maxHeight: fill ? undefined : 320, overflow: 'auto' }}>
      <ResponsiveDataTable rows={people} getRowKey={person => person.id} ariaLabel={`${label} search results`} minDesktopWidth={480} mobileBreakpoint={0} loading={loading} emptyContent="No matching contacts available."
        columns={[
          { id: 'name', header: 'Name', width: 'minmax(140px, 1fr)', render: person => <PersonName>{person.name}</PersonName> },
          { id: 'detail', header: detailLabel, width: 'minmax(220px, 1.5fr)', render: person => person.detail },
        ]}
        selection={{ selectedKeys: new Set(selectedIds), isSelectable: person => !person.disabled, allSelected, selectAllLabel: allSelected ? 'Deselect all' : 'Select all', getRowLabel: person => `${selectedIds.includes(person.id) ? 'Remove' : 'Add'} ${person.name} ${selectedIds.includes(person.id) ? 'from' : 'to'} ${label}`,
          onToggle: person => onChange(selectedIds.includes(person.id) ? selectedIds.filter(id => id !== person.id) : [...selectedIds, person.id]),
          onToggleAll: () => onChange(allSelected ? selectedIds.filter(id => !eligible.some(person => person.id === id)) : [...new Set([...selectedIds, ...eligible.map(person => person.id)])]),
        }} />
    </div>
    {selected.length > 0 && <div style={{ position: 'relative', minWidth: 0, flexShrink: 0 }}>
      <div ref={measurement} aria-hidden="true" inert style={{ position: 'absolute', inset: '0 0 auto', visibility: 'hidden', pointerEvents: 'none', display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
        {selected.slice(0, 10).map(person => <span data-chip-measure key={person.id} style={{ display: 'inline-flex', maxWidth: '100%' }}><RecipientChip name={person.name} removeLabel="Measure recipient" onRemove={() => {}} /></span>)}
        <span data-summary-measure style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, whiteSpace: 'nowrap' }}><span style={typography.bodySmall}>…and {selected.length} more</span><Button variant="secondary" size="sm">See all</Button></span>
      </div>
      <div role="group" aria-label={`${label} selected recipients`} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs, maxHeight: expanded ? 140 : undefined, overflowY: expanded ? 'auto' : undefined }}>
        {(expanded ? selected : selected.slice(0, visibleCount)).map(person => <RecipientChip key={person.id} name={person.name} removeLabel={`Remove ${person.name} from ${label}`} onRemove={() => onChange(selectedIds.filter(id => id !== person.id))} />)}
        {!expanded && selected.length > visibleCount && <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, whiteSpace: 'nowrap' }}><span style={{ ...typography.bodySmall, color: colors.text }}>…and {selected.length - visibleCount} more</span><Button variant="secondary" size="sm" aria-expanded={false} onClick={() => setExpanded(true)}>See all</Button></span>}
        {expanded && <Button variant="secondary" size="sm" aria-expanded={true} onClick={() => setExpanded(false)}>See fewer</Button>}
      </div>
    </div>}
  </div>
}