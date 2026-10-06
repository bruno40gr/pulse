import { NextResponse } from 'next/server'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { crmCallbackCaptureEnabled } from '@/lib/crm-callback-mode'
import { normalizeLeadSourceValue, type LeadSource } from '@/lib/lead-sources'

const DEFAULT_TENANT_ID = process.env.CRM_TENANT_ID || '00000000-0000-0000-0000-000000000001'

function buildCorsHeaders(request: Request) {
  const origin = request.headers.get('origin') || '*'

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function jsonWithCors(request: Request, body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...buildCorsHeaders(request),
      ...(init?.headers || {}),
    },
  })
}

type IntakeBody = {
  tenant_id?: string
  intake_type?: string
  source?: string
  source_system?: string
  source_form?: string
  source_page?: string | null
  full_name?: string
  email?: string | null
  phone?: string | null
  program_label?: string | null
  service_label?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  referrer?: string | null
  payload?: Record<string, unknown>
}

function splitName(fullName: string) {
  const trimmed = fullName.trim()
  if (!trimmed) return { first_name: null, last_name: null }

  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: null }
  }

  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' '),
  }
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeLeadSource(value: unknown, sourceForm: string | null): LeadSource {
  const normalized = normalizeLeadSourceValue(value)
  if (normalized) return normalized

  if (sourceForm === 'manual-phone-call') return 'phone_call'
  if (sourceForm === 'manual-walk-in') return 'foot_traffic'
  if (sourceForm === 'manual-referral') return 'family'
  if (sourceForm?.includes('event') || sourceForm?.includes('hot_chili')) return 'event'
  return 'website'
}

async function createInquiryContact({ tenantId, fullName, email, phone }: { tenantId: string, fullName: string, email: string | null, phone: string | null }) {
  const { first_name, last_name } = splitName(fullName)

  // A submission is not proof of identity. Even matching names/emails/phones can
  // belong to different family members. Linking contacts requires explicit review.

  const { data, error } = await crmSupabaseAdmin
    .from('crm_contacts')
    .insert({
      tenant_id: tenantId,
      first_name,
      last_name,
      full_name: fullName,
      email,
      phone,
      contact_kind: 'lead',
      lifecycle_stage: 'new',
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function POST(request: Request) {
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return jsonWithCors(request, { error: 'An intake object is required' }, { status: 400 })
    }
    const body = parsed as IntakeBody

    const tenantId = body.tenant_id || DEFAULT_TENANT_ID
    const intakeType = normalizeText(body.intake_type)
    const sourceForm = normalizeText(body.source_form)
    const fullName = normalizeText(body.full_name)
    const email = normalizeText(body.email)?.toLowerCase() || null
    const phone = normalizeText(body.phone)
    const sourceSystem = normalizeText(body.source_system) || 'headliner-website'
    const sourcePage = normalizeText(body.source_page)
    const source = normalizeLeadSource(body.source, sourceForm)
    const programLabel = normalizeText(body.program_label)
    const serviceLabel = normalizeText(body.service_label)
    const utmSource = normalizeText(body.utm_source)
    const utmMedium = normalizeText(body.utm_medium)
    const utmCampaign = normalizeText(body.utm_campaign)
    const referrer = normalizeText(body.referrer)
    const payload: Record<string, unknown> = {
      ...(body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload) ? body.payload : {}),
      source,
    }

    if (!intakeType) return jsonWithCors(request, { error: 'intake_type is required' }, { status: 400 })
    if (!sourceForm) return jsonWithCors(request, { error: 'source_form is required' }, { status: 400 })
    if (!fullName) return jsonWithCors(request, { error: 'full_name is required' }, { status: 400 })
    if (!email && !phone) return jsonWithCors(request, { error: 'email or phone is required' }, { status: 400 })

    if (crmCallbackCaptureEnabled()) {
      // Public website capture is pinned to the configured school, not a client choice.
      if (tenantId !== DEFAULT_TENANT_ID) {
        return jsonWithCors(request, { error: 'Invalid intake account.' }, { status: 403 })
      }
      const suppliedKey = request.headers.get('idempotency-key')
      if (suppliedKey !== null && !/^[A-Za-z0-9_-]{1,160}$/.test(suppliedKey)) {
        return jsonWithCors(request, { error: 'Invalid submission key.' }, { status: 400 })
      }
      // Older clients have no key: capture each request, never deduplicate by PII.
      const deliveryKey = suppliedKey || crypto.randomUUID()
      if (intakeType === 'job_application') {
        payload.positions = Array.isArray(payload.positions) ? payload.positions.filter(item => typeof item === 'string') : []
        payload.availability = Array.isArray(payload.availability) ? payload.availability.filter(item => typeof item === 'string') : []
      }
      const { data: queueId, error } = await supabaseAdmin.rpc('odeon_crm_capture', {
        p_tenant_id: DEFAULT_TENANT_ID,
        p_kind: 'intake',
        p_delivery_key: deliveryKey,
        p_payload: {
          intake_type: intakeType, source_form: sourceForm, full_name: fullName,
          email, phone, source_system: sourceSystem, source_page: sourcePage,
          program_label: programLabel, service_label: serviceLabel,
          utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign,
          referrer, payload,
        },
      })
      if (error || typeof queueId !== 'string') {
        return jsonWithCors(request, { error: 'Could not preserve inquiry. Please try again.' }, { status: 503 })
      }
      // Accepted means durably queued, not already visible in the Leads screen.
      return jsonWithCors(request, { success: true, queued: true, receipt_id: queueId }, { status: 202 })
    }

    const contactId = await createInquiryContact({ tenantId, fullName, email, phone })

    if (intakeType === 'job_application') {
      const positions = Array.isArray(payload.positions) ? payload.positions.filter((item): item is string => typeof item === 'string') : []
      const availability = Array.isArray(payload.availability) ? payload.availability.filter((item): item is string => typeof item === 'string') : []

      const { data: application, error: applicationError } = await crmSupabaseAdmin
        .from('job_applications')
        .insert({
          tenant_id: tenantId,
          contact_id: contactId,
          full_name: fullName,
          email: email || '',
          phone,
          positions,
          experience: normalizeText(payload.experience) || '',
          sight_reading: normalizeText(payload.sight_reading) || '',
          availability,
          resume_link: normalizeText(payload.resume_link),
          message: normalizeText(payload.message) || '',
          payload,
        })
        .select('id, status, priority')
        .single()

      if (applicationError) throw applicationError

      return jsonWithCors(request, {
        success: true,
        contact_id: contactId,
        job_application_id: application.id,
        status: application.status,
        priority: application.priority,
      })
    }

    const { data: lead, error: leadError } = await crmSupabaseAdmin
      .from('lead_intakes')
      .insert({
        tenant_id: tenantId,
        contact_id: contactId,
        intake_type: intakeType,
        source_system: sourceSystem,
        source_form: sourceForm,
        source_page: sourcePage,
        program_label: programLabel,
        service_label: serviceLabel,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        referrer,
        payload,
      })
      .select('id, category, status, priority, temperature')
      .single()

    if (leadError) throw leadError

    return jsonWithCors(request, {
      success: true,
      contact_id: contactId,
      lead_intake_id: lead.id,
      category: lead.category,
      status: lead.status,
      priority: lead.priority,
      temperature: lead.temperature,
    })
  } catch {
    console.error('[intake] processing failed')
    return jsonWithCors(request, { error: 'Could not process inquiry.' }, { status: 503 })
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request),
  })
}
