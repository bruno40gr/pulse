import { invoiceRecipient, invoiceTotal, type PreviewInvoice } from './academy-family-preview'
import { previewMoney } from './academy-student-preview'
import { addBillingDays } from './academy-billing'

export function invoiceLineCoverage(line: PreviewInvoice['lines'][number]) {
  return line.serviceStart && line.serviceEnd ? `${line.serviceStart} – ${addBillingDays(line.serviceEnd, -1)}` : line.period || ''
}

export function invoiceStatus(invoice: PreviewInvoice, today = '2026-11-03') {
  return invoice.voided ? 'Voided' : invoice.status === 'Open' && invoice.paidMinor ? 'Partially paid' : invoice.status === 'Open' && invoice.due < today ? 'Overdue' : invoice.status
}

const docTitle = (invoice: PreviewInvoice) => invoice.id.startsWith('STATEMENT') ? 'Statement' : 'Invoice'

/** Derived combined document for reporting / funding requests; never a stored invoice. */
export function statementInvoice(invoices: PreviewInvoice[]): PreviewInvoice {
  const payers = [...new Set(invoices.map(invoice => invoice.payerName))]
  return {
    id: 'STATEMENT',
    accountId: invoices[0]?.accountId || '',
    payerId: 'combined',
    payerName: payers.length === 1 ? payers[0] : 'Combined statement',
    date: invoices[0]?.date || '',
    due: invoices[0]?.due || '',
    status: 'Open',
    lines: invoices.flatMap(invoice => invoice.lines),
  }
}

/** Dependency-free PDF for the fictional Latin-script preview invoices. */
export function invoicePdf(invoice: PreviewInvoice): string {
  const literal = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, character => `\\${character}`)
  const lines = [
    `${docTitle(invoice)} ${invoice.id}`,
    ...(invoiceRecipient(invoice) ? [`Billed to: ${invoiceRecipient(invoice)}`] : []),
    ...(invoice.billingDetails ? invoice.billingDetails.split(/\r?\n/) : []),
    ...(invoice.paidByName ? [`Paid by: ${invoice.paidByName}`] : []),
    ...(invoice.sourceInvoiceIds ? [`Combined from: ${invoice.sourceInvoiceIds.join(', ')}`] : []),
    ...(invoice.replacedByInvoiceId ? [`Replaced by: ${invoice.replacedByInvoiceId} (not payable)`] : []),
    ...(invoice.paymentMethod ? [`Payment method: ${invoice.paymentMethod}`] : []),
    ...(invoice.refund ? [`Refunded: ${previewMoney(invoice.refund.amountMinor, 'USD')}`, `Refund date: ${invoice.refund.date}`, `Refund reason: ${invoice.refund.reason}`] : []),
    `Issued: ${invoice.date}   Due: ${invoice.due}   Status: ${invoiceStatus(invoice)}`,
    ...(invoice.customFields || []).map(field => `${field.label}: ${field.value}`),
    '', 'Student / program - Quantity x unit price - Amount',
    ...invoice.lines.flatMap(line => [line.studentName, `${line.program}${invoiceLineCoverage(line) ? ` - ${invoiceLineCoverage(line)}` : ''}${line.sourceInvoiceId ? ` - ${line.sourceInvoiceId}` : ''} - ${line.quantity} x ${previewMoney(line.unitMinor, 'USD')} - ${previewMoney(line.quantity * line.unitMinor, 'USD')}`]),
    ...(invoice.notes ? ['', ...invoice.notes.split(/\r?\n/)] : []),
    '', `Total: ${previewMoney(invoiceTotal(invoice), 'USD')}`,
  ].flatMap(line => line.match(/.{1,85}/g) || [''])
  const pages: string[][] = []
  for (let index = 0; index < lines.length; index += 42) pages.push(lines.slice(index, index + 42))
  const objects = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  const kids: number[] = []
  pages.forEach(page => {
    const pageId = objects.length + 1, streamId = pageId + 1
    kids.push(pageId)
    const stream = `BT /F1 12 Tf 48 790 Td 17 TL\n${page.map(line => `(${literal(line)}) Tj T*`).join('\n')}\nET`
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`)
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  })
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[1] = `<< /Type /Pages /Kids [${kids.map(id => `${id} 0 R`).join(' ')}] /Count ${kids.length} >>`
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return pdf
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

/** A self-contained, printable local invoice document; never fetches a live invoice. */
export function invoiceDocument(invoice: PreviewInvoice) {
  const text = escapeHtml
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Invoice ${text(invoice.id)}</title><style>body{font:16px system-ui;max-width:800px;margin:48px auto;padding:24px;color:#222}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px 0;border-bottom:1px solid #ddd}th:last-child,td:last-child{text-align:right}</style></head><body><h1>${docTitle(invoice)} ${text(invoice.id)}</h1>${invoiceRecipient(invoice) ? `<p>Billed to: ${text(invoiceRecipient(invoice))}</p>` : ''}${invoice.billingDetails ? `<p style="white-space:pre-wrap">${text(invoice.billingDetails)}</p>` : ''}${invoice.paidByName ? `<p>Paid by: ${text(invoice.paidByName)}</p>` : ''}${invoice.paymentMethod ? `<p>Payment method: ${text(invoice.paymentMethod)}</p>` : ''}<p>Issued: ${text(invoice.date)} · Due: ${text(invoice.due)} · Status: ${text(invoice.status)}</p>${invoice.customFields?.length ? `<dl>${invoice.customFields.map(field => `<dt>${text(field.label)}</dt><dd>${text(field.value)}</dd>`).join('')}</dl>` : ''}<table><thead><tr><th>Student / program</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${invoice.lines.map(line => `<tr><td>${text(line.studentName)} · ${text(line.program)}${invoiceLineCoverage(line) ? ` · ${text(invoiceLineCoverage(line))}` : ''}${line.sourceInvoiceId ? ` · ${text(line.sourceInvoiceId)}` : ''}</td><td>${line.quantity}</td><td>${text(previewMoney(line.unitMinor, 'USD'))}</td><td>${text(previewMoney(line.quantity * line.unitMinor, 'USD'))}</td></tr>`).join('')}</tbody></table><h2>Total: ${text(previewMoney(invoiceTotal(invoice), 'USD'))}</h2>${invoice.sourceInvoiceIds ? `<p>Combined from: ${text(invoice.sourceInvoiceIds.join(', '))}</p>` : ''}${invoice.replacedByInvoiceId ? `<p>Replaced by: ${text(invoice.replacedByInvoiceId)} (not payable)</p>` : ''}${invoice.refund ? `<p>Refunded: ${text(previewMoney(invoice.refund.amountMinor, 'USD'))} · ${text(invoice.refund.date)}</p><p>Refund reason: ${text(invoice.refund.reason)}</p>` : ''}${invoice.notes ? `<p style="white-space:pre-wrap">${text(invoice.notes)}</p>` : ''}</body></html>`
}
/** Visible invoice history: superseded sources remain in the ledger, not lists. */
export function visibleInvoiceHistory(invoices: PreviewInvoice[], view: 'all' | 'unpaid' | 'past') {
  return invoices.map((invoice, index) => ({ invoice, index })).filter(({ invoice }) => invoice.status !== 'Replaced' && (view === 'all' || (view === 'unpaid' ? invoice.status === 'Open' : invoice.status === 'Paid' || invoice.status === 'Refunded'))).sort((a, b) => b.invoice.date.localeCompare(a.invoice.date) || b.index - a.index).map(({ invoice }) => invoice)
}
