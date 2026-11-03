'use client'

import { Button } from './Button'
import { Select } from './Select'
import { colors, spacing, typography } from '@/lib/tokens'

export function TablePagination({ page, pageCount, onPageChange, ariaLabel, pageSize, onPageSizeChange, pageSizeOptions = [25, 50, 100, 250], itemLabel = 'contacts' }: {
  page: number; pageCount: number; onPageChange: (page: number) => void; ariaLabel: string
  pageSize?: number; onPageSizeChange?: (size: number) => void; pageSizeOptions?: number[]; itemLabel?: string
}) {
  return <nav aria-label={ariaLabel} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.lg }}>
    {pageSize !== undefined && onPageSizeChange && <label style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginRight: 'auto', color: colors.textSecondary, fontFamily: typography.fontSans, fontSize: typography.sizeSm }}>
      Show <Select aria-label={`${itemLabel} per page`} controlSize="toolbar" fullWidth={false} value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value))}>
        {pageSizeOptions.map(size => <option key={size} value={size}>{size}</option>)}
      </Select> {itemLabel} per page
    </label>}
    <span style={{ color: colors.textMuted, fontFamily: typography.fontSans, fontSize: typography.sizeSm }}>Page {page} of {pageCount}</span>
    <Button variant="secondary" size="toolbar" disabled={page === 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
    <Button variant="secondary" size="toolbar" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>Next</Button>
  </nav>
}