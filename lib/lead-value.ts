// Shared opportunity-value helpers for lead pipeline KPI aggregation.
// Server-safe: no React or 'use client' dependencies.

export const DEFAULT_LESSON_BASE_VALUE = 160

export type ServiceTypeOption = {
  value: string
  label: string
  fee: number | null
  keywords: string[]
}

export const SERVICE_TYPE_OPTIONS: ServiceTypeOption[] = [
  { value: 'rehearsal-room', label: 'Rehearsal room', fee: 50, keywords: ['rehearsal'] },
  { value: 'recording-studio', label: 'Recording studio', fee: 240, keywords: ['recording', 'recording session', 'studio session'] },
  { value: 'private-events-parties', label: 'Private events & parties', fee: 350, keywords: ['private event', 'private events', 'birthday', 'party', 'parties', 'event', 'events'] },
  { value: 'pa-rental', label: 'PA rental', fee: 500, keywords: ['pa rental', 'pa system', 'rental', 'sound'] },
  { value: 'instrument-setup', label: 'Instrument setup', fee: 70, keywords: ['instrument setup', 'instrument', 'setup', 'gear'] },
  { value: 'other', label: 'Other', fee: null, keywords: [] },
]

// Statuses that still represent an open (not yet won/lost) opportunity.
export const OPEN_LEAD_STATUSES = ['new', 'contacted', 'booked', 'processing']
export const WON_STATUS = 'won'

function parseCurrency(value: string): number {
  const parsed = Number(value.replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeServiceLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function getServiceTypeByLabel(label: string): ServiceTypeOption | null {
  const normalized = normalizeServiceLabel(label)
  if (!normalized) return null

  const exact = SERVICE_TYPE_OPTIONS.find((option) => normalizeServiceLabel(option.label) === normalized)
  if (exact) return exact

  return SERVICE_TYPE_OPTIONS.find((option) =>
    option.keywords.some((keyword) => normalized.includes(keyword)),
  ) || null
}

function getServiceSessionValue(payload: Record<string, unknown> | null | undefined, serviceLabel?: string | null): number {
  if (payload && typeof payload.session_value === 'number' && Number.isFinite(payload.session_value)) {
    return payload.session_value
  }
  if (payload && typeof payload.session_value === 'string' && payload.session_value.trim()) {
    const parsed = Number(payload.session_value)
    if (Number.isFinite(parsed)) return parsed
  }

  const match = serviceLabel ? getServiceTypeByLabel(serviceLabel) : null
  return match && match.fee != null ? match.fee : 0
}

function getLessonOpportunityValue(payload: Record<string, unknown> | null | undefined): number {
  const baseRaw = payload?.potential_value_base
  const base = typeof baseRaw === 'number'
    ? baseRaw
    : typeof baseRaw === 'string'
      ? parseCurrency(baseRaw)
      : DEFAULT_LESSON_BASE_VALUE
  if (!(base > 0)) return 0

  const siblings = Array.isArray(payload?.siblings) ? payload.siblings : []
  const siblingDiscountEnabled = payload?.discount_offer_applied !== false
  return base + siblings.length * (siblingDiscountEnabled ? base * 0.9 : base)
}

export function getLeadOpportunityValue(input: {
  intakeType: string
  payload: Record<string, unknown> | null | undefined
  serviceLabel?: string | null
}): number {
  if (input.intakeType === 'service_inquiry') {
    return getServiceSessionValue(input.payload, input.serviceLabel)
  }
  if (input.intakeType === 'lesson_inquiry' || input.intakeType === 'tour_request') {
    return getLessonOpportunityValue(input.payload)
  }
  return 0
}
