'use client'

import { type ReactNode } from 'react'
import { RichDataTable, type RichDataTableProps } from '@/components/ui/RichDataTable'
import { TablePersonName } from '@/components/ui/TablePersonName'
import { colors } from '@/lib/tokens'

export type FamilyListGroup<Row> = {
  id: string
  /** Only a verified person record, never a name/address match. */
  parent?: Row
  name: string
  subtitle: string
  contact?: ReactNode
  summaryCells?: Record<string, ReactNode>
  members: { id: string; row?: Row; name: string; detail?: string; isAccountHolder?: boolean }[]
}

/** Contacts interactions on the same grouped-row primitive used by released Leads. */
export default function FamilyListTable<Row, SortKey extends string>({ groups, nameColumn, contactColumn = 'contact', detailColumn = 'program', onToggleMembers, onOpenGroup, onOpenMember, ...table }: Omit<RichDataTableProps<Row, SortKey>, 'rows'> & {
  groups: FamilyListGroup<Row>[]; nameColumn: string; contactColumn?: string; detailColumn?: string
  onToggleMembers?: (rows: Row[], checked: boolean) => void
  onOpenGroup?: (group: FamilyListGroup<Row>) => void
  onOpenMember?: (row: Row) => void
}) {
  const source = table.selection
  const realRows = (group: FamilyListGroup<Row>) => [
    ...(group.parent ? [group.parent] : []),
    ...group.members.flatMap(member => member.row ? [member.row] : []),
  ]
  const selected = new Set(groups.filter(group => {
    const rows = realRows(group)
    return rows.length > 0 && rows.every(row => source?.selectedKeys.has(table.getRowKey(row)))
  }).map(group => group.id))

  return <RichDataTable<FamilyListGroup<Row>, SortKey>
    {...table}
    groupedRows
    rows={groups}
    getRowKey={group => group.id}
    columns={table.columns.map(column => ({
      ...column,
      render: (group, index) => {
        if (column.id === nameColumn) return <TablePersonName onOpen={onOpenGroup ? () => onOpenGroup(group) : undefined}>{group.name}</TablePersonName>
        if (group.parent) return column.render(group.parent, index)
        return group.summaryCells?.[column.id] ?? (column.id === contactColumn ? group.contact : null)
      },
    }))}
    getDetailRows={(group, index) => group.members.map(member => ({
      key: member.id,
      cells: table.columns.map(column => {
        if (column.id === nameColumn) return <TablePersonName key={column.id} detail={!member.isAccountHolder} onOpen={member.row && onOpenMember ? () => onOpenMember(member.row!) : undefined}>{member.name}</TablePersonName>
        if (member.row) return column.render(member.row, index)
        return column.id === detailColumn ? member.detail : null
      }),
    }))}
    selection={source ? {
      ...source,
      selectedKeys: selected,
      isSelectable: group => realRows(group).length > 0,
      getRowLabel: group => group.name,
      onToggle: (group, index, event) => {
        const rows = realRows(group)
        if (group.members.length && onToggleMembers) onToggleMembers(rows, event.target.checked)
        else if (group.parent) source.onToggle(group.parent, index, event)
        else for (const row of rows) {
          if (source.selectedKeys.has(table.getRowKey(row)) !== event.target.checked) source.onToggle(row, index, event)
        }
      },
    } : undefined}
    onRowClick={(group, index, event) => {
      if (onOpenGroup) onOpenGroup(group)
      else if (group.parent) table.onRowClick?.(group.parent, index, event)
    }}
    getRowStyle={(group, index) => ({
      ...(group.parent ? table.getRowStyle?.(group.parent, index) : undefined),
      background: selected.has(group.id) ? '#F5F8FF' : index % 2 === 0 ? colors.surface : colors.background,
    })}
  />
}