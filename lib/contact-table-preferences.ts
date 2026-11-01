export const CONTACT_TABLE_SCHEMA = {
  columnIds: ['status', 'name', 'phone', 'email', 'funded', 'instructor'],
  defaultColumns: ['status', 'name', 'phone', 'email', 'funded', 'instructor'],
  requiredColumns: ['name'],
  storagePrefix: 'pulse_contacts_table_v1',
} as const