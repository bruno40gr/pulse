export const CONTACT_SORT_KEYS = ['name', 'accountManager', 'contact', 'instructor', 'followUp', 'followUpNote'] as const
export type ContactSortKey = typeof CONTACT_SORT_KEYS[number]

export const CONTACT_TABLE_SCHEMA = {
  columnIds: ['name', 'phone', 'email', 'funded', 'instructor', 'followUp', 'followUpNote', 'students'],
  defaultColumns: ['name', 'phone', 'email', 'funded', 'instructor', 'followUp', 'followUpNote'],
  version: 3,
  addedDefaultColumns: ['followUp', 'followUpNote'],
  columnMigrations: { followUp: 'followUpNote' },
  requiredColumns: ['name'],
  storagePrefix: 'pulse_contacts_table_v1',
  sortKeys: CONTACT_SORT_KEYS,
  defaultSort: { key: 'name', direction: 'asc' },
  pageSizes: [25, 50, 100, 250],
  defaultPageSize: 50,
} as const
