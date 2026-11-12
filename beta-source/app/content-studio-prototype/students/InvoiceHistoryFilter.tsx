'use client'

import { ControlButton } from '@/beta-source/components/ui/ControlButton'
import { visibleInvoiceHistory } from '@/beta-source/lib/academy-invoice-document'
import { spacing } from '@/beta-source/lib/tokens'

export type InvoiceHistoryView = 'all' | 'unpaid' | 'past'

export const filterInvoiceHistory = visibleInvoiceHistory

export function InvoiceHistoryFilter({ value, onChange }: { value: InvoiceHistoryView; onChange: (value: InvoiceHistoryView) => void }) {
  return <div role="group" aria-label="Invoice history" style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
    {(['all', 'unpaid', 'past'] as const).map(view => <ControlButton key={view} kind="toggle" aria-pressed={value === view} selected={value === view} onClick={() => onChange(view)}>{view === 'all' ? 'All invoices' : view === 'unpaid' ? 'Unpaid' : 'Past invoices'}</ControlButton>)}
  </div>
}