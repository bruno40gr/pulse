'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Input, LoadingButton, Modal, ModalBody, ModalFooter, ModalHeader, Notice, Select, Textarea } from '@/components/ui'
import { getActiveTenantId } from '@/lib/tenant'
import { colors, radius, spacing, typography } from '@/lib/tokens'
import type { FundingCase } from './types'

interface StudentOption { id: string; name: string; accountName: string | null; status: string | null }
interface ProfileOption {
  id: string
  version: number
  programName: string | null
  recipientRouting: string | null
  paymentTerms: Record<string, unknown>
  submissionConfig: Record<string, unknown>
}
interface OrganizationOption { id: string; name: string; organizationType: string; activeProfile: ProfileOption | null }
interface OnboardingOptions { students: StudentOption[]; organizations: OrganizationOption[] }

const emptyForm = {
  studentId: '', organizationChoice: '', organizationName: '', organizationType: 'other', programName: '',
  recipientRouting: '', invoiceCadence: '', paymentMethod: '', profileInstructions: '',
  contactName: '', contactRole: '', contactEmail: '', contactPhone: '',
  serviceDescription: '', serviceCodes: '', authorizationReference: '', authorizationStartDate: '', authorizationEndDate: '',
  authorizedAmount: '', coverageCap: '', coveragePercent: '100', lifecycleStatus: 'active', blockerType: '', waitingOn: 'Vendor',
  nextStep: '', dueDate: '', caseInstructions: '',
}

