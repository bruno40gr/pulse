import { NextResponse } from 'next/server'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { createRequestLogContext, getDurationMs, withTimeout } from '@/lib/request-runtime'
import { ensureDemoFixtures } from '@/lib/demo-fixtures'
import { resolveRequestTenant } from '@/lib/tenant-access'

const DEFAULT_TENANT_ID = process.env.CRM_TENANT_ID || '00000000-0000-0000-0000-000000000001'
const LEADS_QUERY_TIMEOUT_MS = 8000
const LEADS_LIST_LIMIT = 100

type LeadContact = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
}

type LeadListRow = {
  id: string
  tenant_id: string
  contact_id: string
  intake_type: string
  source_system: string
  source_form: string
  source_page: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  referrer: string | null
  program_label: string | null
  service_label: string | null
  category: string
  status: string
  priority: string
  temperature: string
  payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
  crm_contacts: LeadContact | LeadContact[] | null
}

type JobApplicationListRow = {
  id: string
  tenant_id: string
  contact_id: string
  status: string
  priority: string
  positions: string[] | null
  payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
  crm_contacts: LeadContact | LeadContact[] | null
}

type ContactIdRow = {
  contact_id: string
}

type QueryResult<T> = {
  data: T | null
  error: { message: string } | null
}

function formatLeadRow(row: LeadListRow) {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    contact_id: row.contact_id,
    intake_type: row.intake_type,
    source_system: row.source_system,
    source_form: row.source_form,
    source_page: row.source_page,
    utm_source: row.utm_source,
    utm_medium: row.utm_medium,
    utm_campaign: row.utm_campaign,
    referrer: row.referrer,
    program_label: row.program_label,
    service_label: row.service_label,
    category: row.category,
    status: row.status,
    priority: row.priority,
    temperature: row.temperature,
    source: typeof row.payload?.source === 'string' ? row.payload.source : 'website',
    follow_up_at: typeof row.payload?.follow_up_at === 'string' ? row.payload.follow_up_at : null,
    follow_up_note: typeof row.payload?.follow_up_note === 'string' ? row.payload.follow_up_note : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    contact: Array.isArray(row.crm_contacts) ? row.crm_contacts[0] : row.crm_contacts,
  }
}

