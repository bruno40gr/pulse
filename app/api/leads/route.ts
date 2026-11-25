import { NextResponse } from 'next/server'
import { LESSON_LEAD_TYPES } from '@/lib/lead-lesson-details'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createRequestLogContext, getDurationMs, withTimeout } from '@/lib/request-runtime'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { requireOwner, requirePermission } from '@/lib/request-context'
import { PERMISSIONS } from '@/lib/permissions'
import { getLeadOpportunityValue, OPEN_LEAD_STATUSES, WON_STATUS } from '@/lib/lead-value'
import { NEW_LEAD_WINDOW_MS, netNewLeadCounts } from '@/lib/lead-counter-semantics'

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
  person_id?: string | null
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
    .not('status', 'in', '(won,lost,ghosted_us,ghosted)')
  const serviceQuery = crmSupabaseAdmin
    .from('lead_intakes')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('intake_type', 'service_inquiry')
    .neq('source_form', WINBACK_SOURCE_FORM)
    .not('status', 'in', '(won,lost,ghosted_us,ghosted)')
  const jobsQuery = crmSupabaseAdmin
    .from('job_applications')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
  const winbackQuery = crmSupabaseAdmin
    .from('lead_intakes')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('source_form', WINBACK_SOURCE_FORM)
    .neq('status', 'won')

  if (status && status !== 'all') {
    lessonQuery.eq('status', status)
    serviceQuery.eq('status', status)
    jobsQuery.eq('status', status)
  }

  const enrolledQuery = crmSupabaseAdmin.from('lead_intakes').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('intake_type', [...LESSON_LEAD_TYPES, 'service_inquiry']).eq('status', 'won')
  const lostQuery = crmSupabaseAdmin.from('lead_intakes').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('intake_type', [...LESSON_LEAD_TYPES, 'service_inquiry']).neq('source_form', WINBACK_SOURCE_FORM).in('status', ['lost', 'ghosted_us', 'ghosted'])
  if (status && status !== 'all') { enrolledQuery.eq('status', status); lostQuery.eq('status', status) }
  const [lessonResult, serviceResult, jobsResult, winbackResult, enrolledResult, lostResult] = await Promise.all([
    withTimeout(lessonQuery, LEADS_QUERY_TIMEOUT_MS, 'lesson lead count query'),
    withTimeout(serviceQuery, LEADS_QUERY_TIMEOUT_MS, 'service lead count query'),
    withTimeout(jobsQuery, LEADS_QUERY_TIMEOUT_MS, 'job application count query'),
    withTimeout(winbackQuery, LEADS_QUERY_TIMEOUT_MS, 'win-back count query'),
    withTimeout(enrolledQuery, LEADS_QUERY_TIMEOUT_MS, 'enrolled count query'),
    withTimeout(lostQuery, LEADS_QUERY_TIMEOUT_MS, 'lost count query'),
  ])

  if (lessonResult.error) throw lessonResult.error
  if (serviceResult.error) throw serviceResult.error
  if (jobsResult.error) throw jobsResult.error
  if (winbackResult.error) throw winbackResult.error
  if (enrolledResult.error) throw enrolledResult.error
  if (lostResult.error) throw lostResult.error

  return {
    lesson_inquiry: lessonResult.count ?? 0,
    service_inquiry: serviceResult.count ?? 0,
    job_application: jobsResult.count ?? 0,
    winback: winbackResult.count ?? 0,
    enrolled: enrolledResult.count ?? 0,
    lost: lostResult.count ?? 0,
  }
}

