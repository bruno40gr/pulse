'use client'

import { ConfirmActionButton } from './ConfirmActionButton'

import { useState } from 'react'
import { Badge, Button, DenseSectionPanel, FieldGrid, FieldValue, Input, Modal, ModalHeader, ModalBody, ModalFooter, SectionTitle, Select, SurfacePanel, Textarea } from '@/components/ui'
import { ArrowRight, FileText, Download } from 'lucide-react'
import { invoiceLineCoverage, invoicePdf, invoiceStatus } from '@/lib/academy-invoice-document'
import { invoiceCoverageLabel, invoiceOutstanding, invoiceRecipient, invoiceTotal, type PreviewCard, type PreviewInvoice } from '@/lib/academy-family-preview'
import { formatScheduleDate } from '@/lib/academy-enrollment-schedule'
import { previewMoney } from '@/lib/academy-student-preview'
import { colors, spacing, typography } from '@/lib/tokens'
import styles from './InvoicePreview.module.css'
import { SectionHeader, SectionHeading } from './SectionHeader'

/** Keep invoice values precise; omit unnecessary cents only on payment entry actions. */
export function paymentEntryLabel(amountMinor: number) {
  return `Pay ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2 }).format(amountMinor / 100)}`
}

export function downloadInvoice(invoice: PreviewInvoice) {
  const url = URL.createObjectURL(new Blob([invoicePdf(invoice)], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url; link.download = `invoice-${invoice.id.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`
  document.body.appendChild(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function InvoiceState({ invoice }: { invoice: PreviewInvoice }) {
  const status = invoiceStatus(invoice)
  return <Badge variant={status === 'Paid' ? 'success' : status === 'Overdue' ? 'error' : status === 'Open' ? 'warning' : 'neutral'} size="sm">{status}</Badge>
}

export function InvoiceCard({ invoice, onView, onPay }: { invoice: PreviewInvoice; onView: () => void; onPay?: () => void }) {
  return <DenseSectionPanel title={<div style={{ minWidth: 0, flex: '1 1 260px' }}>
    <div className={styles.identity}><FileText size={22} aria-hidden="true" /><SectionTitle as="h4" variant="card">Invoice · {invoiceCoverageLabel(invoice) || formatScheduleDate(invoice.date, { month: 'long', year: 'numeric' })}</SectionTitle><InvoiceState invoice={invoice} /></div>
    <div style={{ ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs }}>{invoice.id}</div>
    <div className={styles.amount} style={{ marginTop: spacing.sm }}><FieldValue>{previewMoney(invoiceTotal(invoice), 'USD')}</FieldValue><span style={{ ...typography.bodySmall, color: colors.textSecondary }}>· Due {formatScheduleDate(invoice.due)}{invoice.status === 'Paid' ? ' · Settled' : ''}</span></div>
  </div>} actions={<div className={`${styles.actions} ${styles.actionPair}`}><Button variant="secondary" size="md" aria-label={`View invoice ${invoice.id}`} onClick={onView}>View invoice</Button><Button variant="secondary" size="md" aria-label={`Download invoice ${invoice.id}`} onClick={() => downloadInvoice(invoice)}>Download PDF</Button>{onPay && invoice.status === 'Open' && <Button size="md" variant={invoiceStatus(invoice) === 'Overdue' ? 'destructive' : 'secondary'} style={invoiceStatus(invoice) === 'Overdue' ? { border: '1px solid transparent' } : undefined} className={styles.paymentButton} onClick={onPay}>{paymentEntryLabel(invoiceOutstanding(invoice))}<ArrowRight size={16} aria-hidden="true" /></Button>}</div>} contentStyle={{ display: 'none' }}>{null}</DenseSectionPanel>
}

export function InvoicePayControls({ invoice, payers, cards, onPay, billingAccountName, billingAccountPayerId, onOpenBillingAccount }: { billingAccountName?: string; billingAccountPayerId?: string; onOpenBillingAccount?: (payerId: string) => void; invoice: PreviewInvoice; payers: { id: string; name: string }[]; cards: PreviewCard[]; onPay: (payerId: string, cardId: string) => void }) {
  const [payerId, setPayerId] = useState(invoice.payerId || payers[0]?.id || '')
  const payerName = payers.find(payer => payer.id === payerId)?.name || 'Selected payer'
  const payerCards = cards.filter(card => card.payerId === payerId)
  const [cardId, setCardId] = useState(() => (payerCards.find(card => card.isDefault) || payerCards[0])?.id || '')
  return <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
    <p style={{ ...typography.bodySmall, color: colors.textSecondary }}>No real charges in this preview.</p>
    <FieldGrid>
      <Select label="Paying as" value={payerId} onChange={event => { const next = event.target.value; setPayerId(next); const fallback = cards.find(card => card.payerId === next && card.isDefault) || cards.find(card => card.payerId === next); setCardId(fallback?.id || '') }}>{payers.map(payer => <option key={payer.id} value={payer.id}>{payer.name}</option>)}</Select>
      <Select label={`${payerName}’s payment method`} value={cardId} onChange={event => setCardId(event.target.value)}>{payerCards.map(card => <option key={card.id} value={card.id}>{card.label}{card.cardholderName ? ` · ${card.cardholderName}` : ''}{card.isDefault ? ' · Default' : ''}</option>)}{!payerCards.length && <option value="">No card on file</option>}</Select>
    </FieldGrid>
    {!payerCards.length && <div><p style={{ ...typography.bodySmall, margin: 0 }}>No saved payment method for {payerName}. Payment methods are managed on the payer’s account.</p>{payerId === billingAccountPayerId && onOpenBillingAccount && <Button variant="secondary" onClick={() => onOpenBillingAccount(payerId)}>Open {billingAccountName}’s account</Button>}</div>}
    <div className={styles.actions}><ConfirmActionButton variant="secondary" className={styles.paymentButton} loadingLabel="Paying" onClick={() => onPay(payerId, cardId)} disabled={!cardId}>Pay</ConfirmActionButton></div>
  </div>
}

export function InvoicePreview({ invoice, onBack, onPay, onRefund, onSaveDetails }: { invoice: PreviewInvoice; onBack: () => void; onPay?: () => void; onRefund?: (reason: string) => string | null; onSaveDetails?: (customFields: NonNullable<PreviewInvoice['customFields']>, notes: string) => string | null }) {
  const [editing, setEditing] = useState(false)
  const [fields, setFields] = useState(invoice.customFields || [])
  const [notes, setNotes] = useState(invoice.notes || '')
  const [error, setError] = useState('')
  const [refunding, setRefunding] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [refundError, setRefundError] = useState('')
  const statement = invoice.id.startsWith('STATEMENT')
  const total = invoiceTotal(invoice)
  return <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
    <SectionHeader onBack={onBack} backLabel="Back to invoices" actions={onSaveDetails && !statement && <Button variant="secondary" size="md" disabled={editing} onClick={() => { setFields(invoice.customFields || []); setNotes(invoice.notes || ''); setError(''); setEditing(true) }}>Customize invoice fields</Button>}><SectionHeading>{statement ? 'Statement' : `Invoice ${invoice.id}`}</SectionHeading></SectionHeader>
    {editing && <DenseSectionPanel title="Customize invoice fields"><form className={styles.editor} onSubmit={event => { event.preventDefault(); const message = onSaveDetails?.(fields, notes); setError(message || ''); if (!message) setEditing(false) }}>
      {fields.map((field, index) => <div key={index} className={styles.customField}><Input label={`Field ${index + 1} label`} required value={field.label} onChange={event => setFields(current => current.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} /><Input label={`Field ${index + 1} value`} required value={field.value} onChange={event => setFields(current => current.map((item, i) => i === index ? { ...item, value: event.target.value } : item))} /><Button type="button" size="sm" variant="ghost" aria-label={`Remove field ${index + 1}`} onClick={() => setFields(current => current.filter((_, i) => i !== index))}>Remove field</Button></div>)}
      <div><Button type="button" variant="secondary" onClick={() => setFields(current => [...current, { label: '', value: '' }])}>Add custom field</Button></div>
      <Textarea label="Invoice notes" hint="Optional free text shown on the invoice and PDF, such as service details or funding references." rows={3} value={notes} onChange={event => setNotes(event.target.value)} />
      {error && <p role="alert">{error}</p>}<div className={styles.actions}><Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button><Button type="submit">Save details</Button></div>
    </form></DenseSectionPanel>}
    <InvoiceDocument invoice={invoice} />
    <footer aria-label="Invoice actions" className={`${styles.actions} ${styles.actionPair}`}><Button variant="secondary" size="md" aria-label={statement ? 'Download statement' : `Download invoice ${invoice.id}`} onClick={() => downloadInvoice(invoice)}><Download size={14} aria-hidden="true" />Download PDF</Button>{onPay && !statement && invoice.status === 'Open' && <Button variant={invoiceStatus(invoice) === 'Overdue' ? 'destructive' : 'secondary'} style={invoiceStatus(invoice) === 'Overdue' ? { border: '1px solid transparent' } : undefined} className={styles.paymentButton} onClick={onPay}>{paymentEntryLabel(total)}<ArrowRight size={16} aria-hidden="true" /></Button>}{onRefund && !statement && invoice.status === 'Paid' && <Button variant="secondary" onClick={() => { setRefundReason(''); setRefundError(''); setRefunding(true) }}>Refund<ArrowRight size={16} aria-hidden="true" /></Button>}</footer>
    <Modal isOpen={refunding} onClose={() => setRefunding(false)} ariaLabel="Refund invoice"><ModalHeader title="Refund invoice" onClose={() => setRefunding(false)} /><ModalBody><p>{invoice.id} · {previewMoney(total, 'USD')}</p><p>No money moves in this preview.</p><Textarea label="Refund reason" required maxLength={1000} value={refundReason} onChange={event => setRefundReason(event.target.value)} />{refundError && <p role="alert">{refundError}</p>}</ModalBody><ModalFooter><Button variant="secondary" onClick={() => setRefunding(false)}>Cancel</Button><ConfirmActionButton variant="destructive" loadingLabel="Refunding" disabled={!refundReason.trim()} onClick={() => { const message = onRefund?.(refundReason); if (message) setRefundError(message); else setRefunding(false) }}>Refund</ConfirmActionButton></ModalFooter></Modal>
  </div>
}

/** Shared branded document for review and issued invoice detail. */
export function InvoiceDocument({ invoice }: { invoice: PreviewInvoice }) {
  const statement = invoice.id.startsWith('STATEMENT')
  const total = invoiceTotal(invoice)
  const paid = invoice.status === 'Paid' || invoice.status === 'Refunded' ? total : invoice.paidMinor || 0
  const amountDue = invoice.status === 'Replaced' ? 0 : total - paid
  return (
    <SurfacePanel appearance="flat" padding={spacing['2xl']}>
      <article aria-label={statement ? 'Itemized statement' : 'Itemized invoice'} className={styles.document}>
        <div className={styles.documentHeader}><div>{/* Uploaded company logo already used by the prototype brand surfaces. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- Existing uploaded company asset. */}
          <img src="https://res.cloudinary.com/diy08lj9x/image/upload/v1780713493/Asset_1_2x_a5hm0v.png" alt="Headliner Music Academy" className={styles.logo} />
          <p style={{ ...typography.bodySmall, color: colors.textSecondary }}>Headliner Music Academy</p>
        </div><div><SectionTitle as="h3" variant="card">{statement ? 'Statement' : `Invoice ${invoice.id}`}</SectionTitle>{!statement && <InvoiceState invoice={invoice} />}</div></div>
        <dl className={styles.metadata}>{invoiceRecipient(invoice) && <><dt>Billed to</dt><dd>{invoiceRecipient(invoice)}</dd></>}{invoice.billingDetails && <><dt>Billing details</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{invoice.billingDetails}</dd></>}<dt>Issued</dt><dd>{formatScheduleDate(invoice.date)}</dd>{!statement && <><dt>Due</dt><dd>{formatScheduleDate(invoice.due)}</dd></>}{invoice.customFields?.map((field, index) => <div key={index} style={{ display: 'contents' }}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
        <div className={styles.tableWrap}><table className={styles.table} aria-label={`${statement ? 'Statement' : 'Invoice'} line items`}><thead><tr><th scope="col">Description</th><th scope="col">Quantity</th><th scope="col">Unit price</th><th scope="col">Amount</th></tr></thead><tbody>{invoice.lines.map((line, index) => <tr key={index}><td><strong>{line.studentName}</strong><div>{line.program}{invoiceLineCoverage(line) && ` · ${invoiceLineCoverage(line)}`}</div>{line.sourceInvoiceId && <div>{line.sourceInvoiceId}</div>}</td><td>{line.quantity}</td><td>{previewMoney(line.unitMinor, 'USD')}</td><td>{previewMoney(line.quantity * line.unitMinor, 'USD')}</td></tr>)}</tbody></table></div>
        <div className={styles.totals}><div className={styles.totalRow}><span>Total</span><strong>{previewMoney(total, 'USD')}</strong></div>{!statement && <><div className={styles.totalRow}><span>Paid</span><span>{previewMoney(paid, 'USD')}</span></div><div className={styles.totalRow} style={{ fontSize: typography.sizeLg, fontWeight: typography.weightSemibold, color: colors.text }}><span>Amount due</span><strong>{previewMoney(amountDue, 'USD')}</strong></div>{invoice.paidByName && <div style={typography.bodySmall}>Paid by {invoice.paidByName}</div>}{invoice.paymentMethod && <div style={typography.bodySmall}>Paid with {invoice.paymentMethod}</div>}</>}</div>
        {invoice.sourceInvoiceIds && <p>Combined from: {invoice.sourceInvoiceIds.join(', ')}</p>}
        {invoice.replacedByInvoiceId && <p>Replaced by invoice {invoice.replacedByInvoiceId}. This invoice is no longer payable.</p>}
        {invoice.notes && <p className={styles.freeText}>{invoice.notes}</p>}
        {invoice.refund && <dl className={styles.metadata} aria-label="Refund details"><dt>Refunded</dt><dd>{previewMoney(invoice.refund.amountMinor, 'USD')}</dd><dt>Refund date</dt><dd>{formatScheduleDate(invoice.refund.date)}</dd><dt>Reason</dt><dd>{invoice.refund.reason}</dd></dl>}
      </article>
    </SurfacePanel>
  )
}
