'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ResponsiveDataTable, type ResponsiveDataTableProps } from '@/components/ui'
import { ControlButton } from '@/components/ui/ControlButton'
import { PersonName } from '@/components/ui/PersonName'
import { colors, spacing, typography } from '@/lib/tokens'

export type FamilyListGroup<Row> = {
  id: string
  /** A real row (Leads), or a presentation-only account summary (Contacts). */
  parent?: Row
  name: string
  subtitle: string
  contact?: ReactNode
  members: { id: string; row?: Row; name: string; detail?: string }[]
}
type Entry<Row> = { id: string; row?: Row; group: FamilyListGroup<Row>; child: boolean; name: string; detail?: string }

/** Adds hierarchy to the existing table, without introducing any messaging identities. */
export default function FamilyListTable<Row, SortKey extends string>({ groups, nameColumn, contactColumn = 'contact', detailColumn = 'program', onToggleMembers, ...table }: Omit<ResponsiveDataTableProps<Row, SortKey>, 'rows'> & {
  groups: FamilyListGroup<Row>[]; nameColumn: string; contactColumn?: string; detailColumn?: string
  /** Atomically select only this filtered family's real records, without range selection. */
  onToggleMembers?: (rows: Row[], checked: boolean) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setCollapsed(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const entries: Entry<Row>[] = groups.flatMap(group => [
    { id: group.id, row: group.parent, group, child: false, name: group.name },
    ...(!collapsed.has(group.id) ? group.members.map(member => ({ ...member, group, child: true })) : []),
  ])
  const source = table.selection
  const selected = new Set<string>()
  for (const entry of entries) {
    if (entry.row && source?.selectedKeys.has(table.getRowKey(entry.row))) selected.add(entry.id)
    else if (!entry.row && !entry.child && entry.group.members.length && entry.group.members.every(member => member.row && source?.selectedKeys.has(table.getRowKey(member.row)))) selected.add(entry.id)
  }
  const columns = table.columns.map(column => ({
    ...column,
    render: (entry: Entry<Row>, index: number) => {
      if (column.id === nameColumn) return <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0, paddingLeft: entry.child ? spacing.xl : 0 }}>
        {!entry.child && entry.group.members.length > 0 && <ControlButton kind="icon" aria-label={`${collapsed.has(entry.group.id) ? 'Expand' : 'Collapse'} ${entry.name}`} aria-expanded={!collapsed.has(entry.group.id)} onClick={() => toggle(entry.group.id)}>
          {collapsed.has(entry.group.id) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </ControlButton>}
        {entry.child && <span aria-hidden="true" style={{ color: colors.textMuted }}>↳</span>}
        <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {entry.row ? column.render(entry.row, index) : <PersonName>{entry.name}</PersonName>}
          {!entry.child && <div style={{ color: colors.textSecondary, fontSize: typography.sizeSm }}>{entry.group.subtitle}</div>}
        </div>
      </div>
      if (entry.row) return column.render(entry.row, index)
      if (!entry.child && column.id === contactColumn) return entry.group.contact
      if (entry.child && column.id === detailColumn) return entry.detail || '—'
      return null
    },
  }))
  return <ResponsiveDataTable<Entry<Row>, SortKey>
    {...table}
    rows={entries}
    columns={columns}
    getRowKey={entry => entry.id}
    getDetailRows={table.getDetailRows ? (entry, index) => entry.row ? table.getDetailRows!(entry.row, index) : [] : undefined}
    selection={source ? {
      ...source,
      selectedKeys: selected,
      isSelectable: entry => Boolean(entry.row || (!entry.child && entry.group.members.some(member => member.row))),
      getRowLabel: entry => entry.name,
      onToggle: (entry, index, event) => {
        if (entry.row) source.onToggle(entry.row, index, event)
        else if (!entry.child) {
          if (onToggleMembers) onToggleMembers(entry.group.members.flatMap(member => member.row ? [member.row] : []), event.target.checked)
          else for (const member of entry.group.members) {
            if (member.row && source.selectedKeys.has(table.getRowKey(member.row)) !== event.target.checked) source.onToggle(member.row, index, event)
          }
        }
      },
    } : undefined}
    onRowClick={(entry, index, event) => {
      if (entry.row) table.onRowClick?.(entry.row, index, event)
      else if (!entry.child) toggle(entry.group.id)
      else if (entry.group.parent) table.onRowClick?.(entry.group.parent, index, event)
    }}
    getRowStyle={entry => entry.row ? table.getRowStyle?.(entry.row, 0) : undefined}
  />
}