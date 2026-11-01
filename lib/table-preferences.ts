export type TablePreferences = { columns: string[]; density: 'comfortable' | 'compact' }
export type TablePreferenceSchema = {
  columnIds: readonly string[]
  defaultColumns: readonly string[]
  requiredColumns: readonly string[]
  storagePrefix: string
}

export function normalizeTablePreferences(value: unknown, schema: TablePreferenceSchema): TablePreferences {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const stored = input.columns
  return {
    columns: Array.isArray(stored)
      ? schema.columnIds.filter(id => schema.requiredColumns.includes(id) || stored.includes(id))
      : [...schema.defaultColumns],
    density: input.density === 'compact' ? 'compact' : 'comfortable',
  }
}

export function tablePreferenceKey(schema: TablePreferenceSchema, tenantId: string, membershipId: string) {
  return `${schema.storagePrefix}:${encodeURIComponent(tenantId)}:${encodeURIComponent(membershipId)}`
}