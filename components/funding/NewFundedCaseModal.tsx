'use client'


import { useEffect, useMemo, useState } from 'react'
import { Button, Input, LoadingButton, Modal, ModalBody, ModalFooter, ModalHeader, Notice, Select } from '@/components/ui'
import { getActiveTenantId } from '@/lib/tenant'
import { colors, spacing, typography } from '@/lib/tokens'
import type { FundingCase, FundingStudentRequirement } from './types'

interface StudentOption { id: string; accountId: string | null; name: string; accountName: string | null; status: string | null }
interface AccountContactOption { id: string; name: string; relationship: string | null; email: string | null; phone: string | null }
interface ProgramOption {
  id: string; organizationId: string; organizationName: string; organizationType: string; name: string; version: number
  affiliationStatus: 'established'; studentRequirements: FundingStudentRequirement[]; requiredDocuments: string[]; serviceCodes: string[]
}
interface OnboardingOptions { students: StudentOption[]; programs: ProgramOption[] }

export function NewFundedCaseModal({ isOpen, preferredProgramId, onClose, onCreated, onManagePrograms }: {
  isOpen: boolean; preferredProgramId: string | null; onClose: () => void
  onCreated: (fundingCase: FundingCase) => void; onManagePrograms: () => void
}) {
  const [options, setOptions] = useState<OnboardingOptions | null>(null)
  const [studentId, setStudentId] = useState(''); const [programId, setProgramId] = useState('')
  const [serviceDescription, setServiceDescription] = useState(''); const [serviceCode, setServiceCode] = useState('')
  const [authorizationReference, setAuthorizationReference] = useState(''); const [authorizationStartDate, setAuthorizationStartDate] = useState(''); const [authorizationEndDate, setAuthorizationEndDate] = useState('')
  const [coveragePercent, setCoveragePercent] = useState(''); const [coverageCap, setCoverageCap] = useState('')
  const [contacts, setContacts] = useState<AccountContactOption[]>([]); const [contactId, setContactId] = useState(''); const [contactPurpose, setContactPurpose] = useState<'family_contact' | 'coordinator_contact'>('family_contact')
  const [addingContact, setAddingContact] = useState(false); const [newContactName, setNewContactName] = useState(''); const [newContactRelationship, setNewContactRelationship] = useState(''); const [newContactEmail, setNewContactEmail] = useState(''); const [newContactPhone, setNewContactPhone] = useState('')
  const [documentsAcknowledged, setDocumentsAcknowledged] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setError(''); setLoadingOptions(true)
    const tenantId = getActiveTenantId()
    fetch(`/api/funding/onboarding-options?tenant=${encodeURIComponent(tenantId)}`)
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body?.error || 'Could not load students and funding programs.')
        setOptions(body)
        setProgramId(body.programs?.some((program: ProgramOption) => program.id === preferredProgramId) && preferredProgramId ? preferredProgramId : '')
      })
      .catch(caught => setError(caught instanceof Error ? caught.message : 'Could not load students and funding programs.'))
      .finally(() => setLoadingOptions(false))
  }, [isOpen, preferredProgramId])

  const program = options?.programs.find(item => item.id === programId) || null
  const student = options?.students.find(item => item.id === studentId) || null
  const requiredFields = useMemo(() => new Set((program?.studentRequirements || []).filter(item => item.required).map(item => item.field)), [program])
  const needsAuthorizationDates = requiredFields.has('authorization_start_date') || requiredFields.has('authorization_end_date')
  const needsCaseContact = requiredFields.has('coordinator_contact') || requiredFields.has('family_contact')
  const needsDocuments = requiredFields.has('required_documents') || Boolean(program?.requiredDocuments.length)

  useEffect(() => {
    setContacts([]); setContactId(''); setAddingContact(false)
    if (!student?.accountId) return
    const tenantId = getActiveTenantId()
    fetch(`/api/funding/account-contacts?tenant=${encodeURIComponent(tenantId)}&account_id=${encodeURIComponent(student.accountId)}`)
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body?.error || 'Could not load people of contact.'); setContacts(Array.isArray(body) ? body : []) })
      .catch(caught => setError(caught instanceof Error ? caught.message : 'Could not load people of contact.'))
  }, [student?.accountId])

  const reset = () => {
    setStudentId(''); setProgramId(''); setServiceDescription(''); setServiceCode(''); setAuthorizationReference('')
    setAuthorizationStartDate(''); setAuthorizationEndDate(''); setCoveragePercent(''); setCoverageCap(''); setContacts([]); setContactId(''); setContactPurpose('family_contact')
    setAddingContact(false); setNewContactName(''); setNewContactRelationship(''); setNewContactEmail(''); setNewContactPhone('')
    setDocumentsAcknowledged(false); setError('')
  }
  const close = () => { if (!saving) { reset(); onClose() } }

  const submit = async () => {
    if (!studentId || !program) return setError('Choose a student and ready-to-use funding program.')
    setError(''); setSaving(true)
    try {
      const tenantId = getActiveTenantId()
      const response = await fetch(`/api/funding/cases?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId, organization: { id: program.organizationId, profile_version_id: program.id }, profile: {},
          case: {
            service_description: serviceDescription, service_codes: serviceCode ? [serviceCode] : [], authorization_reference: authorizationReference,
            authorization_start_date: authorizationStartDate, authorization_end_date: authorizationEndDate,
            coverage_percent: coveragePercent === '' ? undefined : Number(coveragePercent), coverage_cap: coverageCap === '' ? undefined : Number(coverageCap),
            contact_assignments: contactId ? [{ account_contact_id: contactId, purpose: contactPurpose }] : [], lifecycle_status: 'active', waiting_on: 'Vendor',
          },
          source: { type: 'manual', metadata: { entry_point: 'funding_workspace', documents_acknowledged: documentsAcknowledged } },
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Could not add the funded student.')
      onCreated(body); reset(); onClose()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not add the funded student.') } finally { setSaving(false) }
  }

  const createContact = async () => {
    if (!student?.accountId) return setError('Choose a student with a customer account before adding a person of contact.')
    if (!newContactName.trim()) return setError('Contact name is required.')
    setSaving(true); setError('')
    try {
      const tenantId = getActiveTenantId()
      const response = await fetch(`/api/funding/account-contacts?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: student.accountId, name: newContactName, relationship: newContactRelationship, email: newContactEmail, phone: newContactPhone }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Could not add the person of contact.')
      setContacts(current => [...current, body].sort((a, b) => a.name.localeCompare(b.name)))
      setContactId(body.id); setAddingContact(false); setNewContactName(''); setNewContactRelationship(''); setNewContactEmail(''); setNewContactPhone('')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not add the person of contact.') } finally { setSaving(false) }
  }

  return <Modal isOpen={isOpen} onClose={close} size="lg" ariaLabel="Add student">
    <ModalHeader title="Add student" description="Choose a student and a ready-to-use funding program. Everything else is optional and can be recorded later." onClose={close} />
    <ModalBody><div style={{ display: 'grid', gap: spacing.xl }}>
      {error && <Notice variant="error">{error}</Notice>}
      <Select label="Student or family" value={studentId} onChange={event => setStudentId(event.target.value)} disabled={loadingOptions} required><option value="">Choose a student</option>{(options?.students || []).map(student => <option key={student.id} value={student.id}>{student.name}{student.accountName ? ` — ${student.accountName}` : ''}</option>)}</Select>
      <div style={{ display: 'grid', gap: spacing.sm }}><Select label="Funding program" value={programId} onChange={event => { setProgramId(event.target.value); setDocumentsAcknowledged(false) }} disabled={loadingOptions} required><option value="">Choose a ready-to-use funding program</option>{(options?.programs || []).map(item => <option key={item.id} value={item.id}>{item.name} — {item.organizationName}</option>)}</Select>{!loadingOptions && options?.programs.length === 0 && <Notice variant="warning" title="No programs are ready to use">Complete vendor setup in Funding programs before assigning a student.</Notice>}<Button variant="secondary" size="sm" type="button" onClick={() => { close(); onManagePrograms() }} style={{ justifySelf: 'start' }}>Manage funding programs</Button></div>
      {program && <>
        <div><div style={sectionTitleStyle}>Optional funding details</div><div style={requirementDescriptionStyle}>Only the student and funding program are required. Add these now if you know them, or fill them in later from the student’s Funding tab.</div></div>
        <Input label="Service description" value={serviceDescription} onChange={event => setServiceDescription(event.target.value)} />
        {(requiredFields.has('service_code') || program.serviceCodes.length > 0) && (program.serviceCodes.length > 0 ? <Select label="Service code" value={serviceCode} onChange={event => setServiceCode(event.target.value)}><option value="">Choose a service code</option>{program.serviceCodes.map(code => <option key={code} value={code}>{code}</option>)}</Select> : <Input label="Service code" value={serviceCode} onChange={event => setServiceCode(event.target.value)} />)}
        <Input label="Authorization or purchase-order reference" value={authorizationReference} onChange={event => setAuthorizationReference(event.target.value)} />
        {needsAuthorizationDates && <div style={twoColumnStyle}><Input label="Coverage start" type="date" value={authorizationStartDate} onChange={event => setAuthorizationStartDate(event.target.value)} /><Input label="Coverage end" type="date" value={authorizationEndDate} onChange={event => setAuthorizationEndDate(event.target.value)} /></div>}
        {(requiredFields.has('coverage_percent') || requiredFields.has('coverage_cap')) && <div style={twoColumnStyle}><Input label="Coverage percent" type="number" min="0" max="100" value={coveragePercent} onChange={event => setCoveragePercent(event.target.value)} /><Input label="Coverage cap" type="number" min="0" step="0.01" value={coverageCap} onChange={event => setCoverageCap(event.target.value)} /></div>}
        {(needsCaseContact || program.studentRequirements.some(item => item.field === 'coordinator_contact' || item.field === 'family_contact')) && <div style={{ display: 'grid', gap: spacing.md }}>
          <div style={twoColumnStyle}>
            <Select label="Person of contact" value={contactId} onChange={event => setContactId(event.target.value)} required={needsCaseContact} disabled={!student?.accountId}><option value="">Choose a person</option>{contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name}{contact.relationship ? ` — ${contact.relationship}` : ''}</option>)}</Select>
            <Select label="Contact purpose" value={contactPurpose} onChange={event => setContactPurpose(event.target.value as 'family_contact' | 'coordinator_contact')}><option value="family_contact">Family contact</option><option value="coordinator_contact">Coordinator contact</option></Select>
          </div>
          {!student?.accountId ? <Notice variant="warning">This student does not have a customer account to attach people of contact to.</Notice> : !addingContact ? <Button variant="secondary" size="sm" type="button" onClick={() => setAddingContact(true)} style={{ justifySelf: 'start' }}>Add a new person of contact</Button> : <div style={{ display: 'grid', gap: spacing.md, padding: spacing.lg, border: `1px solid ${colors.border}`, borderRadius: 8 }}><div style={sectionTitleStyle}>New person of contact</div><div style={twoColumnStyle}><Input label="Name" value={newContactName} onChange={event => setNewContactName(event.target.value)} required /><Input label="Relationship" value={newContactRelationship} onChange={event => setNewContactRelationship(event.target.value)} /></div><div style={twoColumnStyle}><Input label="Email" type="email" value={newContactEmail} onChange={event => setNewContactEmail(event.target.value)} /><Input label="Phone" value={newContactPhone} onChange={event => setNewContactPhone(event.target.value)} /></div><div style={{ display: 'flex', gap: spacing.sm }}><Button type="button" size="sm" variant="secondary" onClick={() => setAddingContact(false)} disabled={saving}>Cancel</Button><LoadingButton type="button" size="sm" loading={saving} loadingLabel="Adding contact" onClick={() => void createContact()}>Add person</LoadingButton></div></div>}
        </div>}
        {needsDocuments && <label style={checkboxStyle}><input type="checkbox" checked={documentsAcknowledged} onChange={event => setDocumentsAcknowledged(event.target.checked)} /><span>I confirmed the applicable student documents{program.requiredDocuments.length ? `: ${program.requiredDocuments.join(', ')}` : ''}.</span></label>}
      </>}
    </div></ModalBody>
    <ModalFooter><Button type="button" variant="secondary" onClick={close} disabled={saving}>Cancel</Button><LoadingButton type="button" loading={saving} loadingLabel="Adding student" onClick={() => void submit()} disabled={loadingOptions || !studentId || !programId}>Add student</LoadingButton></ModalFooter>
  </Modal>
}

const linkStyle: React.CSSProperties = { justifySelf: 'start', border: 'none', background: 'transparent', color: colors.tealDark, padding: 0, fontFamily: typography.fontSans, fontSize: typography.sizeSm, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }
const sectionTitleStyle: React.CSSProperties = { color: colors.text, fontSize: typography.sizeBase, fontWeight: typography.weightSemibold }
const requirementDescriptionStyle: React.CSSProperties = { color: colors.textSecondary, marginTop: 2 }
const checkboxStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: spacing.sm, color: colors.text, fontSize: typography.sizeSm, lineHeight: 1.5, cursor: 'pointer' }
const twoColumnStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.md }