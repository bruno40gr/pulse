import { NextResponse } from 'next/server'
import { LESSON_LEAD_TYPES } from '@/lib/lead-lesson-details'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { createRequestLogContext, getDurationMs, withTimeout } from '@/lib/request-runtime'
import { resolveRequestTenant } from '@/lib/tenant-access'
import { requirePermission } from '@/lib/request-context'
import { PERMISSIONS } from '@/lib/permissions'
import { getLeadOpportunityValue, OPEN_LEAD_STATUSES, WON_STATUS } from '@/lib/lead-value'

const DEFAULT_TENANT_ID = process.env.CRM_TENANT_ID || '00000000-0000-0000-0000-000000000001'
const LEADS_QUERY_TIMEOUT_MS = 8000
const LEADS_LIST_LIMIT = 100
const WINBACK_SOURCE_FORM = '2026-disenrollment-import'

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

type DeletableRecordRow = {
  id: string
  contact_id: string
}

type QueryResult<T> = {
  data: T | null
  error: { message: string } | null
}

type LeadActivityEvent = {
  lead_intake_id: string
  event_type: string
  payload: Record<string, unknown> | null
  created_at: string
}

type PipelineTotalsRow = {
  id: string
  intake_type: string
  status: string
  service_label: string | null
  payload: Record<string, unknown> | null
  updated_at: string
}

type WonEventRow = {
  lead_intake_id: string
  created_at: string
}

async function enrichLeadActivity<T extends ReturnType<typeof formatLeadRow>>(tenantId: string, leads: T[]) {
  if (leads.length === 0) return leads

  const leadIds = leads.map((lead) => lead.id)
  const result = await withTimeout(
    crmSupabaseAdmin
      .from('lead_events')
      .select('lead_intake_id, event_type, payload, created_at')
      .eq('tenant_id', tenantId)
      .in('lead_intake_id', leadIds)
      .order('created_at', { ascending: false }),
    LEADS_QUERY_TIMEOUT_MS,
    'lead activity query',
  )
  const { data, error } = result as QueryResult<LeadActivityEvent[]>
  if (error) throw error

  const latestActivity = new Map<string, string>()
  const latestStatusChange = new Map<string, { previous_status: string; next_status: string; created_at: string }>()
  const latestInbound = new Map<string, string>()

  for (const event of data || []) {
    if (!latestActivity.has(event.lead_intake_id)) latestActivity.set(event.lead_intake_id, event.created_at)
    if (event.event_type === 'inbound_sms' && !latestInbound.has(event.lead_intake_id)) {
      latestInbound.set(event.lead_intake_id, event.created_at)
    }
    const previousStatus = typeof event.payload?.previous_status === 'string' ? event.payload.previous_status : null
    const nextStatus = typeof event.payload?.next_status === 'string' ? event.payload.next_status : null
    if (previousStatus && nextStatus && !latestStatusChange.has(event.lead_intake_id)) {
      latestStatusChange.set(event.lead_intake_id, { previous_status: previousStatus, next_status: nextStatus, created_at: event.created_at })
    }
  }

  return leads.map((lead) => ({
    ...lead,
    last_activity_at: latestActivity.get(lead.id) || lead.updated_at || lead.created_at,
    last_status_change: latestStatusChange.get(lead.id) || null,
    last_inbound_at: latestInbound.get(lead.id) || null,
  }))
}

async function getLeadTabCounts(tenantId: string, status: string | null) {
  const lessonQuery = crmSupabaseAdmin
    .from('lead_intakes')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('intake_type', LESSON_LEAD_TYPES)
    .neq('source_form', WINBACK_SOURCE_FORM)
  const serviceQuery = crmSupabaseAdmin
    .from('lead_intakes')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('intake_type', 'service_inquiry')
  const jobsQuery = crmSupabaseAdmin
    .from('job_applications')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
  const winbackQuery = crmSupabaseAdmin
    .from('lead_intakes')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('source_form', WINBACK_SOURCE_FORM)

  if (status && status !== 'all') {
    lessonQuery.eq('status', status)
    serviceQuery.eq('status', status)
    jobsQuery.eq('status', status)
  }

  const [lessonResult, serviceResult, jobsResult, winbackResult] = await Promise.all([
    withTimeout(lessonQuery, LEADS_QUERY_TIMEOUT_MS, 'lesson lead count query'),
    withTimeout(serviceQuery, LEADS_QUERY_TIMEOUT_MS, 'service lead count query'),
    withTimeout(jobsQuery, LEADS_QUERY_TIMEOUT_MS, 'job application count query'),
    withTimeout(winbackQuery, LEADS_QUERY_TIMEOUT_MS, 'win-back count query'),
  ])

  if (lessonResult.error) throw lessonResult.error
  if (serviceResult.error) throw serviceResult.error
  if (jobsResult.error) throw jobsResult.error
  if (winbackResult.error) throw winbackResult.error

  return {
    lesson_inquiry: lessonResult.count ?? 0,
    service_inquiry: serviceResult.count ?? 0,
    job_application: jobsResult.count ?? 0,
    winback: winbackResult.count ?? 0,
  }
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
    payload: row.payload || {},
    source: typeof row.payload?.source === 'string' ? row.payload.source : 'website',
    follow_up_at: typeof row.payload?.follow_up_at === 'string' ? row.payload.follow_up_at : null,
    follow_up_note: typeof row.payload?.follow_up_note === 'string' ? row.payload.follow_up_note : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_activity_at: row.updated_at || row.created_at,
    last_status_change: null,
    last_inbound_at: null,
    contact: Array.isArray(row.crm_contacts) ? row.crm_contacts[0] : row.crm_contacts,
  }
}

