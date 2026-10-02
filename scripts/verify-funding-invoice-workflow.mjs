import { createHmac, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const HEADLINER_TENANT_ID = '00000000-0000-0000-0000-000000000001'
const OTHER_TENANT_ID = '00000000-0000-0000-0000-000000000002'
const BASE_URL = process.env.PULSE_TEST_BASE_URL || 'http://127.0.0.1:3000'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const created = { cases: [], studentPayers: [], payers: [] }

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function accessCookie(actor) {
  const payload = Buffer.from(JSON.stringify({ actor, expiresAt: Date.now() + 60 * 60 * 1000 })).toString('base64url')
  const secret = process.env.PULSE_SESSION_SECRET || process.env.PULSE_SYSTEM_PASSWORD || 'pulse-headliner-session-2026'
  return `pulse_access=${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`
}

async function request(path, cookie, init = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), Cookie: cookie, ...init.headers },
  })
  const body = await response.json().catch(() => ({}))
  return { status: response.status, body }
}

async function ownerActor() {
  const { data: memberships, error } = await supabase
    .from('tenant_memberships')
    .select('person_id, role:roles!inner(key), person:people!inner(first_name, last_name)')
    .eq('tenant_id', HEADLINER_TENANT_ID)
    .in('status', ['unclaimed', 'invited', 'active'])
    .eq('role.key', 'owner')
  if (error) throw error

  for (const membership of memberships || []) {
    const { data: instructor, error: instructorError } = await supabase
      .from('instructors').select('id').eq('tenant_id', HEADLINER_TENANT_ID).eq('person_id', membership.person_id).maybeSingle()
    if (instructorError) throw instructorError
    if (!instructor) continue
    const person = Array.isArray(membership.person) ? membership.person[0] : membership.person
    return {
      instructorId: instructor.id,
      personId: membership.person_id,
      fullName: `${person.first_name || ''} ${person.last_name || ''}`.trim(),
      displayName: `${person.first_name || 'Owner'} ${(person.last_name || '').slice(0, 1)}.`.trim(),
      access: { kind: 'headliner' },
    }
  }
  throw new Error('No Headliner Owner with an instructor record was found.')
}

async function firstStudent(tenantId) {
  const { data, error } = await supabase.from('students').select('id').eq('tenant_id', tenantId).limit(1).maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`No student exists for verifier tenant ${tenantId}.`)
  return data.id
}

async function createPayerLink(tenantId, studentId, suffix) {
  const { data: payer, error: payerError } = await supabase.from('payers').insert({
    tenant_id: tenantId,
    name: `Funding verifier ${suffix}`,
    type: 'other',
    program_name: 'Verification program',
  }).select('id').single()
  if (payerError) throw payerError
  created.payers.push(payer.id)

  const { data: link, error: linkError } = await supabase.from('student_payers').insert({
    student_id: studentId,
    payer_id: payer.id,
    coverage_percent: 100,
  }).select('id').single()
  if (linkError) throw linkError
  created.studentPayers.push(link.id)
  return { payerId: payer.id, studentPayerId: link.id }
}

async function createOtherTenantCase(studentId, link, suffix) {
  const { data, error } = await supabase.from('funding_cases').insert({
    tenant_id: OTHER_TENANT_ID,
    student_id: studentId,
    payer_id: link.payerId,
    student_payer_id: link.studentPayerId,
    program_type: 'Verification',
    service_description: 'Cross-tenant verification',
    next_step: 'Do not expose this record.',
  }).select('id').single()
  if (error) throw error
  created.cases.push(data.id)

  const { data: invoice, error: invoiceError } = await supabase.from('funding_invoices').insert({
    tenant_id: OTHER_TENANT_ID,
    funding_case_id: data.id,
    invoice_number: `OTHER-${suffix}`,
    amount: 75,
    status: 'pending',
  }).select('id').single()
  if (invoiceError) throw invoiceError
  return { caseId: data.id, invoiceId: invoice.id }
}

async function cleanup() {
  const { data: verifierPayers, error: payerLookupError } = await supabase
    .from('payers')
    .select('id')
    .like('name', 'Funding verifier %')
  if (payerLookupError) throw payerLookupError

  const payerIds = [...new Set([...(verifierPayers || []).map(payer => payer.id), ...created.payers])]
  if (!payerIds.length) return

  const { data: verifierLinks, error: linkLookupError } = await supabase
    .from('student_payers')
    .select('id')
    .in('payer_id', payerIds)
  if (linkLookupError) throw linkLookupError

  const studentPayerIds = [...new Set([...(verifierLinks || []).map(link => link.id), ...created.studentPayers])]
  if (studentPayerIds.length) {
    const { error: caseError } = await supabase.from('funding_cases').delete().in('student_payer_id', studentPayerIds)
    if (caseError) throw caseError
    const { error: linkError } = await supabase.from('student_payers').delete().in('id', studentPayerIds)
    if (linkError) throw linkError
  }

  const { error: payerError } = await supabase.from('payers').delete().in('id', payerIds)
  if (payerError) throw payerError

  created.cases.length = 0
  created.studentPayers.length = 0
  created.payers.length = 0
}

