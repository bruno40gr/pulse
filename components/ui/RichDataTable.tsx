'use client'

import type { ReactNode } from 'react'
import { ResponsiveDataTable, type ResponsiveDataTableProps } from './DataGridTable'
import { TableDisplayControls, useTablePreferences } from './TableDisplayControls'
import type { TablePreferenceSchema } from '@/lib/table-preferences'
import { spacing } from '@/lib/tokens'

export type RichDataTableProps<Row, SortKey extends string> = Omit<ResponsiveDataTableProps<Row, SortKey>, 'density' | 'minDesktopWidth'> & {
  preferenceSchema: TablePreferenceSchema
  toolbar?: ReactNode
  beforeTable?: ReactNode
  columnLabels?: Record<string, string>
}

/** Shared table surface: display controls, scoped preferences, geometry and detail projection. */
export function RichDataTable<Row, SortKey extends string>({ preferenceSchema, toolbar, beforeTable, columnLabels, columns, getDetailRows, ...table }: RichDataTableProps<Row, SortKey>) {
  const { preferences, updatePreferences } = useTablePreferences(preferenceSchema)
  const visibleColumns = columns.filter(column => preferences.columns.includes(column.id))
  const visibleIndexes = visibleColumns.map(column => columns.indexOf(column))
  const minWidth = (table.selection ? 48 : 0) + 32 + visibleColumns.reduce((width, column) => width + Number(column.width.match(/\d+/)?.[0] || 100) + 16, 0)
  return <>
    <div data-table-toolbar style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.lg }}>
      {toolbar}
      <TableDisplayControls columns={columns.map(column => ({ id: column.id, label: columnLabels?.[column.id] || String(column.header) }))}
        schema={preferenceSchema} preferences={preferences} onChange={updatePreferences} />
    </div>
    {beforeTable}
    <ResponsiveDataTable {...table} columns={visibleColumns} density={preferences.density} minDesktopWidth={minWidth}
      getDetailRows={getDetailRows ? (row, index) => getDetailRows(row, index).map(detail => ({ ...detail, cells: visibleIndexes.map(position => detail.cells[position]) })) : undefined} />
  </>
}