/** Distinct net-new contacts: uncontacted AND younger than 48 hours. */
async function getNewLeadCounts(tenantId: string) {
  const now = new Date()
  const cutoff = new Date(now.getTime() - NEW_LEAD_WINDOW_MS).toISOString()
  const leads: { id: string; contact_id: string | null; intake_type: string; created_at: string }[] = []
  for (let offset = 0; ; offset += 500) {
    const result = await withTimeout(crmSupabaseAdmin.from('lead_intakes')
      .select('id,contact_id,intake_type,created_at').eq('tenant_id', tenantId)
      .in('intake_type', [...LESSON_LEAD_TYPES, 'service_inquiry']).is('person_id', null)
      .neq('source_form', WINBACK_SOURCE_FORM)
      // Legacy band opportunities predate person_id and are still existing students.
      .neq('source_form', 'contact-band-opportunity').eq('status', 'new')
      .gt('created_at', cutoff).lte('created_at', now.toISOString()).order('id').range(offset, offset + 499),
    LEADS_QUERY_TIMEOUT_MS, 'net-new lead count query')
    if (result.error) throw result.error
    leads.push(...(result.data || []))
    if ((result.data || []).length < 500) break
  }
  const events: { lead_intake_id: string | null; contact_id: string | null; event_type: string; payload: Record<string, unknown> | null }[] = []
  const contactIds = [...new Set(leads.map(lead => lead.contact_id).filter((id): id is string => !!id))]
  // A repeat submission must not restart a person's 48-hour notification window.
  for (let start = 0; start < contactIds.length; start += 100) {
    for (let offset = 0; ; offset += 500) {
      const result = await withTimeout(crmSupabaseAdmin.from('lead_intakes').select('id,contact_id,created_at,status,person_id')
        .eq('tenant_id', tenantId).in('contact_id', contactIds.slice(start, start + 100))
        .order('id').range(offset, offset + 499), LEADS_QUERY_TIMEOUT_MS, 'net-new identity history query')
      if (result.error) throw result.error
      for (const row of result.data || []) {
        if (row.created_at <= cutoff || row.person_id || ['contacted', 'booked', 'processing', 'won'].includes(row.status)) {
          events.push({ lead_intake_id: row.id, contact_id: row.contact_id, event_type: 'updated', payload: { next_status: 'contacted' } })
        }
      }
      if ((result.data || []).length < 500) break
    }
  }
  for (const [column, ids] of [
    ['contact_id', contactIds],
    ['lead_intake_id', leads.map(lead => lead.id)],
  ] as const) {
    for (let start = 0; start < ids.length; start += 100) {
      for (let offset = 0; ; offset += 500) {
        const result = await withTimeout(crmSupabaseAdmin.from('lead_events')
          .select('lead_intake_id,contact_id,event_type,payload').eq('tenant_id', tenantId)
          .in(column, ids.slice(start, start + 100)).order('id').range(offset, offset + 499),
        LEADS_QUERY_TIMEOUT_MS, 'net-new contact history query')
        if (result.error) throw result.error
        events.push(...(result.data || []))
        if ((result.data || []).length < 500) break
      }
    }
  }
  return netNewLeadCounts(leads, events)
}


/**
 * One person may be a student, an instructor and a lead at once, so an existing
 * person is referenced directly instead of cloned into a second contact record.
 */
async function attachPersonIdentity<T extends { id: string; person_id?: string | null; contact?: unknown }>(tenantId: string, rows: T[]): Promise<Array<T & { linked_person_id: string | null; opportunity_origin: 'existing_student' | 'new_lead' | 'unknown' }>> {
  const personIds = [...new Set(rows.map(row => row.person_id).filter((id): id is string => Boolean(id)))]
  const people = new Map<string, { first_name: string | null; last_name: string | null; email: string | null; phone: string | null }>()
  let failed = false
  for (let offset = 0; offset < personIds.length; offset += 100) {
    const result = await supabaseAdmin.from('people').select('id,first_name,last_name,email,phone')
      .eq('tenant_id', tenantId).in('id', personIds.slice(offset, offset + 100))
    if (result.error || !Array.isArray(result.data)) { failed = true; break }
    for (const person of result.data) people.set(person.id, person)
  }
  if (failed) return rows.map(row => ({ ...row, linked_person_id: null, opportunity_origin: 'unknown' as const })) as Array<T & { linked_person_id: string | null; opportunity_origin: 'existing_student' | 'new_lead' | 'unknown' }>
  if (personIds.some(id => !people.has(id))) return rows.map(row => ({ ...row, linked_person_id: null, opportunity_origin: 'unknown' as const })) as Array<T & { linked_person_id: string | null; opportunity_origin: 'existing_student' | 'new_lead' | 'unknown' }>
  return rows.map(row => {
    const person = row.person_id ? people.get(row.person_id) : undefined
    return {
      ...row,
      linked_person_id: row.person_id ?? null,
      opportunity_origin: person ? 'existing_student' as const : 'new_lead' as const,
      contact: person ? {
        id: row.person_id, full_name: `${person.first_name || ''} ${person.last_name || ''}`.trim(), email: person.email, phone: person.phone,
      } : row.contact,
    }
  }) as Array<T & { linked_person_id: string | null; opportunity_origin: 'existing_student' | 'new_lead' | 'unknown' }>
}

