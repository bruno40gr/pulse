export const CONTACT_SORT_KEYS = ['name', 'status', 'accountManager', 'contact', 'instructor'] as const
export type ContactSortKey = typeof CONTACT_SORT_KEYS[number]

export const CONTACT_TABLE_SCHEMA = {
  columnIds: ['status', 'name', 'phone', 'email', 'funded', 'instructor'],
  defaultColumns: ['status', 'name', 'phone', 'email', 'funded', 'instructor'],
  requiredColumns: ['name'],
  storagePrefix: 'pulse_contacts_table_v1',
  sortKeys: CONTACT_SORT_KEYS,
  defaultSort: { key: 'name', direction: 'asc' },
  pageSizes: [25, 50, 100, 250],
  defaultPageSize: 50,
} as const
