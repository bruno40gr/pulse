import { normalizeTablePreferences, tablePreferenceKey } from './table-preferences'

export const STAFF_COLUMN_IDS = ['name', 'contact', 'status'] as const
export type StaffColumnId = typeof STAFF_COLUMN_IDS[number]
export type StaffSortKey = 'name' | 'contact' | 'status'

export const STAFF_TABLE_SCHEMA = {
  columnIds: STAFF_COLUMN_IDS,
  defaultColumns: ['name', 'contact', 'status'],
  requiredColumns: ['name'],
  storagePrefix: 'pulse_staff_table_v1',
  sortKeys: ['name', 'contact', 'status'],
  defaultSort: { key: 'name', direction: 'asc' },
} as const

export function defaultStaffTablePreferences() {
  return normalizeTablePreferences(null, STAFF_TABLE_SCHEMA)
}

export function staffTablePreferenceKey(tenantId: string, membershipId: string) {
  return tablePreferenceKey(STAFF_TABLE_SCHEMA, tenantId, membershipId)
}
