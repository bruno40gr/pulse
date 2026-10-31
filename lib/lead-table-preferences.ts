export const LEAD_COLUMN_IDS = ['signal', 'status', 'name', 'phone', 'email', 'followUp', 'lastActivity', 'program', 'source', 'created', 'campaign', 'marketingSource', 'medium', 'referrer', 'priority'] as const
export type LeadColumnId = typeof LEAD_COLUMN_IDS[number]
export type LeadTablePreferences = { columns: LeadColumnId[]; density: 'comfortable' | 'compact' }

export function defaultLeadTablePreferences(): LeadTablePreferences {
  return { columns: ['signal', 'status', 'name', 'phone', 'email', 'followUp', 'lastActivity', 'program'], density: 'comfortable' }
}

export function normalizeLeadTablePreferences(value: unknown): LeadTablePreferences {
  if (!value || typeof value !== 'object') return defaultLeadTablePreferences()
  const input = value as Record<string, unknown>
  const storedColumns = input.columns
  const columns = Array.isArray(storedColumns)
    ? LEAD_COLUMN_IDS.filter(id => id === 'name' || storedColumns.includes(id))
    : defaultLeadTablePreferences().columns
  return { columns, density: input.density === 'compact' ? 'compact' : 'comfortable' }
}

export function leadTablePreferenceKey(tenantId: string, membershipId: string) {
  return `pulse_lead_table_v1:${encodeURIComponent(tenantId)}:${encodeURIComponent(membershipId)}`
}