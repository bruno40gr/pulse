import { NextResponse } from 'next/server'
import { validateInvoiceStatusChange } from '@/lib/funding/invoice-status'
import { authorizeFunding, loadFundingCase } from '@/lib/funding/server'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await authorizeFunding(request, PERMISSIONS.fundingManage)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    const { id } = await params
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('funding_invoices').select('id, funding_case_id, status').eq('id', id).eq('tenant_id', access.tenantId).maybeSingle()
    if (invoiceError) throw invoiceError
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await request.json()
    const validationError = validateInvoiceStatusChange({
      fromStatus: invoice.status,
      toStatus: body.status,
      evidence: body.evidence,
      paidOn: body.paid_on,
    })
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })
    const { error } = await supabaseAdmin.rpc('odeon_change_funding_invoice_status', {
      p_tenant_id: access.tenantId,
      p_invoice_id: id,
      p_to_status: body.status,
      p_evidence: typeof body.evidence === 'string' ? body.evidence.trim() || null : null,
      p_note: typeof body.note === 'string' ? body.note.trim() || null : null,
      p_paid_on: body.status === 'paid' ? body.paid_on : null,
      p_membership_id: access.context.membershipId,
    })
    if (error) throw error
    return NextResponse.json(await loadFundingCase(access.tenantId, invoice.funding_case_id))
  } catch (error) {
    console.error('[funding][invoice][status]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}