export async function GET(request: Request) {
  const requestLog = createRequestLogContext()

  try {
    const url = new URL(request.url)
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error, requestId: requestLog.requestId }, { status: tenantAccess.status })
    const tenantId = tenantAccess.tenantId
    await ensureDemoFixtures(tenantId)
    const status = url.searchParams.get('status')
    const category = url.searchParams.get('category')
    const intakeType = url.searchParams.get('intake_type')

    if (intakeType === 'job_application') {
      let query = crmSupabaseAdmin
        .from('job_applications')
        .select(`
          id,
          tenant_id,
          contact_id,
          status,
          priority,
          full_name,
          email,
          phone,
          positions,
          experience,
          sight_reading,
          availability,
          resume_link,
          message,
          payload,
          created_at,
          updated_at,
          crm_contacts (
            id,
            full_name,
            email,
            phone
          )
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(LEADS_LIST_LIMIT)

      if (status) query = query.eq('status', status)

      const result = await withTimeout(
        query,
        LEADS_QUERY_TIMEOUT_MS,
        'job applications query',
      )
      const { data, error } = result as QueryResult<JobApplicationListRow[]>

      if (error) throw error

      console.info('[leads][list]', {
        requestId: requestLog.requestId,
        tenantId,
        intakeType,
        status,
        count: data?.length ?? 0,
        durationMs: getDurationMs(requestLog.startedAt),
      })

      const formatted = (data || []).map((row) => formatLeadRow({
        id: row.id,
        tenant_id: row.tenant_id,
        contact_id: row.contact_id,
        intake_type: 'job_application',
        source_system: 'headliner-website',
        source_form: 'careers-teacher-form',
        source_page: '/careers',
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        referrer: null,
        program_label: Array.isArray(row.positions) ? row.positions.join(', ') : null,
        service_label: null,
        category: 'teachers',
        status: row.status,
        priority: row.priority,
        temperature: 'warm',
        payload: row.payload,
        created_at: row.created_at,
        updated_at: row.updated_at,
        crm_contacts: row.crm_contacts,
      }))

      return NextResponse.json(formatted)
    }

    let query = crmSupabaseAdmin
      .from('lead_intakes')
      .select(`
        id,
        tenant_id,
        contact_id,
        intake_type,
        source_system,
        source_form,
        source_page,
        utm_source,
        utm_medium,
        utm_campaign,
        referrer,
        program_label,
        service_label,
        category,
        status,
        priority,
        temperature,
        payload,
        created_at,
        updated_at,
        crm_contacts (
          id,
          full_name,
          email,
          phone
        )
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(LEADS_LIST_LIMIT)

    if (status) query = query.eq('status', status)
    if (category) query = query.eq('category', category)
    if (intakeType) query = query.eq('intake_type', intakeType)

    const result = await withTimeout(
      query,
      LEADS_QUERY_TIMEOUT_MS,
      'lead intakes query',
    )
    const { data, error } = result as QueryResult<LeadListRow[]>

    if (error) throw error

    console.info('[leads][list]', {
      requestId: requestLog.requestId,
      tenantId,
      intakeType,
      status,
      category,
      count: data?.length ?? 0,
      durationMs: getDurationMs(requestLog.startedAt),
    })

    return NextResponse.json((data || []).map((row) => formatLeadRow(row as LeadListRow)))
  } catch (error) {
    console.error('[leads][list] Error fetching leads', {
      requestId: requestLog.requestId,
      durationMs: getDurationMs(requestLog.startedAt),
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not load leads',
        requestId: requestLog.requestId,
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  const requestLog = createRequestLogContext()

  try {
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error, requestId: requestLog.requestId }, { status: tenantAccess.status })
    const tenantId = tenantAccess.tenantId
    await ensureDemoFixtures(tenantId)
    const body = await request.json()
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
      : []
    const password = typeof body?.password === 'string' ? body.password : ''

    if (password !== 'lima') {
      return NextResponse.json({ error: 'Invalid password', requestId: requestLog.requestId }, { status: 403 })
    }

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No leads selected', requestId: requestLog.requestId }, { status: 400 })
    }

    const selectedLeadResult = await withTimeout(
      crmSupabaseAdmin
        .from('lead_intakes')
        .select('id, contact_id')
        .eq('tenant_id', tenantId)
        .in('id', ids),
      LEADS_QUERY_TIMEOUT_MS,
      'selected leads query',
    )

    const { data: selectedLeads, error: selectedLeadsError } = selectedLeadResult as {
      data: Array<{ id: string, contact_id: string }> | null,
      error: { message: string } | null,
    }

    if (selectedLeadsError) throw selectedLeadsError

    const selectedLeadIds = (selectedLeads || []).map((lead) => lead.id)
    const selectedContactIds = [...new Set((selectedLeads || []).map((lead) => lead.contact_id).filter(Boolean))]

    if (selectedLeadIds.length === 0) {
      return NextResponse.json({ error: 'No matching leads found', requestId: requestLog.requestId }, { status: 404 })
    }

    const deleteEventsResult = await withTimeout(
      crmSupabaseAdmin
        .from('lead_events')
        .delete()
        .eq('tenant_id', tenantId)
        .in('lead_intake_id', selectedLeadIds),
      LEADS_QUERY_TIMEOUT_MS,
      'lead events delete',
    )
    if (deleteEventsResult.error) throw deleteEventsResult.error

    const deleteLeadsResult = await withTimeout(
      crmSupabaseAdmin
        .from('lead_intakes')
        .delete()
        .eq('tenant_id', tenantId)
        .in('id', selectedLeadIds),
      LEADS_QUERY_TIMEOUT_MS,
      'lead delete',
    )
    if (deleteLeadsResult.error) throw deleteLeadsResult.error

    if (selectedContactIds.length > 0) {
      const remainingLeadResult = await withTimeout(
        crmSupabaseAdmin
          .from('lead_intakes')
          .select('contact_id')
          .eq('tenant_id', tenantId)
          .in('contact_id', selectedContactIds),
        LEADS_QUERY_TIMEOUT_MS,
        'remaining leads query',
      )
      if (remainingLeadResult.error) throw remainingLeadResult.error

      const remainingJobApplicationResult = await withTimeout(
        crmSupabaseAdmin
          .from('job_applications')
          .select('contact_id')
          .eq('tenant_id', tenantId)
          .in('contact_id', selectedContactIds),
        LEADS_QUERY_TIMEOUT_MS,
        'remaining job applications query',
      )
      if (remainingJobApplicationResult.error) throw remainingJobApplicationResult.error

      const protectedContactIds = new Set<string>([
        ...(((remainingLeadResult as QueryResult<ContactIdRow[]>).data || []).map((row) => row.contact_id)),
        ...(((remainingJobApplicationResult as QueryResult<ContactIdRow[]>).data || []).map((row) => row.contact_id)),
      ])

      const orphanedContactIds = selectedContactIds.filter((contactId) => !protectedContactIds.has(contactId))

      if (orphanedContactIds.length > 0) {
        const deleteContactsResult = await withTimeout(
          crmSupabaseAdmin
            .from('crm_contacts')
            .delete()
            .eq('tenant_id', tenantId)
            .in('id', orphanedContactIds),
          LEADS_QUERY_TIMEOUT_MS,
          'orphaned contacts delete',
        )
        if (deleteContactsResult.error) throw deleteContactsResult.error
      }
    }

    return NextResponse.json({ success: true, deletedIds: selectedLeadIds, requestId: requestLog.requestId })
  } catch (error) {
    console.error('[leads][delete] Error deleting leads', {
      requestId: requestLog.requestId,
      durationMs: getDurationMs(requestLog.startedAt),
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not delete leads',
        requestId: requestLog.requestId,
      },
      { status: 500 },
    )
  }
}
