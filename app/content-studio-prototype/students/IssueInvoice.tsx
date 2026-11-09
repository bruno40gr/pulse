'use client'

import { useState, type CSSProperties } from 'react'
import { Button, DenseSectionPanel, DetailField, FieldGrid, Input, Modal, ModalBody, ModalFooter, ModalHeader, Notice, SectionTitle, Select } from '@/components/ui'
import { accountPayers, accountStudents, invoiceOutstanding, invoiceReplacementSnapshot, invoiceTotal, quoteFlexibleInvoice, type FamilyAction, type FamilyPreviewData, type FlexibleInvoiceRequest, type PreviewAccount, type PreviewInvoice } from '@/lib/academy-family-preview'
import { addBillingDays, type BillingSchedule } from '@/lib/academy-billing'
import { previewMoney } from '@/lib/academy-student-preview'
import { colors, spacing, typography } from '@/lib/tokens'
import { ConfirmActionButton } from './ConfirmActionButton'
import { planInvoiceComposition } from '@/lib/academy-invoice-composer'
import styles from './InvoiceComposer.module.css'
import { InvoiceDocument } from './InvoicePreview'

const localToday = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` }
const stack = { display: 'grid', gap: spacing.lg } as const

export function IssueInvoice({ data, account, studentId: initialStudentId, onApply, onClose, requestKey, invoiceId }: { data: FamilyPreviewData; account: PreviewAccount; studentId?: string; onApply: (action: FamilyAction) => string | null; onClose: () => void; requestKey: string; invoiceId: string }) {
  const subscriptions = accountStudents(data, account).flatMap(student => student.enrollments.map(enrollment => ({ student, enrollment }))).sort((a, b) => Number(b.student.id === initialStudentId) - Number(a.student.id === initialStudentId))
  const payers = accountPayers(data, account)
  const recent = [...data.invoices].filter(invoice => invoice.accountId === account.id && invoice.status !== 'Replaced').sort((a, b) => b.date.localeCompare(a.date))[0]
  const [enrollmentIds, setEnrollmentIds] = useState<string[]>([])
  const [monthInput, setMonthInput] = useState('1')
  const months = monthInput.trim() ? Number(monthInput) : NaN
  const [payerId, setPayerId] = useState(payers.some(payer => payer.id === recent?.payerId) ? recent!.payerId : payers.some(payer => payer.id === account.holderId) ? account.holderId : '')
  const [billTo, setBillTo] = useState(recent?.billTo || '')
  const [billingDetails, setBillingDetails] = useState(recent?.billingDetails || '')
  const [date, setDate] = useState(localToday)
  const [terms, setTerms] = useState('0')
  const [customDue, setCustomDue] = useState(localToday)
  const proration = 'whole-month' as const
  const [repeat, setRepeat] = useState(false)
  const [review, setReview] = useState<{ request: FlexibleInvoiceRequest; invoice: PreviewInvoice } | null>(null)
  const [error, setError] = useState('')
  let quote: ReturnType<typeof quoteFlexibleInvoice> | null = null, validation = '', request: FlexibleInvoiceRequest | null = null
  const recipient = billTo.trim() || payers.find(payer => payer.id === payerId)?.name || account.name
  const today = localToday()
  const now = new Date().toISOString()
  const eligibleSubscriptions = subscriptions.filter(({ enrollment }) => enrollment.status === 'active' && !enrollment.lifecycle && enrollment.frequency === 'Weekly' && enrollment.collection.startsWith('Monthly'))
  const choices = eligibleSubscriptions.map(({ student, enrollment }) => {
    try {
      const plan = planInvoiceComposition(data, account, [enrollment.id], today, months, now, `draft-${requestKey}`)
      const result = quoteFlexibleInvoice(data, { accountId: account.id, id: `preview-${enrollment.id}`, requestKey, reservationId: `draft-${requestKey}`, payerId, date, due: terms === 'custom' ? customDue : addBillingDays(date, Number(terms)), proration, fullBillingMonths: true, ...plan })
      return { student, enrollment, selections: plan.selections, quote: { ...result, invoice: { ...result.invoice, lines: result.invoice.lines.filter(line => line.enrollmentId === enrollment.id) } }, error: '' }
    } catch (error) { return { student, enrollment, selections: [], quote: null, error: error instanceof Error ? error.message : 'Could not calculate charges.' } }
  })
  try {
    const plan = planInvoiceComposition(data, account, enrollmentIds, today, months, now, `draft-${requestKey}`)
    const { selections } = plan
    const invalid = choices.find(item => enrollmentIds.includes(item.enrollment.id) && item.error)
    if (invalid) throw new Error(invalid.error)
    request = { accountId: account.id, id: invoiceId, requestKey, reservationId: `draft-${requestKey}`, payerId, billTo, billingDetails, date, due: terms === 'custom' ? customDue : addBillingDays(date, Number(terms)), proration, fullBillingMonths: true, ...plan }
    if (repeat && selections.length) {
      const ends = selections.map(item => item.ranges[item.ranges.length - 1].end).sort()
      const start = ends[0]
      const monthOffset = (value: string) => (Number(value.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(value.slice(5, 7)) - Number(start.slice(5, 7))
      const schedule: BillingSchedule = { start, coverageMonths: months, cadenceMonths: months, advanceDays: 0, paymentDays: Number(terms === 'custom' ? Math.round((Date.parse(customDue) - Date.parse(date)) / 86400000) : terms), mode: 'automatic', custom: [], overrides: Object.fromEntries(selections.map(item => [item.subscriptionId, { offsetMonths: monthOffset(item.ranges[item.ranges.length - 1].end), coverageMonths: months }])) }
      request.arrangement = { id: `schedule-${requestKey}`, accountId: account.id, payerId, billTo, billingDetails, subscriptionIds: enrollmentIds, schedule, status: 'active', proration, fullBillingMonths: true, generatedKeys: [] }
    }
    if (plan.replacementInvoiceIds.length) request.expectedReplacement = invoiceReplacementSnapshot(data, request)
    if (enrollmentIds.length) quote = quoteFlexibleInvoice(data, request)
  } catch (error) { validation = error instanceof Error ? error.message : 'Check invoice details.' }
  const release = (reservationId: string) => onApply({ kind: 'release-billing-draft', accountId: account.id, id: reservationId })
  const back = () => { if (review) release(review.request.reservationId!); setReview(null); setError('') }
  const displayDate = (value: string) => !value ? 'Choose date' : new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  const termsLabel = terms === '0' ? 'Due upfront' : terms === 'custom' ? `Due ${customDue}` : `Net ${terms}`
  const composerStyle = { '--composer-gap': spacing.lg, '--composer-small-gap': spacing.sm, '--composer-border': colors.border, '--composer-muted': colors.textSecondary, '--composer-small': typography.sizeSm } as CSSProperties
  const summary = (invoice: PreviewInvoice) => <div className={styles.previewBody}>
    <div><strong>{recipient}</strong><div className={styles.secondary}>{account.name} · {termsLabel}</div></div>
    <div className={styles.secondary}>Issued {displayDate(invoice.date)} · Due {displayDate(invoice.due)}</div>
    <div className={styles.previewLines}>{[...new Set(invoice.lines.map(line => line.enrollmentId))].map(id => {
      const lines = invoice.lines.filter(line => line.enrollmentId === id)
      if (!lines.length) return null
      const periods = lines.map(line => ({ start: line.serviceStart!, end: line.serviceEnd! })).sort((a, b) => a.start.localeCompare(b.start)).reduce<{ start: string; end: string }[]>((ranges, range) => {
        const previous = ranges[ranges.length - 1]
        if (previous && range.start <= previous.end) previous.end = previous.end > range.end ? previous.end : range.end
        else ranges.push({ ...range })
        return ranges
      }, [])
      return <div key={id} className={styles.line}><div className={styles.row}><strong>{lines[0].studentName} · {lines[0].program}</strong><span className={styles.amount}>{previewMoney(lines.reduce((sum, line) => sum + line.quantity * line.unitMinor, 0), 'USD')}</span></div><div className={styles.secondary}>{periods.map(range => `${displayDate(range.start)} – ${displayDate(addBillingDays(range.end, -1))}`).join(', ')}</div></div>
    })}</div>
    {Boolean(invoice.paidMinor) && <DetailField label="Payment already received" value={previewMoney(invoice.paidMinor!, 'USD')} />}
    {!invoice.lines.length && <p className={styles.secondary}>No upcoming charges.</p>}
  </div>
  return <div className={styles.composer} style={composerStyle}>
    <form onSubmit={event => {
      event.preventDefault()
      if (!request || validation || !quote?.invoice.lines.length) { setError(validation || (enrollmentIds.length ? 'No upcoming charges.' : 'Choose at least one subscription.')); return }
      const reservationId = `draft-${requestKey}`
      const selections = [...new Set(quote.invoice.lines.map(line => line.enrollmentId))].map(subscriptionId => ({ subscriptionId, ranges: quote!.invoice.lines.filter(line => line.enrollmentId === subscriptionId).map(line => ({ start: line.serviceStart!, end: line.serviceEnd! })) }))
      const message = onApply({ kind: 'reserve-billing-draft', accountId: account.id, id: reservationId, selections, replacementInvoiceIds: request.replacementInvoiceIds, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() })
      if (message) { setError(message); return }
      setReview({ request: { ...request, reservationId, expectedLines: JSON.stringify(quote.invoice.lines) }, invoice: quote.invoice }); setError('')
    }}>
      <div className={styles.layout}>
        <div className={styles.configuration}>
          <section className={styles.section} aria-label="Billing period">
            <Input label="Months to bill upfront" type="number" inputMode="numeric" min={1} max={24} step={1} required value={monthInput} onChange={event => { setMonthInput(event.target.value); setError('') }} />
          </section>
          <DenseSectionPanel title="Subscriptions">
            {choices.map(({ student, enrollment, quote: itemQuote, error: itemError }) => <div key={enrollment.id} className={styles.subscription} data-subscription={enrollment.id}>
              <div className={styles.row}><label className={styles.choice}><input type="checkbox" aria-label={`${student.firstName} · ${enrollment.program}`} checked={enrollmentIds.includes(enrollment.id)} onChange={event => { setEnrollmentIds(current => event.target.checked ? [...current, enrollment.id] : current.filter(id => id !== enrollment.id)); setError('') }} /><span><strong>{student.firstName} · {enrollment.program}</strong><span className={styles.secondary} style={{ display: 'block' }}>{itemQuote?.invoice.lines.length ? `${displayDate(itemQuote.invoice.lines[0].serviceStart!)} – ${displayDate(addBillingDays(itemQuote.invoice.lines[itemQuote.invoice.lines.length - 1].serviceEnd!, -1))}` : itemError || 'No upcoming charges'}</span></span></label>{itemQuote && <span className={styles.amount} aria-label={`${student.firstName} ${enrollment.program} charge`}>{previewMoney(invoiceTotal(itemQuote.invoice), enrollment.currency)}</span>}</div>
            </div>)}
            {!choices.length && <p className={styles.secondary}>No active monthly subscriptions to invoice.</p>}
          </DenseSectionPanel>
          <section className={styles.section} aria-label="Invoicing">
            <Select label="Apply this billing period" value={repeat ? 'repeat' : 'once'} onChange={event => setRepeat(event.target.value === 'repeat')}><option value="once">This invoice only</option><option value="repeat">Use for future invoices</option></Select>
            <p className={styles.secondary}>{repeat && Number.isInteger(months) && months >= 1 && months <= 24 ? `Bill these subscriptions upfront every ${months === 1 ? 'month' : `${months} months`}.` : 'Future invoices keep their current billing frequency.'}</p>
          </section>
          <section aria-label="Billing details"><SectionTitle as="h3" variant="card">Billing details</SectionTitle><div className={styles.fields}>
            <Select label="Payer" value={payerId} onChange={event => setPayerId(event.target.value)}><option value="">Unassigned</option>{payers.map(payer => <option key={payer.id} value={payer.id}>{payer.name}</option>)}</Select>
            <FieldGrid><Input label="Issue date" type="date" value={date} onChange={event => setDate(event.target.value)} /><Select label="Payment terms" value={terms} onChange={event => setTerms(event.target.value)}><option value="0">Due upfront</option><option value="30">30 days</option><option value="45">45 days</option><option value="60">60 days</option><option value="custom">Custom date</option></Select></FieldGrid>
            {terms === 'custom' && <Input label="Due date" type="date" min={date} value={customDue} onChange={event => setCustomDue(event.target.value)} />}
            <Input label="Bill to (optional)" maxLength={200} value={billTo} onChange={event => setBillTo(event.target.value)} /><Input label="Billing reference (optional)" maxLength={2000} value={billingDetails} onChange={event => setBillingDetails(event.target.value)} />
          </div></section>
        </div>
        <aside className={styles.preview} aria-label="Live invoice preview">
          <DenseSectionPanel title="Invoice preview" actions={<span className={styles.secondary}>Local preview</span>}>
            <div className={styles.previewBody}>{quote ? summary(quote.invoice) : <p className={styles.secondary}>{validation || 'Select subscriptions to preview charges.'}</p>}
              <div className={styles.total} aria-live="polite"><strong>Amount due</strong><strong style={typography.h2}>{previewMoney(quote ? invoiceOutstanding(quote.invoice) : 0, 'USD')}</strong></div>
            </div>
          </DenseSectionPanel>
          {error && <Notice variant="error">{error}</Notice>}
          <div className={styles.actions}><Button variant="secondary" type="button" onClick={onClose}>Cancel</Button><Button type="submit">Review invoice</Button></div>
        </aside>
      </div>
    </form>
    <Modal isOpen={Boolean(review)} onClose={back} ariaLabel="Review invoice" size="lg"><ModalHeader title="Review invoice" onClose={back} /><ModalBody>{review && <div style={stack}><InvoiceDocument invoice={review.invoice} />{review.request.arrangement && <DetailField label="Future invoices" value={`Upfront every ${months === 1 ? 'month' : `${months} months`}`} />}{error && <Notice variant="error">{error}</Notice>}</div>}</ModalBody><ModalFooter leading={review && <DetailField label="Total due" value={previewMoney(invoiceOutstanding(review.invoice), 'USD')} />}><Button variant="secondary" onClick={back}>Back</Button><ConfirmActionButton onClick={() => { if (!review) return; const message = onApply({ ...review.request, kind: 'flexible-invoice' }); if (message) setError(message); else onClose() }}>Create invoice</ConfirmActionButton></ModalFooter></Modal>

  </div>
}