async function getPipelineTotals(tenantId: string) {
  const [leadsResult, wonEventsResult] = await Promise.all([
    withTimeout(
      crmSupabaseAdmin
        .from('lead_intakes')
        .select('id, intake_type, status, service_label, payload, updated_at')
        .eq('tenant_id', tenantId),
      LEADS_QUERY_TIMEOUT_MS,
      'pipeline totals leads query',
    ),
    withTimeout(
      crmSupabaseAdmin
        .from('lead_events')
        .select('lead_intake_id, created_at')
        .eq('tenant_id', tenantId)
        .eq('payload->>next_status', 'won')
        .order('created_at', { ascending: false }),
      LEADS_QUERY_TIMEOUT_MS,
      'pipeline totals won events query',
    ),
  ])

  if (leadsResult.error) throw leadsResult.error
  if (wonEventsResult.error) throw wonEventsResult.error

  const leads = (leadsResult.data as PipelineTotalsRow[]) || []
  const wonEvents = (wonEventsResult.data as WonEventRow[]) || []

  const oct1 = new Date(new Date().getFullYear(), 9, 1)
  const latestWonAt = new Map<string, string>()
  for (const event of wonEvents) {
    if (!latestWonAt.has(event.lead_intake_id)) latestWonAt.set(event.lead_intake_id, event.created_at)
  }

  let pipelineValue = 0
  let closedSinceOct1 = 0

  for (const lead of leads) {
    const value = getLeadOpportunityValue({
      intakeType: lead.intake_type,
      payload: lead.payload,
      serviceLabel: lead.service_label,
    })

    if (OPEN_LEAD_STATUSES.includes(lead.status)) pipelineValue += value

    if (lead.status === WON_STATUS) {
      const wonAtRaw = latestWonAt.get(lead.id) || lead.updated_at
      const wonAt = wonAtRaw ? new Date(wonAtRaw) : null
      if (wonAt && !Number.isNaN(wonAt.getTime()) && wonAt >= oct1) closedSinceOct1 += value
    }
  }

  return { pipelineValue, closedSinceOct1 }
}

