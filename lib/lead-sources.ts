export const LEAD_SOURCE_OPTIONS = [
  { value: 'website', label: 'Website' },
  { value: 'meta', label: 'Meta (Facebook / Instagram)' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'yelp', label: 'Yelp' },
  { value: 'email', label: 'Email' },
  { value: 'event', label: 'Event' },
  { value: 'foot_traffic', label: 'Walk-in / foot traffic' },
  { value: 'phone_call', label: 'Phone call' },
  { value: 'family', label: 'Referral' },
  { value: 'partner_community', label: 'Partner / community organization' },
  { value: 'other', label: 'Other' },
] as const

export type LeadSource = typeof LEAD_SOURCE_OPTIONS[number]['value']

const LEAD_SOURCES = new Set<LeadSource>(LEAD_SOURCE_OPTIONS.map((option) => option.value))
const WEBSITE_SOURCE_ALIASES = new Set(['landing_page', 'google_business_profile', 'organic_search'])

export function normalizeLeadSourceValue(value: unknown): LeadSource | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (!normalized) return null
  if (WEBSITE_SOURCE_ALIASES.has(normalized)) return 'website'
  return LEAD_SOURCES.has(normalized as LeadSource) ? normalized as LeadSource : null
}

export function formatLeadSource(value: unknown): string {
  const source = normalizeLeadSourceValue(value)
  if (!source) return '—'
  return LEAD_SOURCE_OPTIONS.find((option) => option.value === source)?.label || 'Website'
}