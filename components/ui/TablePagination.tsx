'use client'

import { Button } from './Button'
import { colors, spacing, typography } from '@/lib/tokens'

export function TablePagination({ page, pageCount, onPageChange, ariaLabel }: {
  page: number; pageCount: number; onPageChange: (page: number) => void; ariaLabel: string
}) {
  return <nav aria-label={ariaLabel} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.lg }}>
    <span style={{ color: colors.textMuted, fontFamily: typography.fontSans, fontSize: typography.sizeSm }}>Page {page} of {pageCount}</span>
    <Button variant="secondary" size="toolbar" disabled={page === 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
    <Button variant="secondary" size="toolbar" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>Next</Button>
  </nav>
}