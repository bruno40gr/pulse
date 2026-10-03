import { NextResponse } from 'next/server'
import { PERMISSIONS } from '@/lib/permissions'
import { authorizeFunding } from '@/lib/funding/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

function object(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

// student_accounts is optional in this schema, so treat its absence as "no link"
// rather than failing the request.
function isMissingStudentAccounts(error: { code?: string; message?: string } | null) {
  if (!error) return false
  const code = error.code || ''
  const message = error.message || ''
  return code === '42P01' || code === 'PGRST205' || /student_accounts/.test(message) || /schema cache/i.test(message)
}

async function accountBelongsToTenant(accountId: string, tenantId: string) {
  const { data, error } = await supabaseAdmin.from('students')
    .select('id').eq('tenant_id', tenantId).eq('account_id', accountId).limit(1)
  if (error) throw error
  if (data?.length) return true
  const { data: linked, error: linkedError } = await supabaseAdmin.from('student_accounts')
    .select('student:students!inner(id)').eq('account_id', accountId).eq('student.tenant_id', tenantId).limit(1)
  if (linkedError) {
    if (isMissingStudentAccounts(linkedError)) return false
    throw linkedError
  }
  return Boolean(linked?.length)
}

// People of contact hang off the customer account, so resolve the account from the
// student when the caller only knows which student (or funding case) it is working with.
async function resolveStudentAccountId(studentId: string, tenantId: string) {
  const { data: student, error } = await supabaseAdmin.from('students')
    .select('id, account_id').eq('tenant_id', tenantId).eq('id', studentId).maybeSingle()
  if (error) throw error
  if (!student) return null
  if (student.account_id) return student.account_id as string
  const { data: link, error: linkError } = await supabaseAdmin.from('student_accounts')
    .select('account_id').eq('student_id', studentId).limit(1).maybeSingle()
  if (linkError) {
    if (isMissingStudentAccounts(linkError)) return null
    throw linkError
  }
  return (link?.account_id as string | undefined) ?? null
}

const CONTACT_PURPOSES = ['family_contact', 'coordinator_contact', 'authorization_contact', 'other'] as const
type ContactPurpose = typeof CONTACT_PURPOSES[number]

export async function GET(request: Request) {
  try {
    const access = await authorizeFunding(request, PERMISSIONS.fundingRead)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const accountId = new URL(request.url).searchParams.get('account_id') || ''
    if (!accountId || !await accountBelongsToTenant(accountId, access.tenantId)) return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
    const { data, error } = await supabaseAdmin.from('account_contacts')
      .select('id, name, relationship, email, phone, notes')
      .eq('tenant_id', access.tenantId).eq('account_id', accountId).eq('is_active', true).is('archived_at', null).order('name')
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('[funding][account-contacts][list]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await authorizeFunding(request, PERMISSIONS.fundingManage)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const body = object(await request.json())
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Contact name is required.' }, { status: 400 })

    const fundingCaseId = typeof body.funding_case_id === 'string' ? body.funding_case_id : ''
    const requestedStudentId = typeof body.student_id === 'string' ? body.student_id : ''
    let accountId = typeof body.account_id === 'string' ? body.account_id : ''

    if (fundingCaseId) {
      const { data: fundingCase, error: caseError } = await supabaseAdmin.from('funding_cases')
        .select('id, student_id').eq('tenant_id', access.tenantId).eq('id', fundingCaseId).maybeSingle()
      if (caseError) throw caseError
      if (!fundingCase) return NextResponse.json({ error: 'Funding case not found.' }, { status: 404 })
      if (!accountId) accountId = await resolveStudentAccountId(fundingCase.student_id, access.tenantId) || ''
    } else if (!accountId && requestedStudentId) {
      accountId = await resolveStudentAccountId(requestedStudentId, access.tenantId) || ''
    }

    if (!accountId || !await accountBelongsToTenant(accountId, access.tenantId)) {
      return NextResponse.json({ error: 'This student is not linked to a customer account, so a person of contact cannot be added yet.' }, { status: 400 })
    }

    const { data: contact, error } = await supabaseAdmin.from('account_contacts').insert({
      tenant_id: access.tenantId,
      account_id: accountId,
      name,
      relationship: typeof body.relationship === 'string' ? body.relationship.trim() || null : null,
      email: typeof body.email === 'string' ? body.email.trim() || null : null,
      phone: typeof body.phone === 'string' ? body.phone.trim() || null : null,
      notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
      created_by_membership_id: access.context.membershipId,
    }).select('id, name, relationship, email, phone, notes').single()
    if (error) throw error

    if (!fundingCaseId) return NextResponse.json(contact, { status: 201 })

    const requestedPurpose = typeof body.purpose === 'string' ? body.purpose : ''
    const purpose: ContactPurpose = (CONTACT_PURPOSES as readonly string[]).includes(requestedPurpose)
      ? requestedPurpose as ContactPurpose
      : 'other'
    const { error: assignmentError } = await supabaseAdmin.from('funding_case_contacts').insert({
      tenant_id: access.tenantId,
      funding_case_id: fundingCaseId,
      account_contact_id: contact.id,
      purpose,
      relationship_snapshot: contact.relationship,
      created_by_membership_id: access.context.membershipId,
    })
    if (assignmentError) {
      // Keep the funding case clean: a failed assignment must not leave an orphan contact.
      await supabaseAdmin.from('account_contacts').delete().eq('id', contact.id).eq('tenant_id', access.tenantId)
      throw assignmentError
    }

    return NextResponse.json({ ...contact, purpose, funding_case_id: fundingCaseId }, { status: 201 })
  } catch (error) {
    console.error('[funding][account-contacts][create]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}