export function NewFundedCaseModal({ isOpen, onClose, onCreated }: {
  isOpen: boolean
  onClose: () => void
  onCreated: (fundingCase: FundingCase) => void
}) {
  const [options, setOptions] = useState<OnboardingOptions | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selectedOrganization = useMemo(
    () => options?.organizations.find(item => item.id === form.organizationChoice) || null,
    [form.organizationChoice, options],
  )
  const creatingOrganization = form.organizationChoice === 'new'

  useEffect(() => {
    if (!isOpen) return
    setError('')
    setLoadingOptions(true)
    const tenantId = getActiveTenantId()
    fetch(`/api/funding/onboarding-options?tenant=${encodeURIComponent(tenantId)}`)
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body?.error || 'Could not load onboarding options.')
        setOptions(body)
      })
      .catch(caught => setError(caught instanceof Error ? caught.message : 'Could not load onboarding options.'))
      .finally(() => setLoadingOptions(false))
  }, [isOpen])

  useEffect(() => {
    if (!selectedOrganization?.activeProfile) return
    const profile = selectedOrganization.activeProfile
    setForm(current => ({
      ...current,
      programName: profile.programName || '',
      recipientRouting: profile.recipientRouting || '',
      invoiceCadence: typeof profile.paymentTerms?.invoice_cadence === 'string' ? profile.paymentTerms.invoice_cadence : '',
      profileInstructions: typeof profile.submissionConfig?.instructions === 'string' ? profile.submissionConfig.instructions : '',
    }))
  }, [selectedOrganization])

  const set = (key: keyof typeof emptyForm, value: string) => setForm(current => ({ ...current, [key]: value }))

  const close = () => {
    if (saving) return
    setForm(emptyForm)
    setError('')
    onClose()
  }

  const submit = async () => {
    setError('')
    setSaving(true)
    try {
      const tenantId = getActiveTenantId()
      const response = await fetch(`/api/funding/cases?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: form.studentId,
          organization: creatingOrganization ? {
            name: form.organizationName,
            organization_type: form.organizationType,
          } : {
            id: form.organizationChoice,
            profile_version_id: selectedOrganization?.activeProfile?.id,
          },
          profile: creatingOrganization ? {
            program_name: form.programName,
            change_note: 'Initial profile created during manual case onboarding.',
            recipient_routing: form.recipientRouting,
            payment_terms: { invoice_cadence: form.invoiceCadence },
            submission_config: { instructions: form.profileInstructions },
            organization_rules: { payment_method: form.paymentMethod },
            field_metadata: {},
          } : {},
          contact: creatingOrganization && form.contactName ? {
            name: form.contactName,
            role: form.contactRole,
            email: form.contactEmail,
            phone: form.contactPhone,
            contact_type: 'organization_contact',
            purpose: 'case_onboarding',
          } : undefined,
          case: {
            service_description: form.serviceDescription,
            service_codes: form.serviceCodes.split(',').map(value => value.trim()).filter(Boolean),
            lifecycle_status: form.lifecycleStatus,
            blocker_type: form.lifecycleStatus === 'blocked' ? form.blockerType : undefined,
            waiting_on: form.waitingOn,
            next_step: form.nextStep,
            next_step_options: form.nextStep ? [form.nextStep] : [],
            due_date: form.dueDate || undefined,
            authorization_reference: form.authorizationReference,
            authorization_start_date: form.authorizationStartDate || undefined,
            authorization_end_date: form.authorizationEndDate || undefined,
            authorized_amount: form.authorizedAmount || undefined,
            coverage_cap: form.coverageCap || undefined,
            coverage_percent: form.coveragePercent || undefined,
            case_instructions: form.caseInstructions,
            profile_overrides: {},
          },
          source: { type: 'manual', metadata: { entry_point: 'funded_cases_workspace' } },
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Could not create the funded case.')
      onCreated(body)
      setForm(emptyForm)
      setError('')
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the funded case.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={close} size="wide" ariaLabel="New funded case">
      <ModalHeader title="New funded case" description="Link an existing student to a durable funding organization profile. Organization defaults remain reusable; authorization details stay on this case." onClose={close} />
      <ModalBody>
        {error && <Notice variant="error" title="Could not continue" style={{ marginBottom: spacing.lg }}>{error}</Notice>}
        {loadingOptions ? <p style={mutedStyle}>Loading students and funding organizations…</p> : (
          <div style={{ display: 'grid', gap: spacing.xl }}>
            <FormSection title="Student and funding organization" description="Students are always matched to existing Pulse records; this workflow never creates a duplicate student.">
              <FieldGrid>
                <Select label="Existing student" value={form.studentId} onChange={event => set('studentId', event.target.value)} required>
                  <option value="">Select a student</option>
                  {options?.students.map(student => <option key={student.id} value={student.id}>{student.name}{student.accountName ? ` — ${student.accountName}` : ''}</option>)}
                </Select>
                <Select label="Funding organization" value={form.organizationChoice} onChange={event => set('organizationChoice', event.target.value)} required>
                  <option value="">Select an organization</option>
                  {options?.organizations.map(organization => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                  <option value="new">Create a new organization</option>
                </Select>
              </FieldGrid>
              {selectedOrganization?.activeProfile && (
                <Notice title={`Using profile v${selectedOrganization.activeProfile.version}`}>
                  {selectedOrganization.activeProfile.programName || selectedOrganization.organizationType} · {routeLabel(selectedOrganization.activeProfile.recipientRouting)}. Profile defaults are referenced, not copied into a second settings record.
                </Notice>
              )}
            </FormSection>

            {creatingOrganization && (
              <FormSection title="Organization profile" description="These are reusable operational facts. Future edits create a new immutable profile version.">
                <FieldGrid>
                  <Input label="Organization name" value={form.organizationName} onChange={event => set('organizationName', event.target.value)} required />
                  <Select label="Organization type" value={form.organizationType} onChange={event => set('organizationType', event.target.value)}>
                    <option value="fms">FMS</option><option value="regional_center">Regional center</option><option value="charter">Charter</option><option value="other">Other</option>
                  </Select>
                  <Input label="Program or profile name" value={form.programName} onChange={event => set('programName', event.target.value)} placeholder="Optional operational label" />
                  <Select label="Recipient routing" value={form.recipientRouting} onChange={event => set('recipientRouting', event.target.value)}>
                    <option value="">Not yet confirmed</option><option value="direct_to_fms">Direct to FMS</option><option value="portal_file_upload">Portal — file upload</option><option value="portal_manual_entry">Portal — manual entry</option><option value="family_routed">Family-routed</option><option value="card_on_file_charge">Card-on-file charge</option>
                  </Select>
                  <Input label="Invoice cadence" value={form.invoiceCadence} onChange={event => set('invoiceCadence', event.target.value)} placeholder="e.g. Monthly" />
                  <Input label="Payment method" value={form.paymentMethod} onChange={event => set('paymentMethod', event.target.value)} placeholder="e.g. Direct deposit" />
                </FieldGrid>
                <Textarea label="Submission instructions" value={form.profileInstructions} onChange={event => set('profileInstructions', event.target.value)} rows={3} />
              </FormSection>
            )}

            {creatingOrganization && (
              <FormSection title="Organization contact" description="Contacts remain separate from family accounts and can be reused across cases.">
                <FieldGrid>
                  <Input label="Contact name" value={form.contactName} onChange={event => set('contactName', event.target.value)} />
                  <Input label="Role" value={form.contactRole} onChange={event => set('contactRole', event.target.value)} placeholder="Billing, coordinator, vendor support…" />
                  <Input label="Email" type="email" value={form.contactEmail} onChange={event => set('contactEmail', event.target.value)} />
                  <Input label="Phone" value={form.contactPhone} onChange={event => set('contactPhone', event.target.value)} />
                </FieldGrid>
              </FormSection>
            )}

            <FormSection title="Authorization and service" description="These facts are specific to this student’s case and do not alter the organization profile.">
              <FieldGrid>
                <Input label="Service description" value={form.serviceDescription} onChange={event => set('serviceDescription', event.target.value)} required />
                <Input label="Service codes" value={form.serviceCodes} onChange={event => set('serviceCodes', event.target.value)} hint="Comma-separated; multiple codes are supported." />
                <Input label="Authorization or PO reference" value={form.authorizationReference} onChange={event => set('authorizationReference', event.target.value)} />
                <Input label="Authorized amount" type="number" min="0" step="0.01" value={form.authorizedAmount} onChange={event => set('authorizedAmount', event.target.value)} />
                <Input label="Authorization start" type="date" value={form.authorizationStartDate} onChange={event => set('authorizationStartDate', event.target.value)} />
                <Input label="Authorization end" type="date" value={form.authorizationEndDate} onChange={event => set('authorizationEndDate', event.target.value)} />
                <Input label="Coverage cap" type="number" min="0" step="0.01" value={form.coverageCap} onChange={event => set('coverageCap', event.target.value)} />
                <Input label="Coverage percent" type="number" min="0" max="100" value={form.coveragePercent} onChange={event => set('coveragePercent', event.target.value)} />
              </FieldGrid>
              <Textarea label="Case-specific instructions or exception" value={form.caseInstructions} onChange={event => set('caseInstructions', event.target.value)} rows={3} hint="Use only for student-specific facts. Reusable rules belong on the profile." />
            </FormSection>

            <FormSection title="First workflow step" description="Set the case lifecycle separately from invoice payment status.">
              <FieldGrid>
                <Select label="Lifecycle" value={form.lifecycleStatus} onChange={event => set('lifecycleStatus', event.target.value)}>
                  <option value="discovery">Discovery</option><option value="blocked">Blocked</option><option value="active">Active</option><option value="inactive">Inactive</option>
                </Select>
                {form.lifecycleStatus === 'blocked' ? (
                  <Select label="Blocker" value={form.blockerType} onChange={event => set('blockerType', event.target.value)} required>
                    <option value="">Choose a blocker</option><option value="vendor_approval_pending">Vendor approval pending</option><option value="student_linking_pending">Student linking pending</option><option value="document_task_pending">Document task pending</option><option value="authorization_pending">Authorization pending</option><option value="other">Other</option>
                  </Select>
                ) : <div />}
                <Select label="Next action owner" value={form.waitingOn} onChange={event => set('waitingOn', event.target.value)}>
                  <option value="Vendor">Vendor</option><option value="Family">Family</option><option value="Funder">Funder</option>
                </Select>
                <Input label="Due date" type="date" value={form.dueDate} onChange={event => set('dueDate', event.target.value)} />
              </FieldGrid>
              <Input label="Next step" value={form.nextStep} onChange={event => set('nextStep', event.target.value)} placeholder="Describe the next concrete action." />
            </FormSection>
          </div>
        )}
      </ModalBody>
      <ModalFooter leading={<span style={mutedStyle}>Manual and retrospective imports use this same onboarding contract.</span>}>
        <Button type="button" variant="secondary" onClick={close} disabled={saving}>Cancel</Button>
        <LoadingButton type="button" loading={saving} loadingLabel="Creating funded case" onClick={() => void submit()} disabled={loadingOptions || !options}>Create funded case</LoadingButton>
      </ModalFooter>
    </Modal>
  )
}

function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section style={{ display: 'grid', gap: spacing.md, padding: spacing.lg, border: `1px solid ${colors.borderLight}`, borderRadius: radius.xl, background: colors.surface }}><div><h3 style={{ margin: 0, color: colors.text, fontSize: typography.sizeLg }}>{title}</h3><p style={{ ...mutedStyle, margin: `${spacing.xs} 0 0` }}>{description}</p></div>{children}</section>
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: spacing.md }}>{children}</div>
}

function routeLabel(value: string | null) {
  if (!value) return 'Routing not confirmed'
  return value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase())
}

const mutedStyle: React.CSSProperties = { color: colors.textSecondary, fontSize: typography.sizeSm, lineHeight: 1.5 }