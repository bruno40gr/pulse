import { NextResponse } from 'next/server'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { createRequestLogContext, getDurationMs, withTimeout } from '@/lib/request-runtime'

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
  program_label: string | null
  service_label: string | null
  category: string
  status: string
  priority: string
  temperature: string
  created_at: string
  updated_at: string
  crm_contacts: LeadContact | LeadContact[] | null
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
    program_label: row.program_label,
    service_label: row.service_label,
    category: row.category,
    status: row.status,
    priority: row.priority,
    temperature: row.temperature,
    created_at: row.created_at,
    updated_at: row.updated_at,
    contact: Array.isArray(row.crm_contacts) ? row.crm_contacts[0] : row.crm_contacts,
  }
}

export async function GET(request: Request) {
  const requestLog = createRequestLogContext()

  try {
    const url = new URL(request.url)
    const tenantId = url.searchParams.get('tenant') || DEFAULT_TENANT_ID
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

      const result = await withTimeout<any>(
        query,
        LEADS_QUERY_TIMEOUT_MS,
        'job applications query',
      )
      const { data, error } = result as { data: any[] | null, error: { message: string } | null }

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
        program_label: Array.isArray(row.positions) ? row.positions.join(', ') : null,
        service_label: null,
        category: 'teachers',
        status: row.status,
        priority: row.priority,
        temperature: 'warm',
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
        program_label,
        service_label,
        category,
        status,
        priority,
        temperature,
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

    const result = await withTimeout<any>(
      query,
      LEADS_QUERY_TIMEOUT_MS,
      'lead intakes query',
    )
    const { data, error } = result as { data: LeadListRow[] | null, error: { message: string } | null }

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
