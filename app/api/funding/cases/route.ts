import { NextResponse } from 'next/server'
import { PERMISSIONS } from '@/lib/permissions'
import { authorizeFunding, loadFundingCase, loadFundingCases } from '@/lib/funding/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const access = await authorizeFunding(request, PERMISSIONS.fundingRead)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const studentPersonId = new URL(request.url).searchParams.get('student_person_id') || undefined
    return NextResponse.json(await loadFundingCases(access.tenantId, undefined, studentPersonId))
  } catch (error) {
    console.error('[funding][cases][list]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await authorizeFunding(request, PERMISSIONS.fundingManage)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const body = await request.json()
    const required = ['student_id', 'payer_id', 'student_payer_id', 'program_type', 'service_description'] as const
    if (required.some(key => typeof body[key] !== 'string' || !body[key].trim())) {
      return NextResponse.json({ error: 'Student, payer, program type, and service are required.' }, { status: 400 })
    }
    if (body.workflow_status && !['needs_review', 'waiting', 'active', 'paid'].includes(body.workflow_status)) {
      return NextResponse.json({ error: 'Choose a valid funding case status.' }, { status: 400 })
    }
    if (body.waiting_on && !['Vendor', 'Family', 'Funder'].includes(body.waiting_on)) {
      return NextResponse.json({ error: 'Choose who the case is waiting on.' }, { status: 400 })
    }
    if (body.due_date && (typeof body.due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.due_date))) {
      return NextResponse.json({ error: 'Choose a valid due date.' }, { status: 400 })
    }
    const { data, error } = await supabaseAdmin.from('funding_cases').insert({
      tenant_id: access.tenantId,
      student_id: body.student_id,
      payer_id: body.payer_id,
      student_payer_id: body.student_payer_id,
      program_type: body.program_type.trim(),
      service_description: body.service_description.trim(),
      workflow_status: body.workflow_status || 'active',
      waiting_on: body.waiting_on || 'Vendor',
      next_step: typeof body.next_step === 'string' ? body.next_step.trim() : '',
      next_step_options: Array.isArray(body.next_step_options) ? body.next_step_options : [],
      due_date: body.due_date || null,
      authorization_reference: body.authorization_reference || null,
      invoice_cadence: body.invoice_cadence || null,
      submission_route: body.submission_route || null,
      payment_method: body.payment_method || null,
      instructions: body.instructions || null,
      created_by_membership_id: access.context.membershipId,
    }).select('id').single()
    if (error) throw error
    const fundingCase = await loadFundingCase(access.tenantId, data.id)
    return NextResponse.json(fundingCase, { status: 201 })
  } catch (error) {
    console.error('[funding][cases][create]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}