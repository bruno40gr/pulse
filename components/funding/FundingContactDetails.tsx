'use client'

import { useState } from 'react'
import { Badge, Button, DenseSectionPanel, DetailField, Input, LoadingButton, Modal, ModalBody, ModalFooter, ModalHeader, Notice, Select } from '@/components/ui'
import { getActiveTenantId } from '@/lib/tenant'
import { colors, radius, shadows, spacing, typography } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'
import { INVOICE_STATUS_LABELS } from '@/lib/funding/invoice-status'
import type { FundingCase, FundingInvoice, FundingStudentField } from './types'

// Mirrors the server-side placeholder used when a funded case has nothing outstanding.
const NO_ACTION_TEXT = 'No action needed right now.'

// Connection types are what the team picks; each one maps onto the stored case-contact
// purpose so the derived checklist can clear "add family/coordinator contact".
const CONNECTION_TYPES: Array<{ value: string; purpose: FundingCase['contacts'][number]['purpose'] }> = [
  { value: 'Parent', purpose: 'family_contact' },
  { value: 'Guardian', purpose: 'family_contact' },
  { value: 'Service manager', purpose: 'coordinator_contact' },
  { value: 'Case manager', purpose: 'coordinator_contact' },
  { value: 'Social worker', purpose: 'coordinator_contact' },
  { value: 'Coordinator', purpose: 'coordinator_contact' },
  { value: 'Financial advisor', purpose: 'authorization_contact' },
  { value: 'Billing contact', purpose: 'authorization_contact' },
  { value: 'Other', purpose: 'other' },
]

interface FundingContactDetailsProps {
  fundingCase: FundingCase
  onInvoiceStatusChange?: (invoice: FundingInvoice) => void
  onFundingDetailsUpdated?: (fundingCase: FundingCase) => void
  embedded?: boolean
  showBilling?: boolean
  /** 'billing' renders only the billing and invoice sections (used by the contact Billing tab). */
  sections?: 'all' | 'billing'
}

