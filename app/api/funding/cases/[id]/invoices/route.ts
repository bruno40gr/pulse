import { NextResponse } from 'next/server'
import { isFundingInvoiceStatus } from '@/lib/funding/invoice-status'
import { authorizeFunding, loadFundingCase } from '@/lib/funding/server'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await authorizeFunding(request, PERMISSIONS.fundingManage)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const { id } = await params
    if (!await loadFundingCase(access.tenantId, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await request.json()
    const invoiceNumber = typeof body.invoice_number === 'string' ? body.invoice_number.trim() : ''
    const amount = Number(body.amount)
    const status = isFundingInvoiceStatus(body.status) ? body.status : 'draft'
    if (!invoiceNumber || !Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: 'Invoice number and a valid non-negative amount are required.' }, { status: 400 })
    }
    if (status === 'rejected' && (typeof body.rejection_evidence !== 'string' || !body.rejection_evidence.trim())) {
      return NextResponse.json({ error: 'Rejection evidence is required.' }, { status: 400 })
    }
    if (status === 'paid' && (typeof body.paid_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.paid_on))) {
      return NextResponse.json({ error: 'Paid date is required.' }, { status: 400 })
    }
    const { error } = await supabaseAdmin.from('funding_invoices').insert({
      tenant_id: access.tenantId,
      funding_case_id: id,
      invoice_number: invoiceNumber,
      amount,
      status,
      service_period_start: body.service_period_start || null,
      service_period_end: body.service_period_end || null,
      issued_on: body.issued_on || null,
      due_on: body.due_on || null,
      paid_on: status === 'paid' ? body.paid_on : null,
      rejection_evidence: status === 'rejected' ? body.rejection_evidence.trim() : null,
      created_by_membership_id: access.context.membershipId,
    })
    if (error) throw error
    return NextResponse.json(await loadFundingCase(access.tenantId, id), { status: 201 })
  } catch (error) {
    console.error('[funding][invoices][create]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}