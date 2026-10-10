import { TENANT_BRAND } from '@/lib/tenant'
import type { FundingCase, FundingInvoice, FundingInvoiceStatus, FundingProgram, FundingStudentRequirement } from '@/components/funding/types'

export function isFundingDemoTenant(tenantId: string) {
  return tenantId === TENANT_BRAND.sacramentoMartialArts.id || tenantId === TENANT_BRAND.kumon.id
}

const STUDENTS = ['Avery Chen', 'Miles Rivera', 'Sofia Patel', 'Ethan Brooks', 'Luna Garcia', 'Oliver Kim', 'Amelia Davis', 'Leo Wilson', 'Isla Nguyen', 'Noah Bennett', 'Maya Thompson', 'Lucas Reed']
const STATUSES: FundingInvoiceStatus[] = ['pending', 'overdue', 'paid', 'rejected', 'draft', 'pending', 'draft', 'paid', 'pending', 'overdue', 'draft', 'paid']

function day(now: Date, offset: number) {
  const date = new Date(now)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

const requirements: FundingStudentRequirement[] = [
  ['authorization_reference', 'Authorization reference'], ['authorization_start_date', 'Coverage start date'],
  ['authorization_end_date', 'Coverage end date'], ['service_description', 'Authorized service'],
  ['service_code', 'Service code'], ['family_contact', 'Family contact'], ['coordinator_contact', 'Coordinator contact'],
].map(([field, title]) => ({ id: `demo-${field}`, field: field as FundingStudentRequirement['field'], title, description: `Record the ${title.toLowerCase()} before submitting billing. Fictional demo requirement.`, required: true, mediaUrl: null, actionLabel: null, actionUrl: null }))

export function createDemoFunding(tenantId: string, now = new Date()): { programs: FundingProgram[]; cases: FundingCase[] } {
  if (!isFundingDemoTenant(tenantId)) return { programs: [], cases: [] }
  const academy = tenantId === TENANT_BRAND.kumon.id ? 'Learning support sessions' : 'Adaptive martial arts classes'
  const programs: FundingProgram[] = [
    { key: 'alta', catalogKey: 'alta-california-regional-center', name: 'Alta California Regional Center', type: 'Regional center', routing: 'Demo coordinator email', timing: 'Demo assumption: 30 days after receipt' },
    { key: 'mainsl', catalogKey: 'mainsl', name: "Mains’l", type: 'FMS', routing: 'Demo family review → billing team', timing: 'Demo assumption: 21 days after complete submission' },
    { key: 'ace', catalogKey: 'ace-fms', name: 'ACE FMS', type: 'FMS', routing: 'Demo vendor portal', timing: 'Demo assumption: 14 days after approval' },
  ].map(item => ({
    id: `mock-${tenantId}-${item.key}-profile`, organizationId: `mock-${tenantId}-${item.key}`, profileVersionId: `mock-${tenantId}-${item.key}-profile`,
    name: item.name, organizationName: item.name, type: item.type, routing: item.routing, cadence: 'Monthly', activeCases: 0, outstanding: 0,
    observedPayment: item.timing, verification: 'Fictional demo setup', affiliationStatus: 'established', catalogKey: item.catalogKey,
    roles: [item.key === 'alta' ? 'funding_source' : 'fms'], provenanceLabel: 'Fictional demo — not payer policy', portalUrl: null,
    instructions: `Demo workflow: confirm authorization for ${academy.toLowerCase()}, collect attendance and family approval, submit a complete invoice, and reconcile payment. These are mock rules, not actual ${item.name} requirements.`,
    requiredDocuments: ['Authorization letter', 'Attendance record', 'Family approval'], serviceCodes: ['DEMO-ADAPTIVE', 'DEMO-GROUP'], paymentTiming: item.timing, lastReviewedAt: day(now, -7),
    affiliationSteps: [{ id: `${item.key}-setup`, title: 'Demo vendor setup complete', description: 'Fictional vendor approval, billing contact and payment details are recorded.', mediaUrl: null, actionLabel: null, actionUrl: null }],
    studentRequirements: requirements,
    billingGuidance: ['Confirm coverage and service code', 'Attach attendance and signed approval', 'Submit and record confirmation', 'Match payment to invoice'].map((title, index) => ({ id: `${item.key}-billing-${index}`, title, description: 'Demonstration step only. Use verified requirements for real billing.', mediaUrl: null, actionLabel: null, actionUrl: null })),
    contacts: [{ id: `${item.key}-contact`, name: item.key === 'alta' ? 'Morgan Ellis' : item.key === 'mainsl' ? 'Taylor Reed' : 'Jordan Parker', role: 'Fictional program coordinator', email: `${item.key}-demo@example.com`, phone: '202-555-0140' }],
  }))

  const cases = STUDENTS.map((student, index): FundingCase => {
    const program = programs[index % programs.length]
    const id = `mock-funding-${tenantId}-${index}`
    const status = STATUSES[index]
    const amount = 240 + (index % 5) * 60
    const incomplete = index === 4 || index === 6 || index === 10
    const parent = `${['Jamie', 'Taylor', 'Alex', 'Sam'][index % 4]} ${student.split(' ').slice(1).join(' ')}`
    const due = day(now, status === 'overdue' ? -12 : status === 'paid' ? -7 : 7 + index)
    const makeInvoice = (suffix: string, invoiceStatus: FundingInvoiceStatus, offset: number): FundingInvoice => ({
      id: `${id}-invoice-${suffix}`, invoiceNumber: `DEMO-${index + 101}-${suffix}`, servicePeriodStart: day(now, offset - 30), servicePeriodEnd: day(now, offset - 1),
      issuedOn: day(now, offset - 5), dueOn: suffix === 'current' ? due : day(now, offset + 14), amount, status: invoiceStatus,
      paidOn: invoiceStatus === 'paid' ? day(now, suffix === 'current' ? -2 : offset + 10) : null,
      rejectionEvidence: invoiceStatus === 'rejected' ? 'Fictional payer response: attendance attachment is missing. Correct and resubmit.' : null,
      createdAt: `${day(now, offset - 5)}T16:00:00.000Z`, updatedAt: `${day(now, offset)}T16:00:00.000Z`,
      statusEvents: [{ id: `${id}-${suffix}-event`, fromStatus: invoiceStatus === 'draft' ? null : 'pending', toStatus: invoiceStatus,
        evidence: invoiceStatus === 'rejected' ? 'DEMO-R02: attendance attachment missing.' : null,
        note: invoiceStatus === 'paid' ? 'Fictional deposit reconciled to invoice.' : invoiceStatus === 'pending' ? 'Complete demo invoice submitted; awaiting payer processing.' : 'Fictional workflow history.', changedAt: `${day(now, offset)}T16:00:00.000Z` }],
    })
    const contacts: FundingCase['contacts'] = [{ id: `${id}-family`, accountContactId: `${id}-family`, name: parent, relationship: 'Parent', purpose: 'family_contact', email: `family${index + 1}@example.com`, phone: `202-555-${String(110 + index).padStart(4, '0')}` }]
    if (index !== 6) contacts.push({ id: `${id}-coordinator`, accountContactId: `${id}-coordinator`, name: program.contacts[0].name, relationship: 'Coordinator', purpose: 'coordinator_contact', email: program.contacts[0].email, phone: program.contacts[0].phone })
    return recalculateDemoFundingCase({
      id, studentPersonId: `mock-student-${tenantId}-${index}`, fundingOrganizationId: program.organizationId, profileVersionId: program.profileVersionId, profileVersion: 1,
      student, parent, fundingOrganization: program.name, programType: program.type, service: academy,
      selectedServiceCodes: index === 10 ? [] : ['DEMO-ADAPTIVE'], programServiceCodes: program.serviceCodes, programStudentRequirements: requirements,
      status: 'active', statusLabel: 'Active', owner: incomplete ? 'Family' : 'Vendor', nextStep: '', nextStepOptions: [], dueDate: due,
      amountExpected: 0, amountPaid: 0, outstanding: 0, authorization: index === 4 ? 'Not provided' : `DEMO-AUTH-${1000 + index}`,
      authorizationStartDate: index === 6 ? null : day(now, -60), authorizationEndDate: index === 6 ? null : day(now, 120), coveragePercent: 100, coverageCap: amount * 12,
      invoiceCadence: program.cadence, submissionRoute: program.routing, paymentMethod: 'Demo ACH', instructions: program.instructions,
      updatedAt: `${day(now, -1)}T16:00:00.000Z`, invoices: [makeInvoice('current', status, -1), makeInvoice('previous', 'paid', -35), makeInvoice('history', 'paid', -65)],
      contacts, missingDetails: [], activity: [{ id: `${id}-onboard`, title: incomplete ? 'Submission incomplete' : 'Funding authorization reviewed', detail: incomplete ? 'Family documentation or authorization details are still needed. Fictional demo case.' : 'Fictional authorization and service details reviewed by demo staff.', date: day(now, -14) }],
    })
  })
  return { programs: programs.map(program => ({ ...program, activeCases: cases.filter(item => item.fundingOrganizationId === program.organizationId).length, outstanding: cases.filter(item => item.fundingOrganizationId === program.organizationId).reduce((sum, item) => sum + item.outstanding, 0) })), cases }
}

export function recalculateDemoFundingCase(item: FundingCase): FundingCase {
  const missing = [
    !item.authorization || item.authorization === 'Not provided' ? 'Add the authorization reference.' : '',
    !item.authorizationStartDate ? 'Add the coverage start date.' : '', !item.authorizationEndDate ? 'Add the coverage end date.' : '',
    !item.selectedServiceCodes?.length ? 'Select the authorized service code.' : '',
    !item.contacts.some(contact => contact.purpose === 'coordinator_contact') ? 'Add the coordinator contact.' : '',
  ].filter(Boolean)
  const tasks = [...missing]
  if (item.invoices.some(invoice => invoice.status === 'rejected')) tasks.push('Attach the missing attendance record and resubmit the rejected invoice.')
  if (item.invoices.some(invoice => invoice.status === 'overdue')) tasks.push('Follow up with the payer on the overdue invoice.')
  if (item.invoices.some(invoice => invoice.status === 'draft')) tasks.push('Collect family approval, complete the attachments and submit the draft invoice.')
  const unpaid = item.invoices.filter(invoice => invoice.status !== 'paid')
  const status = tasks.length ? 'needs_review' : unpaid.length ? 'waiting' : 'paid'
  return { ...item, missingDetails: missing, nextStepOptions: tasks.length ? tasks : unpaid.length ? ['Check payment after the demo processing window.'] : [],
    nextStep: tasks[0] || (unpaid.length ? 'Await payer processing; reconcile the deposit when it arrives.' : 'No action needed right now.'), status,
    statusLabel: missing.length ? 'Submission incomplete' : item.invoices.some(invoice => invoice.status === 'rejected') ? 'Invoice rejected' : item.invoices.some(invoice => invoice.status === 'overdue') ? 'Invoice overdue' : item.invoices.some(invoice => invoice.status === 'draft') ? 'Draft — approval pending' : status === 'waiting' ? 'Payment pending' : 'Paid',
    amountExpected: item.invoices.reduce((sum, invoice) => sum + invoice.amount, 0), amountPaid: item.invoices.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.amount, 0),
    outstanding: unpaid.reduce((sum, invoice) => sum + invoice.amount, 0) }
}

