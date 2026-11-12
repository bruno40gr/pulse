export type TablePreferences = {
  columns: string[]
  density: 'comfortable' | 'compact'
  sort?: { key: string; direction: 'asc' | 'desc' }
  pageSize?: number
  version?: number
}
export type TablePreferenceSchema = {
  columnIds: readonly string[]
  defaultColumns: readonly string[]
  requiredColumns: readonly string[]
  storagePrefix: string
  sortKeys?: readonly string[]
  defaultSort?: { readonly key: string; readonly direction: 'asc' | 'desc' }
  pageSizes?: readonly number[]
  defaultPageSize?: number
  version?: number
  columnMigrations?: Readonly<Record<string, string>>
}

export function normalizeTablePreferences(value: unknown, schema: TablePreferenceSchema): TablePreferences {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const stored = input.columns
  const migratedColumns = Array.isArray(stored) ? [...stored] : null
  if (migratedColumns && schema.version && input.version !== schema.version) {
    for (const [existing, added] of Object.entries(schema.columnMigrations || {})) {
      if (migratedColumns.includes(existing) && !migratedColumns.includes(added)) migratedColumns.push(added)
    }
  }
  const sort = input.sort && typeof input.sort === 'object' ? input.sort as Record<string, unknown> : null
  const validSort = sort && typeof sort.key === 'string' && schema.sortKeys?.includes(sort.key) &&
    (sort.direction === 'asc' || sort.direction === 'desc')
  const validPageSize = typeof input.pageSize === 'number' && schema.pageSizes?.includes(input.pageSize)
  return {
    columns: migratedColumns
      ? schema.columnIds.filter(id => schema.requiredColumns.includes(id) || migratedColumns.includes(id))
      : [...schema.defaultColumns],
    density: input.density === 'compact' ? 'compact' : 'comfortable',
    ...(schema.version ? { version: schema.version } : {}),
    ...(schema.defaultSort ? {
      sort: validSort ? { key: sort.key as string, direction: sort.direction as 'asc' | 'desc' } : { ...schema.defaultSort },
    } : {}),
    ...(schema.defaultPageSize ? { pageSize: validPageSize ? input.pageSize as number : schema.defaultPageSize } : {}),
  }
}

export function tablePreferenceKey(schema: TablePreferenceSchema, tenantId: string, membershipId: string) {
  return `${schema.storagePrefix}:${encodeURIComponent(tenantId)}:${encodeURIComponent(membershipId)}`
}