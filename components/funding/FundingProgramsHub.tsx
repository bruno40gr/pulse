'use client'


import { ControlButton } from '@/components/ui/ControlButton'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ExternalLink, Plus, Search } from 'lucide-react'
import { Badge, Button, EmptyState, Input, LoadingButton, Modal, ModalBody, ModalFooter, ModalHeader, Notice, ResponsiveDataTable, SlidePanel, SlidePanelHeader, SurfacePanel, Textarea, type DataTableColumn } from '@/components/ui'
import { getActiveTenantId } from '@/lib/tenant'
import { isFundingDemoTenant, recalculateDemoFundingCase, saveDemoFundingCase } from '@/lib/funding/demo'
import { InvoiceStatusModal } from './InvoiceStatusModal'
import { colors, radius, spacing, typography } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'
import { formatCurrency, formatDate, FundingContactDetails } from './FundingContactDetails'
import type { FundingCase, FundingInvoice, FundingInvoiceStatus, FundingProgram, FundingStudentField } from './types'

interface CatalogOrganization {
  id: string
  name: string
  aliases: string[]
  roles: string[]
  provenance: { sourceLabel: string }
}

export function FundingProgramsHub({ programs, cases, persisted, catalogOpen, onCatalogOpenChange, onRefresh, onCaseUpdated }: {
  programs: FundingProgram[]
  cases: FundingCase[]
  persisted: boolean
  catalogOpen: boolean
  onCatalogOpenChange: (isOpen: boolean) => void
  onRefresh: () => Promise<void>
  onCaseUpdated: (fundingCase: FundingCase) => void
}) {
  const isMobile = useIsMobile()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [addingContact, setAddingContact] = useState<FundingProgram | null>(null)
  const [invoiceEdit, setInvoiceEdit] = useState<FundingInvoice | null>(null)
  const selected = programs.find(program => program.organizationId === selectedId) || null
  const selectedCase = cases.find(fundingCase => fundingCase.id === selectedCaseId) || null
  const demoCase = Boolean(selectedCase && isFundingDemoTenant(getActiveTenantId()) && selectedCase.id.startsWith(`mock-funding-${getActiveTenantId()}-`))
  const updateDemoInvoice = async (input: { status: FundingInvoiceStatus; evidence: string; note: string; paidOn: string | null }) => {
    if (!selectedCase || !invoiceEdit || !demoCase) return
    const changedAt = new Date().toISOString()
    const updated = recalculateDemoFundingCase({ ...selectedCase, updatedAt: changedAt, invoices: selectedCase.invoices.map(invoice => invoice.id !== invoiceEdit.id ? invoice : {
      ...invoice, status: input.status, paidOn: input.status === 'paid' ? input.paidOn : null,
      rejectionEvidence: input.status === 'rejected' ? input.evidence : null, updatedAt: changedAt,
      statusEvents: [{ id: `mock-event-${Date.now()}`, fromStatus: invoice.status, toStatus: input.status, evidence: input.evidence || null, note: input.note || null, changedAt }, ...invoice.statusEvents],
    }) })
    saveDemoFundingCase(getActiveTenantId(), updated)
    onCaseUpdated(updated)
  }
  const programColumns: DataTableColumn<FundingProgram, string>[] = [
    { id: 'program', header: 'Funding program', width: 'minmax(220px, 1.4fr)', render: program => <div><div style={{ color: colors.text, fontWeight: typography.weightSemibold }}>{program.name}</div><div style={secondaryTextStyle}>{program.organizationName}</div></div> },
    { id: 'roles', header: 'Role', width: 'minmax(150px, 1fr)', render: program => program.roles.length ? program.roles.map(typeLabel).join(', ') : typeLabel(program.type) },
    { id: 'status', header: 'Setup', width: '135px', render: program => <Badge variant={program.affiliationStatus === 'established' ? 'success' : 'nudge'} size="sm">{program.affiliationStatus === 'established' ? 'Ready to use' : 'Setup required'}</Badge> },
    { id: 'students', header: 'Funded students', width: '125px', align: 'right', render: program => String(program.activeCases) },
    { id: 'outstanding', header: 'Outstanding', width: '135px', align: 'right', render: program => formatCurrency(program.outstanding) },
  ]

  if (!selected) {
    return (
      <div style={{ display: 'grid', gap: spacing.lg }}>
        {programs.length === 0 ? (
          <SurfacePanel><EmptyState title="No funding programs yet" description="Add the funding organization you work with before assigning funded students." action={<Button onClick={() => onCatalogOpenChange(true)} disabled={!persisted}>Add funding program</Button>} /></SurfacePanel>
        ) : (
          <ResponsiveDataTable
            rows={programs}
            columns={programColumns}
            getRowKey={program => program.id}
            emptyContent="No funding programs yet."
            minDesktopWidth={840}
            onRowClick={program => setSelectedId(program.organizationId)}
            ariaLabel="Funding Programs"
          />
        )}
        <CatalogProgramModal isOpen={catalogOpen} existingCatalogKeys={programs.map(program => program.catalogKey).filter((value): value is string => Boolean(value))} onClose={() => onCatalogOpenChange(false)} onSaved={async organizationId => {
          await onRefresh(); onCatalogOpenChange(false); setSelectedId(organizationId)
        }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: spacing.lg }}>
      <Button variant="secondary" size="sm" type="button" onClick={() => { setSelectedId(null); setSelectedCaseId(null) }} ><ArrowLeft size={16} /> All funding programs</Button>
      <ProgramGuide
        program={selected}
        cases={casesForProgram(selected, cases)}
        persisted={persisted}
        onAddContact={() => setAddingContact(selected)}
        onSelectCase={fundingCase => setSelectedCaseId(fundingCase.id)}
      />
      <ContactModal program={addingContact} onClose={() => setAddingContact(null)} onSaved={async () => { await onRefresh(); setAddingContact(null) }} />
      {selectedCase && (
        <SlidePanel isOpen onClose={() => setSelectedCaseId(null)} fullScreen={isMobile} width="min(75vw, 960px)">
          <SlidePanelHeader
            title={selectedCase.student}
            subtitle={`${selectedCase.programType} · ${selectedCase.fundingOrganization}`}
            badge={<FundingStatusBadge item={selectedCase} />}
            onClose={() => setSelectedCaseId(null)}
            compact={isMobile}
          />
          <FundingContactDetails fundingCase={selectedCase} embedded onFundingDetailsUpdated={onCaseUpdated} onInvoiceStatusChange={demoCase ? setInvoiceEdit : undefined} />
        </SlidePanel>
      )}
      <InvoiceStatusModal invoice={invoiceEdit} onClose={() => setInvoiceEdit(null)} onSave={updateDemoInvoice} />
    </div>
  )
}