function formatLeadRow(row: LeadListRow) {

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    contact_id: row.contact_id,
    person_id: row.person_id ?? null,
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
    const tenantAccess = await authorizeTenantRequest(request, { allowDemo: true })
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error, requestId: requestLog.requestId }, { status: tenantAccess.status })
    const tenantId = tenantAccess.tenantId
    if (url.searchParams.get('count_only') === '1') {
      const newCounts = await getNewLeadCounts(tenantId)
      return NextResponse.json({ count: newCounts.lesson_inquiry + newCounts.service_inquiry, newCounts }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const status = url.searchParams.get('status')
    const category = url.searchParams.get('category')
    const intakeType = url.searchParams.get('intake_type') || 'lesson_inquiry'
    const bandScope = url.searchParams.get('band_scope')
    if (bandScope !== null && (bandScope !== '1' || intakeType !== 'lesson_inquiry' || url.searchParams.has('band_id'))) {
      return NextResponse.json({ error: 'Invalid band opportunity filter.' }, { status: 400 })
    }
    const includeCounts = url.searchParams.get('include_counts') === '1'
    const includeActivity = url.searchParams.get('include_activity') !== '0'
    if (url.searchParams.get('summary_only') === '1') {
      const [counts, newCounts, totals] = await Promise.all([getLeadTabCounts(tenantId, status), getNewLeadCounts(tenantId), getPipelineTotals(tenantId)])
      return NextResponse.json({ counts, newCounts, ...totals }, { headers: { 'Cache-Control': 'private, no-store' } })
    }
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
      const withOrigin = await attachPersonIdentity(tenantId, baseRows)
      const formatted = includeActivity ? await enrichLeadActivity(tenantId, withOrigin) : withOrigin

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
        person_id,
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
    // Only explicitly tagged opportunities are included. Do not infer identity or
    // band interest from a name, student text, or a generic lesson label.
    if (bandScope === '1') query = query.eq('payload->>service_type', 'band')
    if (intakeType === 'winback') query = query.eq('source_form', WINBACK_SOURCE_FORM).neq('status', 'won')
    else if (intakeType === 'enrolled' || intakeType === 'lost') {
      query = query.in('intake_type', [...LESSON_LEAD_TYPES, 'service_inquiry'])
      query = intakeType === 'enrolled' ? query.eq('status', 'won') : query.neq('source_form', WINBACK_SOURCE_FORM).in('status', ['lost', 'ghosted_us', 'ghosted'])
    }
    else if (intakeType) {
      // Band matching includes explicitly tagged service opportunities as well as
      // legacy lesson inquiries; both remain the same canonical lead_intakes rows.
      query = bandScope === '1' ? query.in('intake_type', [...LESSON_LEAD_TYPES, 'service_inquiry'])
        : intakeType === 'lesson_inquiry' ? query.in('intake_type', LESSON_LEAD_TYPES) : query.eq('intake_type', intakeType)
      if (intakeType === 'lesson_inquiry' || intakeType === 'service_inquiry') query = query.neq('source_form', WINBACK_SOURCE_FORM).not('status', 'in', '(won,lost,ghosted_us,ghosted)')
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
    const withOrigin = await attachPersonIdentity(tenantId, baseRows)
    const formatted = includeActivity ? await enrichLeadActivity(tenantId, withOrigin) : withOrigin
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
    const permission = await requireOwner(request, tenantId)
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
      else if (intakeType === 'enrolled') selectedRecordQuery = selectedRecordQuery.in('intake_type', [...LESSON_LEAD_TYPES, 'service_inquiry']).eq('status', 'won')
      else if (intakeType === 'lost') selectedRecordQuery = selectedRecordQuery.in('intake_type', [...LESSON_LEAD_TYPES, 'service_inquiry']).neq('source_form', WINBACK_SOURCE_FORM).in('status', ['lost', 'ghosted_us', 'ghosted'])
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