export function FundingContactDetails({ fundingCase, onInvoiceStatusChange, onFundingDetailsUpdated, embedded = false, showBilling = true, sections = 'all' }: FundingContactDetailsProps) {
  const isMobile = useIsMobile()
  const [editingDetails, setEditingDetails] = useState(false)
  const billingOnly = sections === 'billing'
  const showsFunding = !billingOnly
  const showsBilling = billingOnly || showBilling
  const hasProgramRequirements = Boolean(fundingCase.programStudentRequirements?.length)
  const showsField = (field: FundingStudentField) => !hasProgramRequirements || fundingCase.programStudentRequirements?.some(requirement => requirement.field === field)
  // The server derives the prescriptive checklist from the student's outstanding details.
  const nextStepChecklist = fundingCase.nextStepOptions.filter(option => Boolean(option) && option !== NO_ACTION_TEXT)
  const [addingContact, setAddingContact] = useState(false)
  const [contactConnectionType, setContactConnectionType] = useState(CONNECTION_TYPES[0].value)
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [savingContact, setSavingContact] = useState(false)
  const [contactError, setContactError] = useState('')

  const addPersonOfContact = async () => {
    if (!contactName.trim()) return setContactError('Enter the person’s name.')
    setSavingContact(true)
    setContactError('')
    try {
      const tenantId = getActiveTenantId()
      const connection = CONNECTION_TYPES.find(item => item.value === contactConnectionType) || CONNECTION_TYPES[0]
      const response = await fetch(`/api/funding/account-contacts?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funding_case_id: fundingCase.id,
          name: contactName,
          relationship: connection.value,
          purpose: connection.purpose,
          email: contactEmail,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Could not add the person of contact.')
      const refreshed = await fetch(`/api/funding/cases/${fundingCase.id}?tenant=${encodeURIComponent(tenantId)}`)
      const refreshedBody = await refreshed.json()
      if (!refreshed.ok) throw new Error(refreshedBody?.error || 'Could not refresh the funding case.')
      onFundingDetailsUpdated?.(refreshedBody as FundingCase)
      setAddingContact(false)
      setContactName('')
      setContactEmail('')
      setContactConnectionType(CONNECTION_TYPES[0].value)
    } catch (caught) {
      setContactError(caught instanceof Error ? caught.message : 'Could not add the person of contact.')
    } finally {
      setSavingContact(false)
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: colors.background, padding: embedded ? (isMobile ? '16px' : '24px 28px') : 0, minWidth: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: spacing.lg, maxWidth: embedded ? '1100px' : undefined }}>
        {showsFunding && <DenseSectionPanel
          title="Funding details"
          style={{ borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` }}
          contentStyle={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: spacing.lg }}
        >
          <DetailField label="Funding organization" value={fundingCase.fundingOrganization} />
          <DetailField label="Funding program" value={fundingCase.programType} />
          {showsField('service_description') && <DetailField label="Funded service" value={fundingCase.service} />}
          {showsField('service_code') && <DetailField label="Service code" value={fundingCase.selectedServiceCodes?.join(', ') || 'Not provided'} />}
          {showsField('authorization_reference') && <DetailField label="Authorization / PO" value={fundingCase.authorization} />}
          {(showsField('authorization_start_date') || showsField('authorization_end_date')) && <DetailField label="Coverage dates" value={formatDateRange(fundingCase.authorizationStartDate, fundingCase.authorizationEndDate)} />}
          {showsField('coverage_percent') && <DetailField label="Coverage" value={fundingCase.coveragePercent === null ? 'Not provided' : `${fundingCase.coveragePercent}%`} />}
          {showsField('coverage_cap') && <DetailField label="Coverage cap" value={fundingCase.coverageCap === null ? 'Not provided' : formatCurrency(fundingCase.coverageCap)} />}
          <DetailField label="Waiting on" value={fundingCase.owner} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: spacing.md, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button size="sm" variant="secondary" onClick={() => setEditingDetails(true)}>Edit student details</Button>
          </div>
        </DenseSectionPanel>}

        {showsFunding && <DenseSectionPanel
          title="People of contact"
          actions={<Button size="sm" variant="secondary" onClick={() => { setAddingContact(true); setContactError('') }} disabled={addingContact}>Add person of contact</Button>}
          style={{ borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` }}
          contentStyle={{ display: 'grid', gap: spacing.md }}
        >
          {contactError && <Notice variant="error">{contactError}</Notice>}
          {addingContact && (
            <div style={contactFormStyle}>
              <Select label="Connection type" value={contactConnectionType} onChange={event => setContactConnectionType(event.target.value)}>
                {CONNECTION_TYPES.map(item => <option key={item.value} value={item.value}>{item.value}</option>)}
              </Select>
              <Input label="Name" value={contactName} onChange={event => setContactName(event.target.value)} required />
              <Input label="Email" type="email" value={contactEmail} onChange={event => setContactEmail(event.target.value)} />
              <div style={{ display: 'flex', gap: spacing.sm }}>
                <Button size="sm" variant="secondary" onClick={() => setAddingContact(false)} disabled={savingContact}>Cancel</Button>
                <LoadingButton size="sm" loading={savingContact} loadingLabel="Adding" onClick={() => void addPersonOfContact()}>Add person</LoadingButton>
              </div>
            </div>
          )}
          {fundingCase.contacts.length === 0 ? <div style={{ color: colors.textMuted, fontSize: typography.sizeSm }}>No person of contact yet. Add the parent, service manager, or other person your team works with.</div> : fundingCase.contacts.map(contact => (
            <div key={contact.id} style={{ paddingBottom: spacing.md, borderBottom: `1px solid ${colors.borderLight}` }}>
              <div style={{ color: colors.text, fontSize: typography.sizeSm, fontWeight: typography.weightSemibold }}>{contact.name}</div>
              <div style={{ color: colors.textSecondary, fontSize: typography.sizeXs, marginTop: spacing.xs }}>{[contact.relationship, contactPurposeLabel(contact.purpose), contact.email, contact.phone].filter(Boolean).join(' · ')}</div>
            </div>
          ))}
        </DenseSectionPanel>}

        {showsBilling && <DenseSectionPanel
          title="Billing"
          style={{ borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` }}
          contentStyle={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: spacing.lg }}
        >
          <DetailField label="Expected" value={formatCurrency(fundingCase.amountExpected)} />
          <DetailField label="Paid" value={formatCurrency(fundingCase.amountPaid)} />
          <DetailField label="Outstanding" value={formatCurrency(fundingCase.outstanding)} />
          <DetailField label="Invoice cadence" value={fundingCase.invoiceCadence} />
          <DetailField label="Submission route" value={fundingCase.submissionRoute} />
          <DetailField label="Payment method" value={fundingCase.paymentMethod} />
        </DenseSectionPanel>}

        {showsBilling && <DenseSectionPanel
          title="Invoices"
          style={{ gridColumn: isMobile ? undefined : '1 / -1', borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` }}
          contentStyle={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}
        >
          {fundingCase.invoices.length === 0 ? (
            <p style={{ margin: 0, color: colors.textMuted, fontSize: typography.sizeBase }}>No invoices have been recorded for this student.</p>
          ) : fundingCase.invoices.map(invoice => (
            <div key={invoice.id} style={{ border: `1px solid ${colors.borderLight}`, borderRadius: radius.lg, background: colors.surface, overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: spacing.md, padding: spacing.lg, background: colors.surfaceMuted }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                    <strong style={{ color: colors.text, fontSize: typography.sizeBase }}>{invoice.invoiceNumber}</strong>
                    <InvoiceStatusBadge invoice={invoice} />
                  </div>
                  <div style={{ color: colors.textSecondary, fontSize: typography.sizeSm, marginTop: spacing.xs }}>
                    {formatInvoicePeriod(invoice)} · {formatCurrency(invoice.amount)}
                    {invoice.dueOn ? ` · Due ${formatDate(invoice.dueOn)}` : ''}
                  </div>
                </div>
                {onInvoiceStatusChange && <Button size="sm" variant="secondary" onClick={() => onInvoiceStatusChange(invoice)}>Update status</Button>}
              </div>
              {invoice.rejectionEvidence && (
                <div style={{ padding: spacing.lg, borderTop: `1px solid ${colors.borderLight}`, color: colors.error, fontSize: typography.sizeSm }}>
                  <strong>Rejection evidence:</strong> {invoice.rejectionEvidence}
                </div>
              )}
              <div style={{ padding: `0 ${spacing.lg} ${spacing.sm}` }}>
                {invoice.statusEvents.map(event => (
                  <div key={event.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(150px, 0.35fr) minmax(0, 1fr)', gap: spacing.sm, padding: `${spacing.md} 0`, borderTop: `1px solid ${colors.borderLight}` }}>
                    <div style={{ color: colors.textMuted, fontSize: typography.sizeXs }}>{formatDateTime(event.changedAt)}</div>
                    <div style={{ color: colors.textSecondary, fontSize: typography.sizeSm }}>
                      <strong style={{ color: colors.text }}>{event.fromStatus ? `${INVOICE_STATUS_LABELS[event.fromStatus]} → ` : ''}{INVOICE_STATUS_LABELS[event.toStatus]}</strong>
                      {(event.note || event.evidence) && <div style={{ marginTop: spacing.xs }}>{event.note || event.evidence}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </DenseSectionPanel>}

        {showsFunding && <DenseSectionPanel
          title="Suggested next step"
          style={{ borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` }}
        >
          {nextStepChecklist.length === 0 ? (
            <div style={{ color: colors.success, fontSize: typography.sizeSm }}>Nothing is outstanding right now.</div>
          ) : (
            <ul style={nextStepListStyle}>
              {nextStepChecklist.map(step => <li key={step} style={nextStepItemStyle}>{step}</li>)}
            </ul>
          )}
          {fundingCase.dueDate && <p style={{ margin: `${spacing.md} 0 0`, color: colors.textSecondary, fontSize: typography.sizeSm }}>Due {formatDate(fundingCase.dueDate)}</p>}
        </DenseSectionPanel>}

        {showsFunding && fundingCase.instructions && <DenseSectionPanel
          title="Program instructions"
          style={{ borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` }}
        >
          <p style={{ margin: 0, color: colors.text, fontSize: typography.sizeBase, lineHeight: 1.5 }}>{fundingCase.instructions}</p>
        </DenseSectionPanel>}

        {showsFunding && <DenseSectionPanel
          title="Activity"
          style={{ gridColumn: isMobile ? undefined : '1 / -1', borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` }}
          contentStyle={{ display: 'flex', flexDirection: 'column' }}
        >
          {fundingCase.activity.length === 0 ? <div style={{ color: colors.textMuted, fontSize: typography.sizeSm }}>No activity yet.</div> : fundingCase.activity.map(item => (
            <div key={item.id} style={activityRowStyle}>
              <span style={activityMarkerStyle} aria-hidden="true" />
              <div style={{ minWidth: 0 }}>
                <div style={{ color: colors.text, fontSize: typography.sizeSm, fontWeight: typography.weightSemibold }}>{item.title}</div>
                {item.detail && <div style={{ color: colors.textSecondary, fontSize: typography.sizeSm, lineHeight: 1.5, marginTop: spacing.xs }}>{item.detail}</div>}
                <div style={{ color: colors.textMuted, fontSize: typography.sizeXs, marginTop: spacing.xs }}>{formatDateTime(item.date)}</div>
              </div>
            </div>
          ))}
        </DenseSectionPanel>}
      </div>
      <FundingDetailsModal
        fundingCase={fundingCase}
        isOpen={editingDetails}
        onClose={() => setEditingDetails(false)}
        onSaved={updated => {
          onFundingDetailsUpdated?.(updated)
          setEditingDetails(false)
        }}
      />
    </div>
  )
}