export function loadDemoFunding(tenantId: string) {
  const initial = createDemoFunding(tenantId)
  if (!isFundingDemoTenant(tenantId) || typeof window === 'undefined') return initial
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(`pulse-funding-demo-v1:${tenantId}`) || 'null') as FundingCase[] | null
    if (Array.isArray(saved) && saved.length === initial.cases.length && saved.every(item => initial.cases.some(original => original.id === item.id))) return { ...initial, cases: saved.map(recalculateDemoFundingCase) }
  } catch { /* Restricted storage uses fresh demo fixtures. */ }
  return initial
}

export function saveDemoFundingCase(tenantId: string, updated: FundingCase) {
  if (!isFundingDemoTenant(tenantId) || !updated.id.startsWith(`mock-funding-${tenantId}-`)) return
  const data = loadDemoFunding(tenantId)
  const cases = data.cases.map(item => item.id === updated.id ? recalculateDemoFundingCase(updated) : item)
  try { window.sessionStorage.setItem(`pulse-funding-demo-v1:${tenantId}`, JSON.stringify(cases)) } catch { /* In-memory edits remain usable. */ }
}

export function resetDemoFunding(tenantId: string) {
  if (!isFundingDemoTenant(tenantId)) return
  try { window.sessionStorage.removeItem(`pulse-funding-demo-v1:${tenantId}`) } catch { /* Fresh fixtures still render. */ }
}

export function fundingTotals(cases: FundingCase[], now = new Date()) {
  const today = now.toISOString().slice(0, 10)
  const end = day(now, 30)
  return {
    owed: cases.reduce((sum, item) => sum + item.outstanding, 0), paid: cases.reduce((sum, item) => sum + item.amountPaid, 0),
    forecast: cases.flatMap(item => item.invoices).filter(invoice => invoice.status === 'pending' && invoice.dueOn && invoice.dueOn >= today && invoice.dueOn <= end).reduce((sum, invoice) => sum + invoice.amount, 0),
  }
}