function ProgramGuide({ program, cases, persisted, onAddContact, onSelectCase }: {
  program: FundingProgram
  cases: FundingCase[]
  persisted: boolean
  onAddContact: () => void
  onSelectCase: (fundingCase: FundingCase) => void
}) {
  const established = program.affiliationStatus === 'established'
  if (!established) {
    const steps = [...program.affiliationSteps, ...program.billingGuidance]
    return <SurfacePanel padding={spacing.xl}><div style={{ display: 'grid', gap: spacing.xl, maxWidth: 820 }}>
      <div><Badge variant="nudge" size="sm">Setup required</Badge><h2 style={{ ...typography.sectionTitle, margin: `${spacing.sm} 0 0`, color: colors.text }}>{program.name} application process</h2>{program.instructions && <p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: `${spacing.sm} 0 0` }}>{program.instructions}</p>}</div>
      <div><SectionHeading>New vendor requirements</SectionHeading><Checklist steps={steps} empty="Setup instructions are not available yet. Record the requirements provided by the funding organization before assigning students." /></div>
      {(program.requiredDocuments.length > 0 || program.serviceCodes.length > 0) && <div style={knownValuesStyle}><SectionHeading>Information already available</SectionHeading><div style={{ display: 'grid', gap: spacing.md, marginTop: spacing.md }}>{program.requiredDocuments.length > 0 && <Meta label="Documents" value={program.requiredDocuments.join(', ')} />}{program.serviceCodes.length > 0 && <Meta label="Accepted service codes" value={program.serviceCodes.join(', ')} />}</div></div>}
    </div></SurfacePanel>
  }
  const columns = programStudentColumns(program)

  return <SurfacePanel padding={spacing.xl}><div style={{ display: 'grid', gap: spacing.xl }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.lg, flexWrap: 'wrap' }}>
      <div><Badge variant="success" size="sm">Ready to use</Badge><h2 style={{ ...typography.sectionTitle, margin: `${spacing.sm} 0 0`, color: colors.text }}>{program.name}</h2><div style={{ color: colors.textSecondary, fontSize: typography.sizeSm, marginTop: spacing.xs }}>{program.organizationName} · Program setup is complete and students can be assigned.</div></div>
      {program.portalUrl && <a href={program.portalUrl} target="_blank" rel="noreferrer" style={portalButtonStyle}>Open program portal <ExternalLink size={15} /></a>}
    </div>
    <ResponsiveDataTable
      rows={cases}
      columns={columns}
      getRowKey={item => item.id}
      emptyContent={<EmptyState title="No funded students use this program yet" description="Add a student from Funded Students to start tracking their authorization, service, and payments." />}
      minDesktopWidth={1040}
      onRowClick={onSelectCase}
      ariaLabel={`Students funded through ${program.name}`}
    />
    <div><div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center', flexWrap: 'wrap' }}><SectionHeading>Program contact</SectionHeading><Button size="sm" variant="secondary" onClick={onAddContact} disabled={!persisted}><Plus size={14} /> Add program contact</Button></div>{program.contacts.length === 0 ? <div style={{ marginTop: spacing.sm }}><Muted>No program contact is recorded.</Muted></div> : program.contacts.map(contact => <div key={contact.id} style={{ marginTop: spacing.md }}><div style={{ color: colors.text, fontSize: typography.sizeSm, fontWeight: typography.weightSemibold }}>{contact.name}</div><Muted>{[contact.role, contact.email, contact.phone].filter(Boolean).join(' · ')}</Muted></div>)}</div>
  </div></SurfacePanel>
}