function FundingDetailsModal({ fundingCase, isOpen, onClose, onSaved }: {
  fundingCase: FundingCase
  isOpen: boolean
  onClose: () => void
  onSaved: (fundingCase: FundingCase) => void
}) {
  const [form, setForm] = useState(() => detailsForm(fundingCase))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }))
  const requirements = fundingCase.programStudentRequirements || []
  const hasProgramRequirements = requirements.length > 0
  const showsField = (field: FundingStudentField) => !hasProgramRequirements || requirements.some(requirement => requirement.field === field)
  const isRequired = (field: FundingStudentField) => requirements.some(requirement => requirement.field === field && requirement.required)

  const close = () => {
    if (saving) return
    setForm(detailsForm(fundingCase))
    setError('')
    onClose()
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const tenantId = getActiveTenantId()
      const response = await fetch(`/api/funding/cases/${fundingCase.id}?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(showsField('service_description') ? { service_description: form.service } : {}),
          ...(showsField('service_code') ? { service_codes: form.serviceCode ? [form.serviceCode] : [] } : {}),
          ...(showsField('authorization_reference') ? { authorization_reference: form.authorization } : {}),
          ...(showsField('authorization_start_date') ? { authorization_start_date: form.startDate || null } : {}),
          ...(showsField('authorization_end_date') ? { authorization_end_date: form.endDate || null } : {}),
          ...(showsField('coverage_percent') ? { coverage_percent: form.coveragePercent } : {}),
          ...(showsField('coverage_cap') ? { coverage_cap: form.coverageCap } : {}),
          note: 'Updated student-specific funding details.',
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Could not save funding details.')
      onSaved(body)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save funding details.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={close} size="lg" ariaLabel="Edit student funding details">
      <ModalHeader title="Edit student funding details" description={`Add the information ${fundingCase.programType} needs for ${fundingCase.student}.`} onClose={close} />
      <ModalBody>
        <div style={{ display: 'grid', gap: spacing.lg }}>
          {error && <Notice variant="error">{error}</Notice>}
          {showsField('service_description') && <Input label="Funded service" value={form.service} onChange={event => set('service', event.target.value)} placeholder="Individual music instruction" required={isRequired('service_description')} />}
          {showsField('service_code') && ((fundingCase.programServiceCodes?.length || 0) > 0 ? <Select label="Service code" value={form.serviceCode} onChange={event => set('serviceCode', event.target.value)} required={isRequired('service_code')}><option value="">Choose a service code</option>{fundingCase.programServiceCodes?.map(code => <option key={code} value={code}>{code}</option>)}</Select> : <Input label="Service code" value={form.serviceCode} onChange={event => set('serviceCode', event.target.value)} required={isRequired('service_code')} />)}
          {showsField('authorization_reference') && <Input label="Authorization or purchase order" value={form.authorization} onChange={event => set('authorization', event.target.value)} required={isRequired('authorization_reference')} />}
          {(showsField('authorization_start_date') || showsField('authorization_end_date')) && <div style={detailsGridStyle}>
            {showsField('authorization_start_date') && <Input label="Coverage start" type="date" value={form.startDate} onChange={event => set('startDate', event.target.value)} required={isRequired('authorization_start_date')} />}
            {showsField('authorization_end_date') && <Input label="Coverage end" type="date" value={form.endDate} onChange={event => set('endDate', event.target.value)} required={isRequired('authorization_end_date')} />}
          </div>}
          {(showsField('coverage_percent') || showsField('coverage_cap')) && <div style={detailsGridStyle}>
            {showsField('coverage_percent') && <Input label="Coverage percent" type="number" min="0" max="100" value={form.coveragePercent} onChange={event => set('coveragePercent', event.target.value)} required={isRequired('coverage_percent')} />}
            {showsField('coverage_cap') && <Input label="Coverage cap" type="number" min="0" step="0.01" value={form.coverageCap} onChange={event => set('coverageCap', event.target.value)} required={isRequired('coverage_cap')} />}
          </div>}
        </div>
      </ModalBody>
      <ModalFooter><Button variant="secondary" onClick={close} disabled={saving}>Cancel</Button><LoadingButton loading={saving} loadingLabel="Saving details" onClick={() => void save()}>Save funding details</LoadingButton></ModalFooter>
    </Modal>
  )
}

function detailsForm(fundingCase: FundingCase) {
  return {
    service: fundingCase.service === 'Not provided' ? '' : fundingCase.service,
    serviceCode: fundingCase.selectedServiceCodes?.[0] || '',
    authorization: fundingCase.authorization === 'Not provided' ? '' : fundingCase.authorization,
    startDate: fundingCase.authorizationStartDate || '',
    endDate: fundingCase.authorizationEndDate || '',
    coveragePercent: fundingCase.coveragePercent === null ? '' : String(fundingCase.coveragePercent),
    coverageCap: fundingCase.coverageCap === null ? '' : String(fundingCase.coverageCap),
  }
}

const detailsGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: spacing.md }
const contactFormStyle: React.CSSProperties = { display: 'grid', gap: spacing.md, padding: spacing.lg, border: `1px solid ${colors.border}`, borderRadius: radius.lg, background: colors.surfaceMuted }
const nextStepListStyle: React.CSSProperties = { display: 'grid', gap: spacing.sm, margin: 0, paddingLeft: spacing.xl }
const nextStepItemStyle: React.CSSProperties = { color: colors.text, fontSize: typography.sizeSm, lineHeight: 1.6 }
const activityRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '10px minmax(0, 1fr)', gap: spacing.md, padding: `${spacing.md} 0` }
const activityMarkerStyle: React.CSSProperties = { width: 8, height: 8, borderRadius: radius.full, background: colors.teal, marginTop: 5 }

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export function formatDate(value: string) {
  const date = value.includes('T') ? new Date(value) : new Date(`${value}T12:00:00`)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatDateRange(start: string | null, end: string | null) {
  if (start && end) return `${formatDate(start)}–${formatDate(end)}`
  if (start) return `Starts ${formatDate(start)}`
  if (end) return `Ends ${formatDate(end)}`
  return 'Not provided'
}

function formatInvoicePeriod(invoice: FundingInvoice) {
  if (invoice.servicePeriodStart && invoice.servicePeriodEnd) return `${formatDate(invoice.servicePeriodStart)}–${formatDate(invoice.servicePeriodEnd)}`
  if (invoice.servicePeriodStart) return `From ${formatDate(invoice.servicePeriodStart)}`
  return invoice.issuedOn ? `Issued ${formatDate(invoice.issuedOn)}` : 'Service period not recorded'
}

function contactPurposeLabel(value: FundingCase['contacts'][number]['purpose']) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase())
}

function InvoiceStatusBadge({ invoice }: { invoice: FundingInvoice }) {
  const variant = invoice.status === 'paid' ? 'success' : invoice.status === 'rejected' || invoice.status === 'overdue' ? 'risk' : invoice.status === 'pending' ? 'nudge' : 'neutral'
  return <Badge variant={variant} size="sm">{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
}