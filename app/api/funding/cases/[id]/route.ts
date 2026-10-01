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
    if (typeof body.next_step === 'string') updates.next_step = body.next_step.trim()
    if (Array.isArray(body.next_step_options)) updates.next_step_options = body.next_step_options
    if (body.waiting_on !== undefined) {
      if (typeof body.waiting_on !== 'string' || !['Vendor', 'Family', 'Funder'].includes(body.waiting_on)) {
        return NextResponse.json({ error: 'Choose who the case is waiting on.' }, { status: 400 })
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
    return NextResponse.json(await loadFundingCase(access.tenantId, id))
  } catch (error) {
    console.error('[funding][case][update]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}