'use client'

import { useEffect, useRef, type CSSProperties, type ChangeEvent, type MouseEvent, type ReactNode } from 'react'
import { colors, radius, spacing, typography } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'

export type DataTableSortDirection = 'asc' | 'desc'

export type DataTableSort<SortKey extends string> = {
  key: SortKey
  direction: DataTableSortDirection
}

export type DataTableColumn<Row, SortKey extends string> = {
  id: string
  header: ReactNode
  width: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  sortKey?: SortKey
  sortLabel?: string
  defaultSortDirection?: DataTableSortDirection
  render: (row: Row, index: number) => ReactNode
}

export type DataTableSelection<Row> = {
  selectedKeys: ReadonlySet<string>
  isSelectable?: (row: Row) => boolean
  onToggle: (row: Row, index: number, event: ChangeEvent<HTMLInputElement>) => void
  onToggleAll: () => void
  allSelected: boolean
  someSelected?: boolean
  selectAllLabel: string
  getRowLabel: (row: Row) => string
}

export interface ResponsiveDataTableProps<Row, SortKey extends string> {
  rows: Row[]
  columns: DataTableColumn<Row, SortKey>[]
  getRowKey: (row: Row) => string
  sort?: DataTableSort<SortKey>
  onSortChange?: (sort: DataTableSort<SortKey>) => void
  selection?: DataTableSelection<Row>
  loading?: boolean
  skeletonRows?: number
  emptyContent: ReactNode
  minDesktopWidth?: number | string
  mobileBreakpoint?: number
  onRowClick?: (row: Row, index: number, event: MouseEvent<HTMLElement>) => void
  getRowStyle?: (row: Row, index: number) => CSSProperties | undefined
  ariaLabel?: string
  style?: CSSProperties
}

interface DataGridTableProps {
  columns: string
  header: ReactNode
  children: ReactNode
  style?: CSSProperties
}

interface DataGridRowProps {
  columns: string
  children: ReactNode
  style?: CSSProperties
  as?: 'div' | 'button'
  onClick?: () => void
}

function IndeterminateCheckbox({
  indeterminate = false,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])

  return <input ref={ref} type="checkbox" {...props} />
}

function isInteractiveTarget(target: EventTarget | null, container: EventTarget | null) {
  if (!(target instanceof Element)) return false
  const interactive = target.closest('button, a, input, select, textarea, [role="button"]')
  return Boolean(interactive && interactive !== container)
}