function Checklist({ steps, empty }: { steps: Array<{ id: string; title: string; description: string; actionLabel?: string | null; actionUrl?: string | null }>; empty: string }) {
  if (steps.length === 0) return empty ? <div style={{ marginTop: spacing.sm }}><Muted>{empty}</Muted></div> : null
  return <ol style={checklistStyle}>{steps.map((step, index) => <li key={step.id} style={checklistItemStyle}><div style={stepNumberStyle}>{index + 1}</div><div><div style={{ color: colors.text, fontWeight: typography.weightSemibold }}>{step.title}</div>{step.description && <div style={{ color: colors.textSecondary, fontSize: typography.sizeSm, lineHeight: 1.6, marginTop: spacing.xs }}>{step.description}</div>}{step.actionUrl && <a href={step.actionUrl} target="_blank" rel="noreferrer" style={{ ...linkButtonStyle, display: 'inline-flex', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm }}>{step.actionLabel || 'Open source'} <ExternalLink size={13} /></a>}</div></li>)}</ol>
}

function casesForProgram(program: FundingProgram, cases: FundingCase[]) {
  return cases.filter(item => item.profileVersionId
    ? item.profileVersionId === program.profileVersionId
    : item.fundingOrganizationId === program.organizationId)
}

function programStudentColumns(program: FundingProgram): DataTableColumn<FundingCase, string>[] {
  const configured = new Set(program.studentRequirements.map(item => item.field))
  const uses = (...fields: FundingStudentField[]) => configured.size === 0 || fields.some(field => configured.has(field))

  const columns: DataTableColumn<FundingCase, string>[] = [
    {
      id: 'student', header: 'Student', width: 'minmax(170px, 1.1fr)',
      render: item => <div style={{ color: colors.text, fontWeight: typography.weightSemibold }}>{item.student}</div>,
    },
    { id: 'status', header: 'Status', width: '145px', render: item => <FundingStatusBadge item={item} /> },
  ]

  if (uses('authorization_reference')) {
    columns.push({
      id: 'authorization', header: 'Authorization', width: 'minmax(145px, 0.9fr)',
      render: item => valueOrMissing(item.authorization, isRequired(program, 'authorization_reference')),
    })
  }

  if (uses('service_description', 'service_code')) {
    columns.push({
      id: 'service', header: 'Service', width: 'minmax(180px, 1.15fr)',
      render: item => {
        const serviceMissing = isRequired(program, 'service_description') && isEmptyValue(item.service)
        const codes = item.selectedServiceCodes?.filter(Boolean) || []
        const codeMissing = isRequired(program, 'service_code') && codes.length === 0
        if (serviceMissing || codeMissing) return <MissingBadge />
        if (isEmptyValue(item.service) && codes.length === 0) return <NeutralValue />
        return <div><div>{isEmptyValue(item.service) ? '—' : item.service}</div>{codes.length > 0 && <div style={secondaryTextStyle}>{codes.join(', ')}</div>}</div>
      },
    })
  }

  if (uses('authorization_start_date', 'authorization_end_date', 'coverage_percent', 'coverage_cap')) {
    columns.push({
      id: 'coverage', header: 'Coverage', width: 'minmax(160px, 1fr)',
      render: item => coverageValue(program, item),
    })
  }

  columns.push(
    { id: 'outstanding', header: 'Outstanding', width: '120px', align: 'right', render: item => <span style={{ fontWeight: typography.weightSemibold }}>{formatCurrency(item.outstanding)}</span> },
    { id: 'nextStep', header: 'Next action', width: 'minmax(210px, 1.35fr)', render: item => <div><div>{item.nextStep}</div><div style={secondaryTextStyle}>Waiting on {item.owner}</div></div> },
  )
  return columns
}

