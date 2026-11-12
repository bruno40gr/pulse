import { normalizeTablePreferences, tablePreferenceKey } from './table-preferences'

export const LEAD_COLUMN_IDS = ['signal', 'status', 'name', 'phone', 'email', 'followUp', 'followUpNote', 'lastActivity', 'program', 'source', 'created', 'campaign', 'marketingSource', 'medium', 'referrer', 'priority'] as const
export type LeadColumnId = typeof LEAD_COLUMN_IDS[number]
export type LeadTablePreferences = import('./table-preferences').TablePreferences & { columns: LeadColumnId[] }
export const LEAD_TABLE_SCHEMA = {
  columnIds: LEAD_COLUMN_IDS,
  defaultColumns: ['signal', 'status', 'name', 'phone', 'email', 'followUp', 'followUpNote', 'lastActivity', 'program'],
  requiredColumns: ['name'],
  storagePrefix: 'pulse_lead_table_v1',
  sortKeys: ['status', 'name', 'followUp', 'program', 'created', 'lastActivity'],
  defaultSort: { key: 'created', direction: 'desc' },
  pageSizes: [25, 50, 100, 250],
  defaultPageSize: 50,
  version: 2,
  columnMigrations: { followUp: 'followUpNote' },
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