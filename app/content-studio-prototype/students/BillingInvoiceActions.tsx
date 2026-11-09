'use client'

import { useState } from 'react'
import { DenseSectionPanel, Input, Notice, Select } from '@/components/ui'
import { invoiceOutstanding, type FamilyAction, type PreviewInvoice } from '@/lib/academy-family-preview'
import { spacing } from '@/lib/tokens'
import { ConfirmActionButton } from './ConfirmActionButton'

export function BillingInvoiceActions({ invoice, onApply }: { invoice: PreviewInvoice; onApply: (action: FamilyAction) => string | null }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [release, setRelease] = useState(false)
  const [error, setError] = useState('')
  if (invoice.status !== 'Open') return null
  return <details><summary>Preview payment and void controls</summary><DenseSectionPanel title="Local billing simulation"><div style={{ display: 'grid', gap: spacing.md }}>
    <Notice>No real payment or refund is made. Voiding does not release coverage unless explicitly selected.</Notice>
    <Input label="Payment amount" type="number" min="0.01" step="0.01" max={invoiceOutstanding(invoice) / 100} value={amount} onChange={event => setAmount(event.target.value)} />
    <ConfirmActionButton onClick={() => setError(onApply({ kind: 'partial-invoice-payment', accountId: invoice.accountId, invoiceId: invoice.id, amountMinor: Math.round(Number(amount) * 100) }) || '')}>Record preview payment</ConfirmActionButton>
    {!invoice.paidMinor && <><Input label="Void reason" value={reason} onChange={event => setReason(event.target.value)} /><Select label="Voided coverage" value={release ? 'release' : 'retain'} onChange={event => setRelease(event.target.value === 'release')}><option value="retain">Keep coverage reserved</option><option value="release">Release for replacement billing</option></Select><ConfirmActionButton variant="destructive" onClick={() => setError(onApply({ kind: 'void-billing-invoice', accountId: invoice.accountId, invoiceId: invoice.id, reason, releaseCoverage: release }) || '')}>Void preview invoice</ConfirmActionButton></>}
    {error && <Notice variant="error">{error}</Notice>}
  </div></DenseSectionPanel></details>
}