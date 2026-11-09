'use client'

import { useState } from 'react'
import { Button, EmptyState, FieldGrid, Input, Modal, ModalBody, ModalFooter, ModalHeader, Select } from '@/components/ui'
import { invoiceTotal, type FamilyAction, type PreviewInvoice } from '@/lib/academy-family-preview'
import { previewMoney } from '@/lib/academy-student-preview'
import { formatScheduleDate } from '@/lib/academy-enrollment-schedule'
import { spacing } from '@/lib/tokens'
import { ConfirmActionButton } from './ConfirmActionButton'

/** Staff-only draft. Domain validation repeats every constraint at commit time. */
export function CombineInvoices({ invoices, accountId, onApply, onClose, onCreated }: { invoices: PreviewInvoice[]; accountId: string; onApply: (action: FamilyAction) => string | null; onClose: () => void; onCreated: (id: string) => void }) {
  const open = invoices.filter(invoice => invoice.accountId === accountId && invoice.status === 'Open')
  const payers = [...new Map(open.map(invoice => [invoice.payerId, invoice.payerName])).entries()]
  const [payerId, setPayerId] = useState(payers[0]?.[0] || '')
  const [selected, setSelected] = useState<string[]>([])
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [due, setDue] = useState(() => new Date().toISOString().slice(0, 10))
  const [review, setReview] = useState(false)
  const [error, setError] = useState('')
  const eligible = open.filter(invoice => invoice.payerId === payerId)
  const chosen = eligible.filter(invoice => selected.includes(invoice.id))
  const total = chosen.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0)
  return <Modal isOpen onClose={onClose} ariaLabel="Combine invoices" size="lg"><ModalHeader title="Combine invoices" onClose={onClose} /><ModalBody>
    <p>Create one payable invoice. Originals stay in history as replaced and cannot be paid separately. No payment is taken here.</p>
    {!review ? <div style={{ display: 'grid', gap: spacing.lg }}>
      <Select label="Payer" value={payerId} onChange={event => { setPayerId(event.target.value); setSelected([]); setError('') }}>{payers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: spacing.md }}><legend>Unpaid invoices</legend>{eligible.map(invoice => <label key={invoice.id} style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', minHeight: 44 }}><input type="checkbox" aria-label={`Select invoice ${invoice.id}`} checked={selected.includes(invoice.id)} onChange={event => { setSelected(current => event.target.checked ? [...current, invoice.id] : current.filter(id => id !== invoice.id)); setError('') }} /><span>{invoice.id} · {formatScheduleDate(invoice.date, { month: 'long', year: 'numeric' })} · {previewMoney(invoiceTotal(invoice), 'USD')}</span></label>)}</fieldset>
      {eligible.length < 2 && <EmptyState title="At least two unpaid invoices for the same payer are needed" />}
      <FieldGrid><Input type="date" label="Issue date" required value={date} onChange={event => setDate(event.target.value)} /><Input type="date" label="Due date" required min={date} value={due} onChange={event => setDue(event.target.value)} /></FieldGrid>
    </div> : <section aria-label="Combined invoice review" style={{ display: 'grid', gap: spacing.md }}>
      <p>Billed to {payers.find(([id]) => id === payerId)?.[1]} · Due {formatScheduleDate(due)}</p>
      {chosen.map(invoice => <div key={invoice.id}><strong>{invoice.id} · {formatScheduleDate(invoice.date, { month: 'long', year: 'numeric' })}</strong>{invoice.lines.map((line, index) => <p key={index}>{line.studentName} · {line.program} · {formatScheduleDate(`${line.period || invoice.date.slice(0, 7)}-01`, { month: 'long', year: 'numeric' })} · {line.quantity} lessons · {previewMoney(line.quantity * line.unitMinor, 'USD')}</p>)}</div>)}
      <strong>Total {previewMoney(total, 'USD')}</strong>
    </section>}
    {error && <p role="alert">{error}</p>}
  </ModalBody><ModalFooter><Button variant="secondary" onClick={onClose}>Cancel</Button>{review ? <><Button variant="secondary" onClick={() => setReview(false)}>Back</Button><ConfirmActionButton loadingLabel="Combining invoices" onClick={() => {
      const id = `DEMO-C-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
      const message = onApply({ kind: 'combine-invoices', accountId, invoiceIds: selected, id, date, due })
      if (message) setError(message); else onCreated(id)
    }}>Combine invoices</ConfirmActionButton></> : <Button disabled={chosen.length < 2} onClick={() => { if (!date || !due || due < date) { setError('Choose an issue date and a due date on or after it.'); return }; setError(''); setReview(true) }}>Review invoice</Button>}</ModalFooter></Modal>
}