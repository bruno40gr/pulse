import { NextResponse } from 'next/server'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'

const DEFAULT_TENANT_ID = process.env.CRM_TENANT_ID || '00000000-0000-0000-0000-000000000001'

function buildCorsHeaders(request: Request) {
  const origin = request.headers.get('origin') || '*'

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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

async function findOrCreateContact({ tenantId, fullName, email, phone }: { tenantId: string, fullName: string, email: string | null, phone: string | null }) {
  const { first_name, last_name } = splitName(fullName)

  let existingContact: { id: string } | null = null

  if (email) {
    const { data, error } = await crmSupabaseAdmin
      .from('crm_contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .maybeSingle()

    if (error) throw error
    existingContact = data
  }

  if (!existingContact && phone) {
    const { data, error } = await crmSupabaseAdmin
      .from('crm_contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .maybeSingle()

    if (error) throw error
    existingContact = data
  }

  if (existingContact?.id) {
    const { error } = await crmSupabaseAdmin
      .from('crm_contacts')
      .update({
        first_name,
        last_name,
        full_name: fullName,
        email,
        phone,
      })
      .eq('id', existingContact.id)

    if (error) throw error
    return existingContact.id
  }

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
    const body = (await request.json()) as IntakeBody

    const tenantId = body.tenant_id || DEFAULT_TENANT_ID
    const intakeType = normalizeText(body.intake_type)
    const sourceForm = normalizeText(body.source_form)
    const fullName = normalizeText(body.full_name)
    const email = normalizeText(body.email)?.toLowerCase() || null
    const phone = normalizeText(body.phone)
    const sourceSystem = normalizeText(body.source_system) || 'headliner-website'
    const sourcePage = normalizeText(body.source_page)
    const programLabel = normalizeText(body.program_label)
    const serviceLabel = normalizeText(body.service_label)
    const utmSource = normalizeText(body.utm_source)
    const utmMedium = normalizeText(body.utm_medium)
    const utmCampaign = normalizeText(body.utm_campaign)
    const referrer = normalizeText(body.referrer)
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {}

    if (!intakeType) return jsonWithCors(request, { error: 'intake_type is required' }, { status: 400 })
    if (!sourceForm) return jsonWithCors(request, { error: 'source_form is required' }, { status: 400 })
    if (!fullName) return jsonWithCors(request, { error: 'full_name is required' }, { status: 400 })
    if (!email && !phone) return jsonWithCors(request, { error: 'email or phone is required' }, { status: 400 })

    const contactId = await findOrCreateContact({ tenantId, fullName, email, phone })

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
  } catch (error) {
    console.error('Error creating intake:', error)
    return jsonWithCors(request, { error: (error as Error).message }, { status: 500 })
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request),
  })
}