function coverageValue(program: FundingProgram, item: FundingCase) {
  const missingRequired = (
    (isRequired(program, 'authorization_start_date') && !item.authorizationStartDate)
    || (isRequired(program, 'authorization_end_date') && !item.authorizationEndDate)
    || (isRequired(program, 'coverage_percent') && item.coveragePercent === null)
    || (isRequired(program, 'coverage_cap') && item.coverageCap === null)
  )
  if (missingRequired) return <MissingBadge />

  const values = [
    item.authorizationStartDate || item.authorizationEndDate
      ? [item.authorizationStartDate ? formatDate(item.authorizationStartDate) : null, item.authorizationEndDate ? formatDate(item.authorizationEndDate) : null].filter(Boolean).join('–')
      : null,
    item.coveragePercent === null ? null : `${item.coveragePercent}%`,
    item.coverageCap === null ? null : `${formatCurrency(item.coverageCap)} cap`,
  ].filter((value): value is string => Boolean(value))

  return values.length > 0 ? <div>{values.map(value => <div key={value}>{value}</div>)}</div> : <NeutralValue />
}

function isRequired(program: FundingProgram, field: FundingStudentField) {
  return program.studentRequirements.some(requirement => requirement.field === field && requirement.required)
}

function isEmptyValue(value: string | null | undefined) {
  return !value || value === 'Not provided'
}

function valueOrMissing(value: string | null | undefined, required: boolean) {
  if (!isEmptyValue(value)) return value
  return required ? <MissingBadge /> : <NeutralValue />
}

function MissingBadge() {
  return <Badge variant="risk" size="sm">Missing</Badge>
}

function NeutralValue() {
  return <span style={{ color: colors.textMuted }}>—</span>
}

function FundingStatusBadge({ item }: { item: FundingCase }) {
  const variant = item.status === 'paid' ? 'success' : item.status === 'needs_review' ? 'risk' : item.status === 'waiting' ? 'nudge' : 'info'
  return <Badge variant={variant} size="sm">{item.statusLabel}</Badge>
}