export async function GET(request: Request) {
  const requestLog = createRequestLogContext()

  try {
    const url = new URL(request.url)
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error, requestId: requestLog.requestId }, { status: tenantAccess.status })
    const tenantId = tenantAccess.tenantId
    const status = url.searchParams.get('status')
    const category = url.searchParams.get('category')
    const intakeType = url.searchParams.get('intake_type') || 'lesson_inquiry'
    const includeCounts = url.searchParams.get('include_counts') === '1'
    const includeActivity = url.searchParams.get('include_activity') !== '0'
    const offset = Number(url.searchParams.get('offset') || '0')
    const limit = Number(url.searchParams.get('limit') || LEADS_LIST_LIMIT)
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
      return NextResponse.json({ error: 'Invalid pagination parameters' }, { status: 400 })
    }
    const countsPromise = includeCounts ? getLeadTabCounts(tenantId, status) : null
    const totalsPromise = includeCounts ? getPipelineTotals(tenantId) : null

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
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1)

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

      const baseRows = (data || []).map((row) => formatLeadRow({
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
      const formatted = includeActivity ? await enrichLeadActivity(tenantId, baseRows) : baseRows

      if (!countsPromise || !totalsPromise) return NextResponse.json(formatted)
      const [counts, totals] = await Promise.all([countsPromise, totalsPromise])
      return NextResponse.json({ leads: formatted, counts, pipelineValue: totals.pipelineValue, closedSinceOct1: totals.closedSinceOct1 })
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
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (category) query = query.eq('category', category)
    if (intakeType === 'winback') query = query.eq('source_form', WINBACK_SOURCE_FORM)
    else if (intakeType) {
      query = intakeType === 'lesson_inquiry' ? query.in('intake_type', LESSON_LEAD_TYPES) : query.eq('intake_type', intakeType)
      if (intakeType === 'lesson_inquiry') query = query.neq('source_form', WINBACK_SOURCE_FORM)
    }

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

    const baseRows = (data || []).map((row) => formatLeadRow(row as LeadListRow))
    const formatted = includeActivity ? await enrichLeadActivity(tenantId, baseRows) : baseRows
    if (!countsPromise || !totalsPromise) return NextResponse.json(formatted)
    const [counts, totals] = await Promise.all([countsPromise, totalsPromise])
    return NextResponse.json({ leads: formatted, counts, pipelineValue: totals.pipelineValue, closedSinceOct1: totals.closedSinceOct1 })
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
    const tenantId = new URL(request.url).searchParams.get('tenant') || DEFAULT_TENANT_ID
    const permission = await requirePermission(request, tenantId, PERMISSIONS.leadsDelete)
    if (!permission.ok) {
      return NextResponse.json(
        { error: permission.error, requestId: requestLog.requestId },
        { status: permission.status },
      )
    }

    const body = await request.json()
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
      : []
    const intakeType = typeof body?.intake_type === 'string' ? body.intake_type : null
    const isJobApplication = intakeType === 'job_application'
    const recordTable = isJobApplication ? 'job_applications' : 'lead_intakes'
    const recordLabel = isJobApplication ? 'teacher applications' : 'leads'

    if (ids.length === 0) {
      return NextResponse.json({ error: `No ${recordLabel} selected`, requestId: requestLog.requestId }, { status: 400 })
    }

    let selectedRecordQuery = crmSupabaseAdmin
      .from(recordTable)
      .select('id, contact_id')
      .eq('tenant_id', tenantId)
      .in('id', ids)

    if (!isJobApplication) {
      if (intakeType === 'winback') selectedRecordQuery = selectedRecordQuery.eq('source_form', WINBACK_SOURCE_FORM)
      else if (intakeType === 'lesson_inquiry') selectedRecordQuery = selectedRecordQuery.in('intake_type', LESSON_LEAD_TYPES).neq('source_form', WINBACK_SOURCE_FORM)
      else if (intakeType === 'service_inquiry') selectedRecordQuery = selectedRecordQuery.eq('intake_type', intakeType)
    }

    const selectedRecordResult = await withTimeout(
      selectedRecordQuery,
      LEADS_QUERY_TIMEOUT_MS,
      `selected ${recordLabel} query`,
    )

    const { data: selectedRecords, error: selectedRecordsError } = selectedRecordResult as {
      data: DeletableRecordRow[] | null,
      error: { message: string } | null,
    }

    if (selectedRecordsError) throw selectedRecordsError

    const selectedRecordIds = (selectedRecords || []).map((record) => record.id)
    const selectedContactIds = [...new Set((selectedRecords || []).map((record) => record.contact_id).filter(Boolean))]

    if (selectedRecordIds.length === 0) {
      return NextResponse.json({ error: `No matching ${recordLabel} found`, requestId: requestLog.requestId }, { status: 404 })
    }

    if (!isJobApplication) {
      const deleteEventsResult = await withTimeout(
        crmSupabaseAdmin
          .from('lead_events')
          .delete()
          .eq('tenant_id', tenantId)
          .in('lead_intake_id', selectedRecordIds),
        LEADS_QUERY_TIMEOUT_MS,
        'lead events delete',
      )
      if (deleteEventsResult.error) throw deleteEventsResult.error
    }

    const deleteRecordsResult = await withTimeout(
      crmSupabaseAdmin
        .from(recordTable)
        .delete()
        .eq('tenant_id', tenantId)
        .in('id', selectedRecordIds),
      LEADS_QUERY_TIMEOUT_MS,
      `${recordLabel} delete`,
    )
    if (deleteRecordsResult.error) throw deleteRecordsResult.error

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

    console.info('[leads][delete]', {
      requestId: requestLog.requestId,
      tenantId,
      intakeType,
      recordTable,
      deletedCount: selectedRecordIds.length,
      durationMs: getDurationMs(requestLog.startedAt),
    })

    return NextResponse.json({ success: true, deletedIds: selectedRecordIds, requestId: requestLog.requestId })
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
