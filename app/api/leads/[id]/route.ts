import { NextResponse } from 'next/server'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { createRequestLogContext, getDurationMs, withTimeout } from '@/lib/request-runtime'
import { getRequestActor } from '@/lib/access'
import { resolveRequestTenant } from '@/lib/tenant-access'

const DEFAULT_TENANT_ID = process.env.CRM_TENANT_ID || '00000000-0000-0000-0000-000000000001'
const LEAD_DETAIL_TIMEOUT_MS = 8000
const LEAD_EVENTS_LIMIT = 100
const PIPELINE_STATUSES = ['new', 'contacted', 'booked', 'processing', 'won']
const LOST_REASONS = ['ghosted', 'not_interested', 'price', 'competitor', 'scheduling_conflict', 'teacher_match', 'disenrolled']

type LeadEvent = {
  id: string
  event_type: string
  event_label: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

type LeadContact = {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  email: string | null
  phone: string | null
  notes: string | null
  tags?: string[] | null
  lifecycle_stage?: string | null
  created_at?: string
  updated_at?: string
}

type LeadRecord = {
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
  payload: Record<string, unknown>
  created_at: string
  updated_at: string
  crm_contacts: LeadContact | LeadContact[] | null
}

type JobApplicationRecord = {
  id: string
  tenant_id: string
  contact_id: string
  status: string
  priority: string
  positions: string[] | null
  experience: string | null
  sight_reading: string | null
  availability: string[] | null
  resume_link: string | null
  message: string | null
  payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
  crm_contacts: LeadContact | LeadContact[] | null
}

function unwrapContact(contact: LeadContact | LeadContact[] | null) {
  return Array.isArray(contact) ? (contact[0] ?? null) : contact
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error'
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return {
    first_name: parts[0] || null,
    last_name: parts.length > 1 ? parts.slice(1).join(' ') : null,
  }
}

function getEventActorName(payload: Record<string, unknown> | null) {
  const actor = payload?.actor
  return actor && typeof actor === 'object' && typeof (actor as Record<string, unknown>).displayName === 'string'
    ? (actor as Record<string, string>).displayName
    : null
}

function normalizeNotesHistory(events: LeadEvent[]) {
  return (events || [])
    .filter((event) => event.event_type === 'note_added')
    .map((event) => ({
      text: typeof event.payload?.text === 'string' ? event.payload.text : '',
      timestamp: event.created_at,
      actor_name: getEventActorName(event.payload),
    }))
}

function getFollowUpFromPayload(payload: Record<string, unknown> | null, key: 'follow_up_at' | 'follow_up_note') {
  const value = payload?.[key]
  return typeof value === 'string' ? value : null
}

async function getJobApplicationDetail(tenantId: string, id: string) {
  const result = await withTimeout<any>(
    crmSupabaseAdmin
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
          first_name,
          last_name,
          full_name,
          email,
          phone,
          notes,
          tags,
          lifecycle_stage,
          created_at,
          updated_at
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle(),
    LEAD_DETAIL_TIMEOUT_MS,
    'job application detail query',
  )

  const { data: application, error } = result as { data: JobApplicationRecord | null, error: { message: string } | null }

  if (error) throw error
  if (!application) return null

  return {
    id: application.id,
    tenant_id: application.tenant_id,
    contact_id: application.contact_id,
    intake_type: 'job_application',
    source_system: 'headliner-website',
    source_form: 'careers-teacher-form',
    source_page: '/careers',
    program_label: Array.isArray(application.positions) ? application.positions.join(', ') : null,
    service_label: null,
    category: 'teachers',
    status: application.status,
    priority: application.priority,
    temperature: 'warm',
    payload: application.payload && Object.keys(application.payload).length > 0
      ? application.payload
      : {
          positions: application.positions || [],
          experience: application.experience || '',
          sight_reading: application.sight_reading || '',
          availability: application.availability || [],
          resume_link: application.resume_link,
          message: application.message || '',
        },
    created_at: application.created_at,
    updated_at: application.updated_at,
    contact: unwrapContact(application.crm_contacts),
    events: [],
    notes_history: [],
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestLog = createRequestLogContext()

  try {
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error, requestId: requestLog.requestId }, { status: tenantAccess.status })
    const tenantId = tenantAccess.tenantId
    const requestedIntakeType = new URL(request.url).searchParams.get('intake_type')
    const { id } = await params

    const existingJobApplication = requestedIntakeType === 'job_application' || !requestedIntakeType
      ? await getJobApplicationDetail(tenantId, id)
      : null
    if (existingJobApplication) {
      console.info('[leads][detail]', {
        requestId: requestLog.requestId,
        tenantId,
        leadId: id,
        intakeType: 'job_application',
        durationMs: getDurationMs(requestLog.startedAt),
      })

      return NextResponse.json(existingJobApplication)
    }

    const leadResultPromise = withTimeout<any>(
      crmSupabaseAdmin
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
            first_name,
            last_name,
            full_name,
            email,
            phone,
            notes,
            tags,
            lifecycle_stage,
            created_at,
            updated_at
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .single(),
      LEAD_DETAIL_TIMEOUT_MS,
      'lead detail query',
    )

    const eventsResultPromise = withTimeout<any>(
      crmSupabaseAdmin
        .from('lead_events')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('lead_intake_id', id)
        .order('created_at', { ascending: false })
        .limit(LEAD_EVENTS_LIMIT),
      LEAD_DETAIL_TIMEOUT_MS,
      'lead events query',
    )

    const [leadResult, eventsResult] = await Promise.all([leadResultPromise, eventsResultPromise])
    const { data: lead, error: leadError } = leadResult as { data: LeadRecord, error: { message: string } | null }
    if (leadError) throw leadError

    const { data: events, error: eventsError } = eventsResult as { data: LeadEvent[] | null, error: { message: string } | null }
    if (eventsError) throw eventsError

    const notes_history = normalizeNotesHistory(events || [])

    console.info('[leads][detail]', {
      requestId: requestLog.requestId,
      tenantId,
      leadId: id,
      intakeType: lead.intake_type,
      eventCount: events?.length ?? 0,
      durationMs: getDurationMs(requestLog.startedAt),
    })

    return NextResponse.json({
      ...lead,
      follow_up_at: getFollowUpFromPayload(lead.payload, 'follow_up_at'),
      follow_up_note: getFollowUpFromPayload(lead.payload, 'follow_up_note'),
      contact: unwrapContact(lead.crm_contacts),
      events: events || [],
      notes_history,
    })
  } catch (error) {
    console.error('[leads][detail] Error fetching lead detail', {
      requestId: requestLog.requestId,
      durationMs: getDurationMs(requestLog.startedAt),
      error: getErrorMessage(error),
    })

    return NextResponse.json({ error: getErrorMessage(error), requestId: requestLog.requestId }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestLog = createRequestLogContext()

  try {
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error, requestId: requestLog.requestId }, { status: tenantAccess.status })
    const tenantId = tenantAccess.tenantId
    const { id } = await params
    const body = await request.json()
    const actor = await getRequestActor(request)
    if (!actor) return NextResponse.json({ error: 'Pulse access required.' }, { status: 401 })
    const actorPayload = {
      instructorId: actor.instructorId,
      personId: actor.personId,
      displayName: actor.displayName,
    }

    const existingJobApplication = await getJobApplicationDetail(tenantId, id)
    if (existingJobApplication) {
      const jobUpdates: Record<string, unknown> = {}
      const contactUpdates: Record<string, unknown> = {}

      if (typeof body.status === 'string' && body.status.trim()) jobUpdates.status = body.status.trim()
      if (typeof body.priority === 'string' && body.priority.trim()) jobUpdates.priority = body.priority.trim()
      if (typeof body.notes === 'string') contactUpdates.notes = body.notes

      if (Object.keys(jobUpdates).length > 0) {
        const result = await withTimeout<any>(
          crmSupabaseAdmin
            .from('job_applications')
            .update(jobUpdates)
            .eq('tenant_id', tenantId)
            .eq('id', id),
          LEAD_DETAIL_TIMEOUT_MS,
          'job application update',
        )

        if (result.error) throw result.error
      }

      if (Object.keys(contactUpdates).length > 0 && existingJobApplication.contact_id) {
        const result = await withTimeout<any>(
          crmSupabaseAdmin
            .from('crm_contacts')
            .update(contactUpdates)
            .eq('tenant_id', tenantId)
            .eq('id', existingJobApplication.contact_id),
          LEAD_DETAIL_TIMEOUT_MS,
          'job application contact update',
        )

        if (result.error) throw result.error
      }

      const refreshedJobApplication = await getJobApplicationDetail(tenantId, id)
      if (!refreshedJobApplication) {
        return NextResponse.json({ error: 'Teacher application not found' }, { status: 404 })
      }

      console.info('[leads][update]', {
        requestId: requestLog.requestId,
        tenantId,
        leadId: id,
        intakeType: 'job_application',
        durationMs: getDurationMs(requestLog.startedAt),
      })

      return NextResponse.json(refreshedJobApplication)
    }

    const leadUpdates: Record<string, unknown> = {}
    const contactUpdates: Record<string, unknown> = {}

    const requestedStatus = typeof body.status === 'string' ? body.status.trim() : ''
    const requestedLostReason = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>).lost_reason
      : null

    if (requestedStatus) leadUpdates.status = requestedStatus
    if (typeof body.priority === 'string' && body.priority.trim()) leadUpdates.priority = body.priority.trim()
    if (typeof body.category === 'string' && body.category.trim()) leadUpdates.category = body.category.trim()
    if (typeof body.program_label === 'string') leadUpdates.program_label = body.program_label.trim() || null
    if (typeof body.service_label === 'string') leadUpdates.service_label = body.service_label.trim() || null
    if (typeof body.source_form === 'string') leadUpdates.source_form = body.source_form.trim() || 'manual-other'
    if (typeof body.source_page === 'string') leadUpdates.source_page = body.source_page.trim() || null
    if (typeof body.utm_campaign === 'string') leadUpdates.utm_campaign = body.utm_campaign.trim() || null
    if (typeof body.referrer === 'string') leadUpdates.referrer = body.referrer.trim() || null
    if (typeof body.notes === 'string') contactUpdates.notes = body.notes

    if (typeof body.full_name === 'string' && body.full_name.trim()) {
      const full_name = body.full_name.trim()
      Object.assign(contactUpdates, { full_name, ...splitName(full_name) })
    }
    if (typeof body.email === 'string') contactUpdates.email = body.email.trim().toLowerCase() || null
    if (typeof body.phone === 'string') contactUpdates.phone = body.phone.trim() || null

    if (body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)) {
      const existingPayloadResult = await withTimeout<any>(
        crmSupabaseAdmin
          .from('lead_intakes')
          .select('payload')
          .eq('tenant_id', tenantId)
          .eq('id', id)
          .single(),
        LEAD_DETAIL_TIMEOUT_MS,
        'existing lead payload query',
      )

      if (existingPayloadResult.error) throw existingPayloadResult.error

      const currentPayload = existingPayloadResult.data?.payload && typeof existingPayloadResult.data.payload === 'object'
        ? existingPayloadResult.data.payload
        : {}

      leadUpdates.payload = {
        ...currentPayload,
        ...body.payload,
      }
    }

    const addNote = typeof body.add_note === 'string' ? body.add_note.trim() : ''

    const followUpChanged = Boolean(
      body.payload &&
      typeof body.payload === 'object' &&
      !Array.isArray(body.payload) &&
      'follow_up_at' in (body.payload as Record<string, unknown>),
    )

    const existingLeadResult = await withTimeout<any>(
      crmSupabaseAdmin
        .from('lead_intakes')
          .select('id, contact_id, intake_type, status, priority, category, source_form')
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .single(),
      LEAD_DETAIL_TIMEOUT_MS,
      'existing lead query',
    )

    const { data: existingLead, error: existingLeadError } = existingLeadResult as {
      data: { id: string, contact_id: string, intake_type: string, status: string, priority: string, category: string, source_form: string },
      error: { message: string } | null,
    }

    if (existingLeadError) throw existingLeadError

    if (requestedStatus) {
      const isPipelineLead = existingLead.intake_type === 'lesson_inquiry' || existingLead.intake_type === 'service_inquiry'
      if (isPipelineLead) {
        if (requestedStatus === 'lost') {
          if (typeof requestedLostReason !== 'string' || !LOST_REASONS.includes(requestedLostReason)) {
            return NextResponse.json({ error: 'A valid lost reason is required.' }, { status: 400 })
          }
        } else if (existingLead.category !== 'winback' && existingLead.source_form !== '2026-disenrollment-import') {
          const currentIndex = PIPELINE_STATUSES.indexOf(existingLead.status)
          const nextIndex = PIPELINE_STATUSES.indexOf(requestedStatus)
          if (currentIndex === -1 || nextIndex === -1 || nextIndex <= currentIndex) {
            return NextResponse.json({ error: 'Leads can only move forward through the pipeline.' }, { status: 400 })
          }
        }
      }
    }

    if (Object.keys(leadUpdates).length > 0) {
      const result = await withTimeout<any>(
        crmSupabaseAdmin
          .from('lead_intakes')
          .update(leadUpdates)
          .eq('tenant_id', tenantId)
          .eq('id', id),
        LEAD_DETAIL_TIMEOUT_MS,
        'lead update',
      )

      if (result.error) throw result.error
    }

    if (requestedStatus === 'lost') {
      const result = await withTimeout<any>(
        crmSupabaseAdmin
          .from('lead_events')
          .insert({
            tenant_id: tenantId,
            lead_intake_id: id,
            contact_id: existingLead.contact_id,
            event_type: 'lead_lost',
            event_label: 'Lead marked lost',
            payload: { lost_reason: requestedLostReason, actor: actorPayload },
          }),
        LEAD_DETAIL_TIMEOUT_MS,
        'lead lost event insert',
      )
      if (result.error) throw result.error
    }

    if (Object.keys(contactUpdates).length > 0) {
      const result = await withTimeout<any>(
        crmSupabaseAdmin
          .from('crm_contacts')
          .update(contactUpdates)
          .eq('tenant_id', tenantId)
          .eq('id', existingLead.contact_id),
        LEAD_DETAIL_TIMEOUT_MS,
        'lead contact update',
      )

      if (result.error) throw result.error
    }

    if (addNote) {
      const result = await withTimeout<any>(
        crmSupabaseAdmin
          .from('lead_events')
          .insert({
            tenant_id: tenantId,
            lead_intake_id: id,
            contact_id: existingLead.contact_id,
            event_type: 'note_added',
            event_label: 'Note added',
            payload: { text: addNote, actor: actorPayload },
          }),
        LEAD_DETAIL_TIMEOUT_MS,
        'lead note insert',
      )

      if (result.error) throw result.error
    }

    if (followUpChanged) {
      const followUpPayload = body.payload as Record<string, unknown>
      const followUpAt = typeof followUpPayload.follow_up_at === 'string' ? followUpPayload.follow_up_at : null
      const followUpNote = typeof followUpPayload.follow_up_note === 'string' ? followUpPayload.follow_up_note : null

      const result = await withTimeout<any>(
        crmSupabaseAdmin
          .from('lead_events')
          .insert({
            tenant_id: tenantId,
            lead_intake_id: id,
            contact_id: existingLead.contact_id,
            event_type: followUpAt ? 'follow_up_scheduled' : 'follow_up_cleared',
            event_label: followUpAt ? 'Follow-up scheduled' : 'Follow-up cleared',
            payload: { follow_up_at: followUpAt, follow_up_note: followUpNote, actor: actorPayload },
          }),
        LEAD_DETAIL_TIMEOUT_MS,
        'lead follow-up event insert',
      )

      if (result.error) throw result.error
    }

    if (Object.keys(leadUpdates).length > 0) {
      const result = await withTimeout<any>(
        crmSupabaseAdmin
          .from('lead_events')
          .insert({
            tenant_id: tenantId,
            lead_intake_id: id,
            contact_id: existingLead.contact_id,
            event_type: 'updated',
            event_label: 'Lead updated',
            payload: { updates: leadUpdates, actor: actorPayload },
          }),
        LEAD_DETAIL_TIMEOUT_MS,
        'lead update event insert',
      )

      if (result.error) throw result.error
    }

    if (Object.keys(contactUpdates).length > 0) {
      const result = await withTimeout<any>(
        crmSupabaseAdmin
          .from('lead_events')
          .insert({
            tenant_id: tenantId,
            lead_intake_id: id,
            contact_id: existingLead.contact_id,
            event_type: 'contact_updated',
            event_label: 'Contact updated',
            payload: { updates: contactUpdates, actor: actorPayload },
          }),
        LEAD_DETAIL_TIMEOUT_MS,
        'lead contact update event insert',
      )

      if (result.error) throw result.error
    }

    const refreshedLeadResult = await withTimeout<any>(
      crmSupabaseAdmin
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
            first_name,
            last_name,
            full_name,
            email,
            phone,
            notes,
            tags,
            lifecycle_stage,
            created_at,
            updated_at
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .single(),
      LEAD_DETAIL_TIMEOUT_MS,
      'refreshed lead query',
    )

    const { data: refreshedLead, error: refreshedLeadError } = refreshedLeadResult as { data: LeadRecord, error: { message: string } | null }
    if (refreshedLeadError) throw refreshedLeadError

    const refreshedEventsResult = await withTimeout<any>(
      crmSupabaseAdmin
        .from('lead_events')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('lead_intake_id', id)
        .order('created_at', { ascending: false })
        .limit(LEAD_EVENTS_LIMIT),
      LEAD_DETAIL_TIMEOUT_MS,
      'refreshed lead events query',
    )

    const { data: refreshedEvents, error: refreshedEventsError } = refreshedEventsResult as { data: LeadEvent[] | null, error: { message: string } | null }
    if (refreshedEventsError) throw refreshedEventsError

    const notes_history = normalizeNotesHistory(refreshedEvents || [])

    console.info('[leads][update]', {
      requestId: requestLog.requestId,
      tenantId,
      leadId: id,
      intakeType: refreshedLead.intake_type,
      eventCount: refreshedEvents?.length ?? 0,
      durationMs: getDurationMs(requestLog.startedAt),
    })

    return NextResponse.json({
      ...refreshedLead,
      follow_up_at: getFollowUpFromPayload(refreshedLead.payload, 'follow_up_at'),
      follow_up_note: getFollowUpFromPayload(refreshedLead.payload, 'follow_up_note'),
      contact: unwrapContact(refreshedLead.crm_contacts),
      events: refreshedEvents || [],
      notes_history,
    })
  } catch (error) {
    console.error('[leads][update] Error updating lead', {
      requestId: requestLog.requestId,
      durationMs: getDurationMs(requestLog.startedAt),
      error: getErrorMessage(error),
    })

    return NextResponse.json({ error: getErrorMessage(error), requestId: requestLog.requestId }, { status: 500 })
  }
}