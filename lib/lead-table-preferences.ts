import { normalizeTablePreferences, tablePreferenceKey } from './table-preferences'

export const LEAD_COLUMN_IDS = ['signal', 'status', 'name', 'phone', 'email', 'followUp', 'lastActivity', 'program', 'source', 'created', 'campaign', 'marketingSource', 'medium', 'referrer', 'priority'] as const
export type LeadColumnId = typeof LEAD_COLUMN_IDS[number]
export type LeadTablePreferences = { columns: LeadColumnId[]; density: 'comfortable' | 'compact' }
export const LEAD_TABLE_SCHEMA = {
  columnIds: LEAD_COLUMN_IDS,
  defaultColumns: ['signal', 'status', 'name', 'phone', 'email', 'followUp', 'lastActivity', 'program'],
  requiredColumns: ['name'],
  storagePrefix: 'pulse_lead_table_v1',
} as const

export function defaultLeadTablePreferences(): LeadTablePreferences {
  return normalizeTablePreferences(null, LEAD_TABLE_SCHEMA) as LeadTablePreferences
}

export function normalizeLeadTablePreferences(value: unknown): LeadTablePreferences {
  return normalizeTablePreferences(value, LEAD_TABLE_SCHEMA) as LeadTablePreferences
}

export function leadTablePreferenceKey(tenantId: string, membershipId: string) {
  return tablePreferenceKey(LEAD_TABLE_SCHEMA, tenantId, membershipId)
}