function CatalogProgramModal({ isOpen, existingCatalogKeys, onClose, onSaved }: { isOpen: boolean; existingCatalogKeys: string[]; onClose: () => void; onSaved: (organizationId: string) => Promise<void> }) {
  const [catalog, setCatalog] = useState<CatalogOrganization[]>([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [requestName, setRequestName] = useState('')
  const [requestContext, setRequestContext] = useState('')
  const available = useMemo(() => catalog.filter(item => !existingCatalogKeys.includes(item.id) && `${item.name} ${item.aliases.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [catalog, existingCatalogKeys, query])

  useEffect(() => {
    if (!isOpen) return
    setLoading(true); setError(''); setSuccess('')
    const tenantId = getActiveTenantId()
    fetch(`/api/funding/catalog?tenant=${encodeURIComponent(tenantId)}`).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body?.error || 'Could not load funding organizations.'); setCatalog(body) }).catch(caught => setError(caught instanceof Error ? caught.message : 'Could not load funding organizations.')).finally(() => setLoading(false))
  }, [isOpen])

  const save = async () => {
    if (!selectedId) return setError('Choose an organization.')
    setSaving(true); setError('')
    try { const tenantId = getActiveTenantId(); const response = await fetch(`/api/funding/organizations?tenant=${encodeURIComponent(tenantId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalog_id: selectedId }) }); const body = await response.json(); if (!response.ok) throw new Error(body?.error || 'Could not add the funding program.'); await onSaved(body.organizationId) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not add the funding program.') } finally { setSaving(false) }
  }
  const submitRequest = async () => {
    if (!requestName.trim()) return setError('Enter the organization name.')
    setSaving(true); setError(''); setSuccess('')
    try { const tenantId = getActiveTenantId(); const response = await fetch(`/api/funding/organization-requests?tenant=${encodeURIComponent(tenantId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requested_name: requestName, context: requestContext }) }); const body = await response.json(); if (!response.ok) throw new Error(body?.error || 'Could not submit the organization request.'); setRequesting(false); setRequestName(''); setRequestContext(''); setSuccess('Request submitted. The organization will be reviewed before it can be selected.') } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not submit the organization request.') } finally { setSaving(false) }
  }

  return <Modal isOpen={isOpen} onClose={onClose} size="lg" ariaLabel="Add funding program"><ModalHeader title="Add funding program" description="Add a funding organization your team already works with. Agreement rules are managed for you and stay read-only." onClose={onClose} /><ModalBody><div style={{ display: 'grid', gap: spacing.lg }}>{error && <Notice variant="error">{error}</Notice>}{success && <Notice variant="success">{success}</Notice>}{!requesting ? <><Input label="Search organizations" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name or alias" /><div style={{ display: 'grid', gap: spacing.sm }}>{loading ? <Muted>Loading organizations…</Muted> : available.map(item => <ControlButton kind="row" key={item.id} type="button" onClick={() => setSelectedId(item.id)} style={{ width: '100%' }}><div><div style={{ color: colors.text, fontWeight: typography.weightSemibold }}>{item.name}</div><div style={{ color: colors.textSecondary, fontSize: typography.sizeXs, marginTop: spacing.xs }}>{item.roles.map(typeLabel).join(', ')} · {item.provenance.sourceLabel}</div></div>{selectedId === item.id && <Badge variant="success" size="sm">Selected</Badge>}</ControlButton>)}{!loading && available.length === 0 && <EmptyState icon={<Search size={28} />} title="No matching organization" description="Request a review instead of creating an unverified organization record." />}</div><Button variant="secondary" size="sm" type="button" onClick={() => { setRequesting(true); setRequestName(query) }} style={{ justifySelf: 'start' }}>Don’t see your organization? Request it</Button></> : <><Input label="Organization name" value={requestName} onChange={event => setRequestName(event.target.value)} required /><Textarea label="How do you work with this organization?" value={requestContext} onChange={event => setRequestContext(event.target.value)} rows={4} /><Button variant="secondary" size="sm" type="button" onClick={() => setRequesting(false)} style={{ justifySelf: 'start' }}>Back to search</Button></>}</div></ModalBody><ModalFooter><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><LoadingButton loading={saving} loadingLabel={requesting ? 'Submitting request' : 'Adding program'} onClick={() => void (requesting ? submitRequest() : save())}>{requesting ? 'Submit request' : 'Add funding program'}</LoadingButton></ModalFooter></Modal>
}

function ContactModal({ program, onClose, onSaved }: { program: FundingProgram | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(''); const [role, setRole] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  if (!program) return null
  const save = async () => { if (!name.trim()) return setError('Contact name is required.'); setSaving(true); setError(''); try { const tenantId = getActiveTenantId(); const response = await fetch(`/api/funding/organizations/${program.organizationId}/contacts?tenant=${encodeURIComponent(tenantId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, role, email, phone, notes }) }); const body = await response.json(); if (!response.ok) throw new Error(body?.error || 'Could not add the contact.'); await onSaved() } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not add the contact.') } finally { setSaving(false) } }
  return <Modal isOpen onClose={onClose} size="md" ariaLabel="Add program contact"><ModalHeader title="Add program contact" description={`Save a point of contact your team uses for ${program.organizationName}.`} onClose={onClose} /><ModalBody><div style={{ display: 'grid', gap: spacing.md }}>{error && <Notice variant="error">{error}</Notice>}<Input label="Name" value={name} onChange={event => setName(event.target.value)} required /><Input label="Role" value={role} onChange={event => setRole(event.target.value)} /><Input label="Email" type="email" value={email} onChange={event => setEmail(event.target.value)} /><Input label="Phone" value={phone} onChange={event => setPhone(event.target.value)} /><Textarea label="Notes or program-specific exception" value={notes} onChange={event => setNotes(event.target.value)} rows={3} /></div></ModalBody><ModalFooter><Button variant="secondary" onClick={onClose}>Cancel</Button><LoadingButton loading={saving} loadingLabel="Adding contact" onClick={() => void save()}>Add contact</LoadingButton></ModalFooter></Modal>
}

function Meta({ label, value }: { label: string; value: string }) { return <div><div style={{ color: colors.textMuted, fontSize: typography.sizeXs, fontWeight: typography.weightSemibold }}>{label}</div><div style={{ color: colors.text, fontSize: typography.sizeSm, marginTop: 2, overflowWrap: 'anywhere' }}>{value}</div></div> }
function SectionHeading({ children }: { children: React.ReactNode }) { return <div style={{ color: colors.text, fontSize: typography.sizeSm, fontWeight: typography.weightSemibold }}>{children}</div> }
function Muted({ children }: { children: React.ReactNode }) { return <div style={{ color: colors.textSecondary, fontSize: typography.sizeXs, lineHeight: 1.5 }}>{children}</div> }
function typeLabel(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase()) }
const catalogOptionStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, width: '100%', padding: spacing.lg, border: `1px solid ${colors.border}`, borderRadius: radius.lg, background: colors.surface, textAlign: 'left', cursor: 'pointer', fontFamily: typography.fontSans }
const selectedCatalogOptionStyle: React.CSSProperties = { borderColor: colors.teal, background: '#F0FBFD' }
const backButtonStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: spacing.xs, border: 'none', background: 'transparent', color: colors.tealDark, padding: 0, cursor: 'pointer', fontFamily: typography.fontSans, fontWeight: typography.weightMedium }
const linkButtonStyle: React.CSSProperties = { justifySelf: 'start', border: 'none', background: 'transparent', color: colors.tealDark, padding: 0, cursor: 'pointer', fontFamily: typography.fontSans, textDecoration: 'underline', textUnderlineOffset: 2 }
const portalButtonStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: `${spacing.sm} ${spacing.lg}`, borderRadius: radius.md, background: colors.espresso, color: colors.surface, textDecoration: 'none', fontSize: typography.sizeSm, fontWeight: typography.weightSemibold }
const knownValuesStyle: React.CSSProperties = { padding: spacing.lg, border: `1px solid ${colors.borderLight}`, borderRadius: radius.lg, background: colors.surfaceMuted }
const secondaryTextStyle: React.CSSProperties = { color: colors.textMuted, fontSize: typography.sizeXs, marginTop: spacing.xs }
const checklistStyle: React.CSSProperties = { display: 'grid', gap: 0, listStyle: 'none', padding: 0, margin: `${spacing.md} 0 0` }
const checklistItemStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '32px minmax(0, 1fr)', gap: spacing.md, padding: `${spacing.lg} 0`, borderBottom: `1px solid ${colors.borderLight}` }
const stepNumberStyle: React.CSSProperties = { width: 28, height: 28, borderRadius: radius.full, display: 'grid', placeItems: 'center', background: colors.action, color: colors.surface, fontSize: typography.sizeSm, fontWeight: typography.weightBold }