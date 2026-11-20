import { normalizeTablePreferences, tablePreferenceKey } from './table-preferences'

export const FUNDING_COLUMN_IDS = ['student', 'organization', 'status', 'nextStep', 'dueDate', 'outstanding'] as const
export type FundingColumnId = typeof FUNDING_COLUMN_IDS[number]

export const FUNDING_TABLE_SCHEMA = {
  columnIds: FUNDING_COLUMN_IDS,
  defaultColumns: ['student', 'organization', 'status', 'nextStep', 'dueDate', 'outstanding'],
  requiredColumns: ['student'],
  storagePrefix: 'pulse_funding_table_v1',
  sortKeys: ['student', 'organization', 'status', 'dueDate', 'outstanding', 'updatedAt'],
  defaultSort: { key: 'dueDate', direction: 'asc' },
} as const

export function defaultFundingTablePreferences() {
  return normalizeTablePreferences(null, FUNDING_TABLE_SCHEMA)
}

export function fundingTablePreferenceKey(tenantId: string, membershipId: string) {
  return tablePreferenceKey(FUNDING_TABLE_SCHEMA, tenantId, membershipId)
}
