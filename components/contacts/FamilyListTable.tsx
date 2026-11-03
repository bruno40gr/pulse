'use client'

import { type ReactNode } from 'react'
import { RichDataTable, type RichDataTableProps } from '@/components/ui/RichDataTable'
import { TablePersonName } from '@/components/ui/TablePersonName'
import { colors, spacing } from '@/lib/tokens'

export type FamilyListGroup<Row> = {
  id: string
  /** Only a verified person record, never a name/address match. */
  parent?: Row
  selectionRows?: Row[]
  name: string
  subtitle: string
  contact?: ReactNode
  summaryCells?: Record<string, ReactNode>
  members: { id: string; row?: Row; name: string; detail?: string; isAccountHolder?: boolean }[]
}

/** Contacts interactions on the same grouped-row primitive used by released Leads. */
export default function FamilyListTable<Row, SortKey extends string>({ groups, nameColumn, contactColumn = 'contact', detailColumn = 'program', renderPersonRole, onOpenGroup, onOpenMember, isMessageTarget, ...table }: Omit<RichDataTableProps<Row, SortKey>, 'rows'> & {
  renderPersonRole?: (row: Row) => ReactNode
  groups: FamilyListGroup<Row>[]; nameColumn: string; contactColumn?: string; detailColumn?: string
  /** Rows that can never receive a message get no checkbox; context-only rows stay disabled. */
  isMessageTarget?: (row: Row) => boolean
  onOpenGroup?: (group: FamilyListGroup<Row>) => void
  onOpenMember?: (row: Row) => void
}) {
  const source = table.selection
  const realRows = (group: FamilyListGroup<Row>) => group.selectionRows ?? [
    ...(group.parent ? [group.parent] : []),
    ...group.members.flatMap(member => member.row ? [member.row] : []),
  ]
  const canSelect = (group: FamilyListGroup<Row>, row: Row) => realRows(group).some(candidate => table.getRowKey(candidate) === table.getRowKey(row))
  const selected = new Set(groups.filter(group => group.parent && source?.selectedKeys.has(table.getRowKey(group.parent))).map(group => group.id))

  return <RichDataTable<FamilyListGroup<Row>, SortKey>
    {...table}
    groupedRows
    rows={groups}
    getRowKey={group => group.id}
    columns={table.columns.map(column => ({
      ...column,
      render: (group, index) => {
        if (column.id === nameColumn) return <span style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0, flexWrap: 'wrap' }}>
          <TablePersonName onOpen={onOpenGroup ? () => onOpenGroup(group) : undefined}>{group.name}</TablePersonName>
          {group.parent && renderPersonRole?.(group.parent)}

        </span>
        if (group.summaryCells && column.id in group.summaryCells) return group.summaryCells[column.id]
        if (group.parent) return column.render(group.parent, index)
        return group.summaryCells?.[column.id] ?? (column.id === contactColumn ? group.contact : null)
      },
    }))}
    getDetailRows={(group, index) => group.members.map(member => ({
      key: member.id,
      style: { background: member.row && source?.selectedKeys.has(table.getRowKey(member.row)) ? colors.surfaceSelected : index % 2 === 0 ? colors.surface : colors.background },
      selection: source && member.row && (isMessageTarget?.(member.row) ?? true) ? {
        checked: source.selectedKeys.has(table.getRowKey(member.row)),
        disabled: !canSelect(group, member.row),
        label: `Select ${member.name}`,
        onChange: event => source.onToggle(member.row!, index, event),
      } : undefined,
      cells: table.columns.map(column => {
        if (column.id === nameColumn) return <div key={column.id} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0, flexWrap: 'wrap' }}>
          <TablePersonName detail={!member.isAccountHolder} onOpen={member.row && onOpenMember ? () => onOpenMember(member.row!) : undefined}>{member.name}</TablePersonName>
          {member.row && renderPersonRole?.(member.row)}
        </div>
        if (member.row) return column.render(member.row, index)
        return column.id === detailColumn ? member.detail : null
      }),
    }))}
    selection={source ? {
      ...source,
      selectedKeys: selected,
      showCheckbox: group => group.parent ? (isMessageTarget?.(group.parent) ?? true) && (source.showCheckbox?.(group.parent) ?? true) : false,
      isSelectable: group => Boolean(group.parent && canSelect(group, group.parent)),
      getRowLabel: group => group.name,
      // Family-wide double-click selection is gone: members that cannot receive are not selectable.
      onDoubleClick: undefined,
      onToggle: (group, index, event) => {
        if (group.parent) source.onToggle(group.parent, index, event)
      },
    } : undefined}
    onRowClick={(group, index, event) => {
      if (onOpenGroup) onOpenGroup(group)
      else if (group.parent) table.onRowClick?.(group.parent, index, event)
    }}
    getRowStyle={(group, index) => ({
      ...(group.parent ? table.getRowStyle?.(group.parent, index) : undefined),
      background: selected.has(group.id) ? colors.surfaceSelected : index % 2 === 0 ? colors.surface : colors.background,
    })}
  />
}