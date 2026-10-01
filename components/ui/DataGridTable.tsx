'use client'

import { useEffect, useRef, type CSSProperties, type ChangeEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { colors, radius, spacing, typography } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'

export type DataTableSortDirection = 'asc' | 'desc'

export type DataTableSort<SortKey extends string> = {
  key: SortKey
  direction: DataTableSortDirection
}

export type DataTableSortOption<SortKey extends string> = {
  key: SortKey
  label: string
  defaultSortDirection?: DataTableSortDirection
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

export type DataTableMobileCard = {
  leading?: ReactNode
  title: ReactNode
  status?: ReactNode
  details?: ReactNode
  metadata?: ReactNode
  trailing?: ReactNode
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
  renderMobileCard: (row: Row, index: number) => DataTableMobileCard
  sort?: DataTableSort<SortKey>
  onSortChange?: (sort: DataTableSort<SortKey>) => void
  mobileSortOptions?: DataTableSortOption<SortKey>[]
  selection?: DataTableSelection<Row>
  loading?: boolean
  skeletonRows?: number
  emptyContent: ReactNode
  minDesktopWidth?: number | string
  mobileBreakpoint?: number
  onRowClick?: (row: Row, index: number, event: MouseEvent<HTMLElement>) => void
  getRowStyle?: (row: Row, index: number) => CSSProperties | undefined
  getMobileCardStyle?: (row: Row, index: number) => CSSProperties | undefined
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

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('button, a, input, select, textarea, [role="button"]'))
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
  renderMobileCard,
  sort,
  onSortChange,
  mobileSortOptions,
  selection,
  loading = false,
  skeletonRows = 6,
  emptyContent,
  minDesktopWidth = 960,
  mobileBreakpoint = 960,
  onRowClick,
  getRowStyle,
  getMobileCardStyle,
  ariaLabel = 'Data table',
  style,
}: ResponsiveDataTableProps<Row, SortKey>) {
  const isMobile = useIsMobile(mobileBreakpoint)
  const sortableColumns = columns.filter((column) => column.sortable && column.sortKey)
  const availableMobileSortOptions = mobileSortOptions || sortableColumns.map((column) => ({
    key: column.sortKey as SortKey,
    label: column.sortLabel || String(column.header),
    defaultSortDirection: column.defaultSortDirection,
  }))
  const columnTemplate = `${selection ? '48px ' : ''}${columns.map((column) => column.width).join(' ')}`
  const desktopMinWidth = typeof minDesktopWidth === 'number' ? `${minDesktopWidth}px` : minDesktopWidth
  const someSelected = selection?.someSelected ?? Boolean(selection && selection.selectedKeys.size > 0 && !selection.allSelected)

  const updateSort = (column: DataTableColumn<Row, SortKey>) => {
    const next = getNextSort(column as DataTableColumn<unknown, SortKey>, sort)
    if (next) onSortChange?.(next)
  }

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, width: '100%', ...style }}>
        {(availableMobileSortOptions.length > 0 || selection) && (
          <div style={mobileControlsStyle}>
            {selection && (
              <label style={mobileSelectAllStyle}>
                <IndeterminateCheckbox
                  checked={selection.allSelected}
                  indeterminate={someSelected}
                  onChange={selection.onToggleAll}
                  aria-label={selection.selectAllLabel}
                  style={checkboxStyle}
                />
                <span>{selection.allSelected ? 'Unselect all' : 'Select all'}</span>
              </label>
            )}
            {availableMobileSortOptions.length > 0 && sort && onSortChange && (
              <div style={mobileSortStyle}>
                <label style={mobileSortLabelStyle}>
                  <span>Sort by</span>
                  <select
                    value={sort.key}
                    onChange={(event) => {
                      const option = availableMobileSortOptions.find((candidate) => candidate.key === event.target.value)
                      if (option) onSortChange({ key: option.key, direction: option.defaultSortDirection || 'asc' })
                    }}
                    style={mobileSortSelectStyle}
                    aria-label="Sort field"
                  >
                    {availableMobileSortOptions.map((option) => (
                      <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => onSortChange({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
                  style={sortDirectionButtonStyle}
                  aria-label={`Sort ${sort.direction === 'asc' ? 'descending' : 'ascending'}`}
                >
                  {sort.direction === 'asc' ? '↑ Asc' : '↓ Desc'}
                </button>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div style={mobileListStyle} aria-label="Loading records">
            {Array.from({ length: skeletonRows }).map((_, index) => <MobileSkeleton key={index} />)}
          </div>
        ) : rows.length === 0 ? (
          <div style={emptyStyle}>{emptyContent}</div>
        ) : (
          <div role="list" aria-label={ariaLabel} style={mobileListStyle}>
            {rows.map((row, index) => {
              const rowKey = getRowKey(row)
              const card = renderMobileCard(row, index)
              const selected = selection?.selectedKeys.has(rowKey) || false
              const selectable = selection?.isSelectable?.(row) ?? true
              return (
                <div
                  key={rowKey}
                  role={onRowClick ? 'button' : 'listitem'}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={onRowClick ? `Open ${selection?.getRowLabel(row) || 'record'}` : undefined}
                  aria-selected={selection ? selected : undefined}
                  onClick={(event) => {
                    if (!onRowClick || isInteractiveTarget(event.target)) return
                    onRowClick(row, index, event)
                  }}
                  onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                    if (!onRowClick || isInteractiveTarget(event.target)) return
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onRowClick(row, index, event as unknown as MouseEvent<HTMLElement>)
                    }
                  }}
                  style={{
                    ...mobileCardStyle,
                    background: selected ? colors.surfaceMuted : colors.surface,
                    cursor: onRowClick ? 'pointer' : 'default',
                    ...getMobileCardStyle?.(row, index),
                  }}
                >
                  <div style={mobileCardHeaderStyle}>
                    <div style={mobileCardIdentityStyle}>
                      {selection && (
                        <span style={checkboxTouchTargetStyle} onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={!selectable}
                            onChange={(event) => selection.onToggle(row, index, event)}
                            aria-label={`Select ${selection.getRowLabel(row)}`}
                            style={{ ...checkboxStyle, cursor: selectable ? 'pointer' : 'not-allowed' }}
                          />
                        </span>
                      )}
                      {card.leading && <div style={mobileLeadingStyle}>{card.leading}</div>}
                      <div style={mobileTitleWrapStyle}>
                        <div style={mobileTitleStyle}>{card.title}</div>
                        {card.status && <div style={mobileStatusStyle}>{card.status}</div>}
                      </div>
                    </div>
                    {card.trailing && <div style={mobileTrailingStyle}>{card.trailing}</div>}
                  </div>
                  {card.details && <div style={mobileDetailsStyle}>{card.details}</div>}
                  {card.metadata && <div style={mobileMetadataStyle}>{card.metadata}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto', ...style }}>
      <div role="table" aria-label={ariaLabel} style={{ ...desktopTableStyle, minWidth: desktopMinWidth }}>
        <div role="row" style={{ ...desktopHeaderStyle, gridTemplateColumns: columnTemplate }}>
          {selection && (
            <div role="columnheader" style={desktopSelectionCellStyle}>
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
                style={{ ...desktopCellStyle, justifyContent: alignToJustify(column.align) }}
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

        {loading ? (
          Array.from({ length: skeletonRows }).map((_, rowIndex) => (
            <div key={rowIndex} role="row" style={{ ...desktopRowStyle, gridTemplateColumns: columnTemplate }}>
              {selection && <SkeletonBlock compact />}
              {columns.map((column, columnIndex) => <SkeletonBlock key={column.id} compact={columnIndex !== 0} />)}
            </div>
          ))
        ) : rows.length === 0 ? (
          <div style={emptyStyle}>{emptyContent}</div>
        ) : rows.map((row, index) => {
          const rowKey = getRowKey(row)
          const selected = selection?.selectedKeys.has(rowKey) || false
          const selectable = selection?.isSelectable?.(row) ?? true
          return (
            <div
              key={rowKey}
              role="row"
              aria-selected={selection ? selected : undefined}
              onClick={(event) => {
                if (!onRowClick || isInteractiveTarget(event.target)) return
                onRowClick(row, index, event)
              }}
              style={{
                ...desktopRowStyle,
                gridTemplateColumns: columnTemplate,
                background: selected ? colors.surfaceMuted : colors.surface,
                cursor: onRowClick ? 'pointer' : 'default',
                ...getRowStyle?.(row, index),
              }}
            >
              {selection && (
                <div role="cell" style={desktopSelectionCellStyle} onClick={(event) => event.stopPropagation()}>
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
                <div key={column.id} role="cell" style={{ ...desktopCellStyle, justifyContent: alignToJustify(column.align) }}>
                  {column.render(row, index)}
                </div>
              ))}
            </div>
          )
        })}
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

function MobileSkeleton() {
  return (
    <div style={mobileCardStyle}>
      <div style={mobileCardHeaderStyle}>
        <div style={{ ...skeletonBlockStyle, width: '52%', height: 18 }} />
        <div style={{ ...skeletonBlockStyle, width: 72, height: 22 }} />
      </div>
      <div style={{ ...skeletonBlockStyle, width: '74%' }} />
      <div style={{ ...skeletonBlockStyle, width: '62%' }} />
    </div>
  )
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

const desktopTableStyle: CSSProperties = { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.xl, overflow: 'hidden', width: '100%', boxSizing: 'border-box', fontFamily: typography.fontSans }
const desktopHeaderStyle: CSSProperties = { display: 'grid', gap: spacing.md, padding: spacing.md, borderBottom: `1px solid ${colors.border}`, background: colors.surfaceMuted, color: colors.textSecondary, fontSize: typography.sizeXs, fontWeight: typography.weightMedium, alignItems: 'center' }
const desktopRowStyle: CSSProperties = { display: 'grid', gap: spacing.md, padding: spacing.md, borderBottom: `1px solid ${colors.borderLight}`, alignItems: 'center', width: '100%', minWidth: 0, boxSizing: 'border-box', color: colors.text, fontSize: typography.sizeBase, lineHeight: 1.45, transition: 'background 0.1s ease' }
const desktopCellStyle: CSSProperties = { display: 'flex', alignItems: 'center', minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }
const desktopSelectionCellStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center' }
const sortableHeaderStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: spacing.xs, width: '100%', padding: 0, border: 'none', background: 'transparent', color: colors.textSecondary, fontFamily: typography.fontSans, fontSize: typography.sizeXs, fontWeight: typography.weightMedium, cursor: 'pointer', textAlign: 'left' }
const checkboxStyle: CSSProperties = { width: 18, height: 18, margin: 0, cursor: 'pointer' }
const checkboxTouchTargetStyle: CSSProperties = { width: 40, height: 40, margin: -11, marginRight: -5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const mobileControlsStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }
const mobileSelectAllStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: spacing.sm, color: colors.textSecondary, fontSize: typography.sizeSm, fontFamily: typography.fontSans, cursor: 'pointer' }
const mobileSortStyle: CSSProperties = { display: 'flex', alignItems: 'flex-end', gap: spacing.xs, marginLeft: 'auto' }
const mobileSortLabelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.xs, color: colors.textMuted, fontSize: typography.sizeXs, fontFamily: typography.fontSans }
const mobileSortSelectStyle: CSSProperties = { minHeight: 36, maxWidth: 170, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surface, color: colors.text, padding: `0 ${spacing.sm}`, fontFamily: typography.fontSans, fontSize: typography.sizeSm }
const sortDirectionButtonStyle: CSSProperties = { minHeight: 36, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.surface, color: colors.textSecondary, padding: `0 ${spacing.sm}`, fontFamily: typography.fontSans, fontSize: typography.sizeSm, cursor: 'pointer' }
const mobileListStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.md }
const mobileCardStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.sm, width: '100%', boxSizing: 'border-box', border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: spacing.lg, background: colors.surface, fontFamily: typography.fontSans, textAlign: 'left', transition: 'background 0.1s ease, border-color 0.1s ease', outlineOffset: 2 }
const mobileCardHeaderStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }
const mobileCardIdentityStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: spacing.sm, minWidth: 0, flex: 1 }
const mobileLeadingStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const mobileTitleWrapStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: spacing.xs, minWidth: 0, flex: 1 }
const mobileTitleStyle: CSSProperties = { color: colors.text, fontSize: typography.sizeBase, fontWeight: typography.weightBold, lineHeight: 1.35, overflowWrap: 'anywhere' }
const mobileStatusStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }
const mobileTrailingStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', flexShrink: 0 }
const mobileDetailsStyle: CSSProperties = { color: colors.textSecondary, fontSize: typography.sizeBase, lineHeight: 1.5, overflowWrap: 'anywhere' }
const mobileMetadataStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap', color: colors.textMuted, fontSize: typography.sizeSm, lineHeight: 1.45 }
const emptyStyle: CSSProperties = { padding: '48px 24px', textAlign: 'center', color: colors.textMuted, fontFamily: typography.fontSans, fontSize: typography.sizeBase }
const skeletonBlockStyle: CSSProperties = { height: 14, borderRadius: radius.sm, background: colors.borderLight, animation: 'skeletonPulse 1.4s ease-in-out infinite' }