function getNextSort<SortKey extends string>(
  column: DataTableColumn<unknown, SortKey>,
  current?: DataTableSort<SortKey>,
): DataTableSort<SortKey> | null {
  if (!column.sortable || !column.sortKey) return null
  if (current?.key === column.sortKey) {
    return { key: column.sortKey, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  }
  return { key: column.sortKey, direction: column.defaultSortDirection || 'asc' }
}

function SortIndicator({ active, direction }: { active: boolean, direction?: DataTableSortDirection }) {
  return <span aria-hidden="true">{active ? (direction === 'asc' ? '↑' : '↓') : '↕'}</span>
}

export function ResponsiveDataTable<Row, SortKey extends string>({
  rows,
  columns,
  getRowKey,
  sort,
  onSortChange,
  selection,
  loading = false,
  skeletonRows = 6,
  emptyContent,
  minDesktopWidth = 960,
  mobileBreakpoint = 960,
  onRowClick,
  getRowStyle,
  ariaLabel = 'Data table',
  style,
}: ResponsiveDataTableProps<Row, SortKey>) {
  const isMobile = useIsMobile(mobileBreakpoint)
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const columnTemplate = `${selection ? '48px ' : ''}${columns.map((column) => column.width).join(' ')}`
  const desktopMinWidth = typeof minDesktopWidth === 'number' ? `${minDesktopWidth}px` : minDesktopWidth
  const someSelected = selection?.someSelected ?? Boolean(selection && selection.selectedKeys.size > 0 && !selection.allSelected)

  const updateSort = (column: DataTableColumn<Row, SortKey>) => {
    const next = getNextSort(column as DataTableColumn<unknown, SortKey>, sort)
    if (next) onSortChange?.(next)
  }

  return (
    <div
      role="table"
      aria-label={ariaLabel}
      style={{
        ...desktopTableStyle,
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        ...style,
      }}
    >
      <div
        ref={headerScrollRef}
        style={{
          ...stickyHeaderViewportStyle,
          top: isMobile ? 56 : 0,
        }}
      >
        <div
          role="row"
          style={{
            ...desktopHeaderStyle,
            gridTemplateColumns: columnTemplate,
            minWidth: desktopMinWidth,
          }}
        >
          {selection && (
            <div
              role="columnheader"
              style={desktopSelectionCellStyle}
            >
              <IndeterminateCheckbox
                checked={selection.allSelected}
                indeterminate={someSelected}
                onChange={selection.onToggleAll}
                aria-label={selection.selectAllLabel}
                style={checkboxStyle}
              />
            </div>
          )}
          {columns.map((column) => {
            const active = Boolean(column.sortKey && sort?.key === column.sortKey)
            return (
              <div
                key={column.id}
                role="columnheader"
                aria-sort={column.sortable ? (active ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                style={{
                  ...desktopCellStyle,
                  justifyContent: alignToJustify(column.align),
                }}
              >
                {column.sortable ? (
                  <button
                    type="button"
                    onClick={() => updateSort(column)}
                    style={{ ...sortableHeaderStyle, justifyContent: alignToJustify(column.align) }}
                    aria-label={`${column.sortLabel || column.header}${active ? `, sorted ${sort?.direction === 'asc' ? 'ascending' : 'descending'}` : ''}`}
                  >
                    <span>{column.header}</span>
                    <SortIndicator active={active} direction={sort?.direction} />
                  </button>
                ) : column.header}
              </div>
            )
          })}
        </div>
      </div>

      <div
        onScroll={(event) => {
          if (headerScrollRef.current) headerScrollRef.current.scrollLeft = event.currentTarget.scrollLeft
        }}
        style={{
          ...tableBodyScrollerStyle,
          ...(isMobile ? mobileTableScrollerStyle : undefined),
        }}
      >
        <div style={{ minWidth: desktopMinWidth }}>

          {loading ? (
            Array.from({ length: skeletonRows }).map((_, rowIndex) => (
              <div key={rowIndex} role="row" style={{ ...desktopRowStyle, gridTemplateColumns: columnTemplate }}>
                {selection && (
                  <div>
                    <SkeletonBlock compact />
                  </div>
                )}
                {columns.map((column, columnIndex) => (
                  <div key={column.id}>
                    <SkeletonBlock compact={columnIndex !== 0} />
                  </div>
                ))}
              </div>
            ))
          ) : rows.length === 0 ? (
            <div style={emptyStyle}>{emptyContent}</div>
          ) : rows.map((row, index) => {
            const rowKey = getRowKey(row)
            const selected = selection?.selectedKeys.has(rowKey) || false
            const selectable = selection?.isSelectable?.(row) ?? true
            const customRowStyle = getRowStyle?.(row, index)
            const rowBackground = customRowStyle?.background || (selected ? colors.surfaceMuted : colors.surface)
            return (
              <div
                key={rowKey}
                role="row"
                aria-selected={selection ? selected : undefined}
                onClick={(event) => {
                  if (!onRowClick || isInteractiveTarget(event.target, event.currentTarget)) return
                  onRowClick(row, index, event)
                }}
                style={{
                  ...desktopRowStyle,
                  gridTemplateColumns: columnTemplate,
                  background: rowBackground,
                  cursor: onRowClick ? 'pointer' : 'default',
                  ...customRowStyle,
                }}
              >
                {selection && (
                  <div
                    role="cell"
                    style={desktopSelectionCellStyle}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={!selectable}
                      onChange={(event) => selection.onToggle(row, index, event)}
                      aria-label={`Select ${selection.getRowLabel(row)}`}
                      style={{ ...checkboxStyle, cursor: selectable ? 'pointer' : 'not-allowed' }}
                    />
                  </div>
                )}
                {columns.map((column) => (
                  <div
                    key={column.id}
                    role="cell"
                    style={{
                      ...desktopCellStyle,
                      justifyContent: alignToJustify(column.align),
                    }}
                  >
                    {column.render(row, index)}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function alignToJustify(align: DataTableColumn<unknown, string>['align']) {
  if (align === 'center') return 'center'
  if (align === 'right') return 'flex-end'
  return 'flex-start'
}

function SkeletonBlock({ compact = false }: { compact?: boolean }) {
  return <div style={{ ...skeletonBlockStyle, width: compact ? '64%' : '82%' }} />
}

// Low-level grid primitives retained for custom layouts.
export function DataGridTable({ columns, header, children, style }: DataGridTableProps) {
  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.xl, overflow: 'hidden', width: '100%', ...style }}>
      <div style={{ display: 'grid', gridTemplateColumns: columns, gap: spacing.md, padding: spacing.md, borderBottom: `1px solid ${colors.border}`, background: colors.surfaceMuted, color: colors.textSecondary, fontSize: typography.sizeXs, fontFamily: typography.fontSans, minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
        {header}
      </div>
      {children}
    </div>
  )
}

export function DataGridRow({ columns, children, style, as = 'div', onClick }: DataGridRowProps) {
  const sharedStyle: CSSProperties = {
    display: 'grid', gridTemplateColumns: columns, gap: spacing.md, padding: spacing.md,
    borderBottom: `1px solid ${colors.borderLight}`, alignItems: 'center', textAlign: 'left',
    width: '100%', minWidth: 0, fontFamily: typography.fontSans, fontSize: typography.sizeBase,
    fontWeight: typography.weightNormal, lineHeight: 1.45, whiteSpace: 'normal', overflowWrap: 'anywhere',
    background: colors.surface, ...style,
  }
  if (as === 'button') return <button type="button" onClick={onClick} style={sharedStyle}>{children}</button>
  return <div style={sharedStyle}>{children}</div>
}

const desktopTableStyle: CSSProperties = { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.xl, width: '100%', boxSizing: 'border-box', fontFamily: typography.fontSans }
const desktopHeaderStyle: CSSProperties = { display: 'grid', gap: spacing.md, padding: spacing.md, borderBottom: `1px solid ${colors.border}`, background: colors.surfaceMuted, color: colors.textSecondary, fontSize: typography.sizeXs, fontWeight: typography.weightMedium, alignItems: 'center' }
const desktopRowStyle: CSSProperties = { display: 'grid', gap: spacing.md, padding: spacing.md, borderBottom: `1px solid ${colors.borderLight}`, alignItems: 'center', width: '100%', minWidth: 0, boxSizing: 'border-box', color: colors.text, fontSize: typography.sizeBase, lineHeight: 1.45, transition: 'background 0.1s ease' }
const desktopCellStyle: CSSProperties = { display: 'flex', alignItems: 'center', minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }
const desktopSelectionCellStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center' }
const sortableHeaderStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: spacing.xs, width: '100%', padding: 0, border: 'none', background: 'transparent', color: colors.textSecondary, fontFamily: typography.fontSans, fontSize: typography.sizeXs, fontWeight: typography.weightMedium, cursor: 'pointer', textAlign: 'left' }
const mobileTableScrollerStyle: CSSProperties = { touchAction: 'pan-x pan-y', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }
const stickyHeaderViewportStyle: CSSProperties = { position: 'sticky', zIndex: 3, overflow: 'hidden', borderRadius: `${radius.xl} ${radius.xl} 0 0`, background: colors.surfaceMuted, boxShadow: `0 1px 0 ${colors.border}` }
const tableBodyScrollerStyle: CSSProperties = { overflowX: 'auto', borderRadius: `0 0 ${radius.xl} ${radius.xl}` }
const checkboxStyle: CSSProperties = { width: 18, height: 18, margin: 0, cursor: 'pointer' }
const emptyStyle: CSSProperties = { padding: '48px 24px', textAlign: 'center', color: colors.textMuted, fontFamily: typography.fontSans, fontSize: typography.sizeBase }
const skeletonBlockStyle: CSSProperties = { height: 14, borderRadius: radius.sm, background: colors.borderLight, animation: 'skeletonPulse 1.4s ease-in-out infinite' }