'use client'

import { useEffect, useState } from 'react'
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, Notice, Select, Textarea } from '@/components/ui'
import { getAllowedInvoiceStatuses, INVOICE_STATUS_LABELS, validateInvoiceStatusChange } from '@/lib/funding/invoice-status'
import type { FundingInvoice, FundingInvoiceStatus } from './types'

interface InvoiceStatusModalProps {
  invoice: FundingInvoice | null
  onClose: () => void
  onSave: (input: { status: FundingInvoiceStatus; evidence: string; note: string; paidOn: string | null }) => Promise<void>
}

export function InvoiceStatusModal({ invoice, onClose, onSave }: InvoiceStatusModalProps) {
  const allowed = invoice ? getAllowedInvoiceStatuses(invoice.status) : []
  const [status, setStatus] = useState<FundingInvoiceStatus>('pending')
  const [evidence, setEvidence] = useState('')
  const [note, setNote] = useState('')
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!invoice) return
    setStatus(allowed[0] || invoice.status)
    setEvidence('')
    setNote('')
    setPaidOn(new Date().toISOString().slice(0, 10))
    setError('')
  }, [invoice]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!invoice) return
    const validationError = validateInvoiceStatusChange({ fromStatus: invoice.status, toStatus: status, evidence, paidOn })
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({ status, evidence: evidence.trim(), note: note.trim(), paidOn: status === 'paid' ? paidOn : null })
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update invoice status.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={Boolean(invoice)} onClose={saving ? undefined : onClose} size="md" ariaLabel="Update invoice status">
      <ModalHeader
        title="Update invoice status"
        description={invoice ? `${invoice.invoiceNumber} is currently ${INVOICE_STATUS_LABELS[invoice.status].toLowerCase()}.` : undefined}
        onClose={saving ? undefined : onClose}
      />
      <ModalBody style={{ display: 'grid', gap: 18 }}>
        {error && <Notice variant="error">{error}</Notice>}
        <Select label="New status" value={status} onChange={event => setStatus(event.target.value as FundingInvoiceStatus)}>
          {allowed.map(value => <option key={value} value={value}>{INVOICE_STATUS_LABELS[value]}</option>)}
        </Select>
        {(status === 'rejected' || invoice?.status === 'paid') && (
          <Textarea
            label={status === 'rejected' ? 'Rejection evidence' : 'Reopening evidence'}
            value={evidence}
            onChange={event => setEvidence(event.target.value)}
            rows={4}
            required
            hint={status === 'rejected' ? 'Record the payer response, rejection code, or other explicit evidence. Overdue status alone is not rejection evidence.' : 'Explain why this paid invoice must be reopened.'}
          />
        )}
        {status === 'paid' && <Input label="Paid date" type="date" value={paidOn} onChange={event => setPaidOn(event.target.value)} required />}
        <Textarea label="Internal note (optional)" value={note} onChange={event => setNote(event.target.value)} rows={3} />
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={() => void handleSave()} disabled={saving || allowed.length === 0}>{saving ? 'Saving…' : 'Save status'}</Button>
      </ModalFooter>
    </Modal>
  )
}