async function main() {
  const schemaCheck = await supabase.from('funding_cases').select('id').limit(1)
  if (schemaCheck.error) {
    if (schemaCheck.error.code === 'PGRST205' || /schema cache|does not exist/i.test(schemaCheck.error.message)) {
      throw new Error('Funding workflow schema is unavailable. Apply scripts/migration-018-funding-invoice-workflow.sql to an approved development Supabase environment first.')
    }
    throw schemaCheck.error
  }

  await cleanup()

  const suffix = randomUUID().slice(0, 8)
  const cookie = accessCookie(await ownerActor())
  const studentId = await firstStudent(HEADLINER_TENANT_ID)
  const link = await createPayerLink(HEADLINER_TENANT_ID, studentId, suffix)

  const createdCase = await request(`/api/funding/cases?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'POST',
    body: JSON.stringify({
      student_id: studentId,
      payer_id: link.payerId,
      student_payer_id: link.studentPayerId,
      program_type: 'Verification',
      service_description: 'Verifier service',
      next_step: 'Verify the invoice workflow.',
      next_step_options: ['Verify the invoice workflow.'],
      waiting_on: 'Vendor',
    }),
  })
  assert(createdCase.status === 201, `Case creation failed (${createdCase.status}): ${createdCase.body.error || 'unknown error'}`)
  created.cases.push(createdCase.body.id)

  const createdInvoice = await request(`/api/funding/cases/${createdCase.body.id}/invoices?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'POST',
    body: JSON.stringify({ invoice_number: `VERIFY-${suffix}`, amount: 125, status: 'pending', due_on: '2026-10-15' }),
  })
  assert(createdInvoice.status === 201, `Invoice creation failed (${createdInvoice.status}): ${createdInvoice.body.error || 'unknown error'}`)
  const invoice = createdInvoice.body.invoices?.[0]
  assert(invoice?.status === 'pending', 'Created invoice must be pending.')
  assert(invoice.statusEvents?.length === 1 && invoice.statusEvents[0].fromStatus === null, 'Invoice creation must create initial status history atomically.')

  const rejectedWithoutEvidence = await request(`/api/funding/invoices/${invoice.id}/status?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'PATCH', body: JSON.stringify({ status: 'rejected' }),
  })
  assert(rejectedWithoutEvidence.status === 400, 'Rejection without evidence must return 400.')

  const rejectionEvidence = 'Verifier payer response: authorization code mismatch.'
  const rejected = await request(`/api/funding/invoices/${invoice.id}/status?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'PATCH', body: JSON.stringify({ status: 'rejected', evidence: rejectionEvidence, note: 'Verifier rejection.' }),
  })
  assert(rejected.status === 200, `Evidence-backed rejection failed (${rejected.status}).`)
  assert(rejected.body.status === 'needs_review', 'Rejected invoice must move the case to Needs review.')
  assert(rejected.body.outstanding === 125, 'Rejected invoice must preserve outstanding value.')
  assert(rejected.body.invoices[0].rejectionEvidence === rejectionEvidence, 'Rejection evidence must be persisted.')
  assert(rejected.body.invoices[0].statusEvents.length === 2, 'Rejection must append invoice status history.')
  assert(rejected.body.activity.some(event => event.title === 'Invoice Rejected'), 'Rejection must append case activity.')

  const returnedPending = await request(`/api/funding/invoices/${invoice.id}/status?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'PATCH', body: JSON.stringify({ status: 'pending', note: 'Corrected invoice submitted.' }),
  })
  assert(returnedPending.status === 200 && returnedPending.body.status === 'waiting', 'Resubmission must return the case to Waiting.')

  const paid = await request(`/api/funding/invoices/${invoice.id}/status?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'PATCH', body: JSON.stringify({ status: 'paid', paid_on: '2026-10-01', note: 'Verifier payment.' }),
  })
  assert(paid.status === 200, `Paid transition failed (${paid.status}).`)
  assert(paid.body.status === 'paid' && paid.body.outstanding === 0 && paid.body.amountPaid === 125, 'Paid transition must reconcile the case totals.')

  const otherStudentId = await firstStudent(OTHER_TENANT_ID)
  const otherLink = await createPayerLink(OTHER_TENANT_ID, otherStudentId, `${suffix}-other`)
  const other = await createOtherTenantCase(otherStudentId, otherLink, suffix)
  const crossTenantCase = await request(`/api/funding/cases/${other.caseId}?tenant=${HEADLINER_TENANT_ID}`, cookie)
  assert(crossTenantCase.status === 404, 'A cross-tenant funding case ID must return 404.')
  const crossTenantInvoice = await request(`/api/funding/invoices/${other.invoiceId}/status?tenant=${HEADLINER_TENANT_ID}`, cookie, {
    method: 'PATCH', body: JSON.stringify({ status: 'paid', paid_on: '2026-10-01' }),
  })
  assert(crossTenantInvoice.status === 404, 'A cross-tenant invoice ID must return 404.')

  console.log('Funding invoice workflow verification passed.')
}

try {
  await main()
} finally {
  await cleanup()
}