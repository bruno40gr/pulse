import { NextResponse } from 'next/server'
import { PERMISSIONS } from '@/lib/permissions'
import { authorizeFunding, loadFundingCase } from '@/lib/funding/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await authorizeFunding(request, PERMISSIONS.fundingRead)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const { id } = await params
    const fundingCase = await loadFundingCase(access.tenantId, id)
    if (!fundingCase) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(fundingCase)
  } catch (error) {
    console.error('[funding][case][get]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await authorizeFunding(request, PERMISSIONS.fundingManage)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const { id } = await params
    if (!await loadFundingCase(access.tenantId, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (body.service_description !== undefined) updates.service_description = typeof body.service_description === 'string' ? body.service_description.trim() || null : null
    if (body.service_codes !== undefined) {
      if (!Array.isArray(body.service_codes) || body.service_codes.some((value: unknown) => typeof value !== 'string')) {
        return NextResponse.json({ error: 'Service codes must be a list of text values.' }, { status: 400 })
      }
      updates.service_codes = body.service_codes.map((value: string) => value.trim()).filter(Boolean)
    }
    if (body.authorization_reference !== undefined) updates.authorization_reference = typeof body.authorization_reference === 'string' ? body.authorization_reference.trim() || null : null
    for (const field of ['authorization_start_date', 'authorization_end_date'] as const) {
      const value = body[field]
      if (value !== undefined) {
        if (value !== null && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))) {
          return NextResponse.json({ error: 'Authorization dates must use YYYY-MM-DD.' }, { status: 400 })
        }
        updates[field] = value || null
      }
    }
    for (const field of ['coverage_percent', 'coverage_cap'] as const) {
      const value = body[field]
      if (value !== undefined) {
        if (value !== null && value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
          return NextResponse.json({ error: 'Coverage values must be non-negative numbers.' }, { status: 400 })
        }
        if (field === 'coverage_percent' && value !== null && value !== '' && Number(value) > 100) {
          return NextResponse.json({ error: 'Coverage percent cannot exceed 100.' }, { status: 400 })
        }
        updates[field] = value === null || value === '' ? null : Number(value)
      }
    }
    if (typeof body.next_step === 'string') updates.next_step = body.next_step.trim()
    if (Array.isArray(body.next_step_options)) updates.next_step_options = body.next_step_options
    if (body.lifecycle_status !== undefined) {
      if (typeof body.lifecycle_status !== 'string' || !['discovery', 'blocked', 'active', 'inactive', 'archived'].includes(body.lifecycle_status)) {
        return NextResponse.json({ error: 'Choose a valid funding lifecycle status.' }, { status: 400 })
      }
      updates.lifecycle_status = body.lifecycle_status
      updates.archived_at = body.lifecycle_status === 'archived' ? new Date().toISOString() : null
      if (body.lifecycle_status !== 'blocked') updates.blocker_type = null
    }
    if (body.blocker_type !== undefined) {
      if (body.blocker_type !== null && (typeof body.blocker_type !== 'string' || !['vendor_approval_pending', 'student_linking_pending', 'document_task_pending', 'authorization_pending', 'other'].includes(body.blocker_type))) {
        return NextResponse.json({ error: 'Choose a valid funding blocker.' }, { status: 400 })
      }
      updates.blocker_type = body.blocker_type
    }
    if (body.profile_overrides !== undefined) {
      if (!body.profile_overrides || typeof body.profile_overrides !== 'object' || Array.isArray(body.profile_overrides)) {
        return NextResponse.json({ error: 'Profile overrides must be an object.' }, { status: 400 })
      }
      updates.profile_overrides = body.profile_overrides
    }
    if (typeof body.case_instructions === 'string') updates.case_instructions = body.case_instructions.trim() || null
    if (body.waiting_on !== undefined) {
      if (typeof body.waiting_on !== 'string' || !['Vendor', 'Family', 'Funder'].includes(body.waiting_on)) {
        return NextResponse.json({ error: 'Choose who the funded student is waiting on.' }, { status: 400 })
      }
      updates.waiting_on = body.waiting_on
    }
    if (body.due_date !== undefined) {
      if (body.due_date !== null && (typeof body.due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.due_date))) {
        return NextResponse.json({ error: 'Choose a valid due date.' }, { status: 400 })
      }
      updates.due_date = body.due_date
    }
    if (!Object.keys(updates).length) return NextResponse.json({ error: 'No supported changes were provided.' }, { status: 400 })
    const { error } = await supabaseAdmin.from('funding_cases').update(updates).eq('id', id).eq('tenant_id', access.tenantId)
    if (error) throw error
    const studentPayerUpdates: Record<string, unknown> = {}
    if ('coverage_percent' in updates) studentPayerUpdates.coverage_percent = updates.coverage_percent
    if ('coverage_cap' in updates) studentPayerUpdates.coverage_cap = updates.coverage_cap
    if ('authorization_start_date' in updates) studentPayerUpdates.start_date = updates.authorization_start_date
    if ('authorization_end_date' in updates) studentPayerUpdates.end_date = updates.authorization_end_date
    if (Object.keys(studentPayerUpdates).length) {
      const { data: caseLink, error: caseLinkError } = await supabaseAdmin.from('funding_cases').select('student_payer_id').eq('id', id).eq('tenant_id', access.tenantId).single()
      if (caseLinkError) throw caseLinkError
      const { error: linkError } = await supabaseAdmin.from('student_payers').update(studentPayerUpdates).eq('id', caseLink.student_payer_id)
      if (linkError) throw linkError
    }
    const { error: eventError } = await supabaseAdmin.from('funding_case_events').insert({
      tenant_id: access.tenantId,
      funding_case_id: id,
      event_type: updates.archived_at ? 'case.archived' : 'case.updated',
      title: updates.archived_at ? 'Funding relationship archived' : 'Funding details updated',
      detail: typeof body.note === 'string' ? body.note.trim() || null : null,
      metadata: { changed_fields: Object.keys(updates) },
      created_by_membership_id: access.context.membershipId,
    })
    if (eventError) throw eventError
    return NextResponse.json(await loadFundingCase(access.tenantId, id))
  } catch (error) {
    console.error('[funding][case][update]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}