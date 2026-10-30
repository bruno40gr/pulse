/** Pure identity preview, not an importer or authorization boundary.
 * Caller supplies approved normalized source IDs and complete scoped mappings.
 * No canonical IDs are generated and no terms, sessions or deletions are inferred.
 */
export type ImportScope = Readonly<{ tenantId: string; contextId: string; sourceSystem: string }>
export type StudentSourceMapping = ImportScope & Readonly<{ sourceStudentId: string; studentId: string }>
export type SubscriptionSourceMapping = ImportScope & Readonly<{
  sourceSubscriptionId: string; enrollmentId: string; studentId: string
}>
export type ImportPreviewIssue =
  | 'invalid_source_row' | 'duplicate_subscription' | 'unknown_student' | 'subscription_student_conflict'
export type ImportPreviewRow = Readonly<
  | { rowNumber: number; disposition: 'quarantined'; issue: ImportPreviewIssue }
  | { rowNumber: number; disposition: 'matched'; sourceStudentId: string; sourceSubscriptionId: string; studentId: string; enrollmentId: string }
  | { rowNumber: number; disposition: 'creation_candidate'; sourceStudentId: string; sourceSubscriptionId: string; studentId: string }
>
export type ImportPreview = Readonly<{
  scope: ImportScope; rows: readonly ImportPreviewRow[]
  counts: Readonly<{ total: number; matched: number; creationCandidates: number; quarantined: number }>
}>

function validId(value: unknown): value is string {
  // IDs are opaque and case-sensitive. Do not trim/coerce and silently alias keys.
  return typeof value === 'string' && value.length > 0 && value === value.trim()
}

function assertScope(scope: ImportScope): void {
  if (!scope || !validId(scope.tenantId) || !validId(scope.contextId) || !validId(scope.sourceSystem)) {
    throw new Error('invalid_import_scope')
  }
}

function assertMappingScope(scope: ImportScope, mapping: ImportScope): void {
  if (!mapping || mapping.tenantId !== scope.tenantId || mapping.contextId !== scope.contextId || mapping.sourceSystem !== scope.sourceSystem) {
    throw new Error('mapping_scope_mismatch')
  }
}

type SourceRow = Readonly<{ sourceStudentId: string; sourceSubscriptionId: string }>

function parseRow(value: unknown): SourceRow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (Object.keys(row).some(key => key !== 'sourceStudentId' && key !== 'sourceSubscriptionId')) return null
  if (!validId(row.sourceStudentId) || !validId(row.sourceSubscriptionId)) return null
  return { sourceStudentId: row.sourceStudentId, sourceSubscriptionId: row.sourceSubscriptionId }
}

/** Invalid mapping inventories abort the whole preview; bad source rows quarantine.
 * Duplicate subscription IDs quarantine ALL occurrences, not just the later row,
 * even when one occurrence has a malformed student ID. Row numbers are 1-based
 * normalized input positions, not original CSV line numbers.
 */
export function previewSubscriptionImport(
  scope: ImportScope,
  studentMappings: readonly StudentSourceMapping[],
  subscriptionMappings: readonly SubscriptionSourceMapping[],
  sourceRows: readonly unknown[],
): ImportPreview {
  assertScope(scope)
  const students = new Map<string, string>()
  for (const mapping of studentMappings) {
    assertMappingScope(scope, mapping)
    if (!validId(mapping.sourceStudentId) || !validId(mapping.studentId)) throw new Error('invalid_student_mapping')
    if (students.has(mapping.sourceStudentId)) throw new Error('duplicate_student_mapping')
    students.set(mapping.sourceStudentId, mapping.studentId)
  }
  const subscriptions = new Map<string, SubscriptionSourceMapping>()
  const enrollmentOwners = new Map<string, string>()
  for (const mapping of subscriptionMappings) {
    assertMappingScope(scope, mapping)
    if (!validId(mapping.sourceSubscriptionId) || !validId(mapping.enrollmentId) || !validId(mapping.studentId)) {
      throw new Error('invalid_subscription_mapping')
    }
    if (subscriptions.has(mapping.sourceSubscriptionId)) throw new Error('duplicate_subscription_mapping')
    const owner = enrollmentOwners.get(mapping.enrollmentId)
    if (owner !== undefined && owner !== mapping.studentId) throw new Error('conflicting_enrollment_owner')
    enrollmentOwners.set(mapping.enrollmentId, mapping.studentId)
    subscriptions.set(mapping.sourceSubscriptionId, mapping)
  }
  const frequencies = new Map<string, number>()
  for (const value of sourceRows) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const id = (value as Record<string, unknown>).sourceSubscriptionId
    if (validId(id)) frequencies.set(id, (frequencies.get(id) ?? 0) + 1)
  }
  const rows = sourceRows.map((value, index): ImportPreviewRow => {
    const rowNumber = index + 1
    const row = parseRow(value)
    if (!row) return Object.freeze({ rowNumber, disposition: 'quarantined', issue: 'invalid_source_row' })
    if ((frequencies.get(row.sourceSubscriptionId) ?? 0) > 1) {
      return Object.freeze({ rowNumber, disposition: 'quarantined', issue: 'duplicate_subscription' })
    }
    const studentId = students.get(row.sourceStudentId)
    if (!studentId) return Object.freeze({ rowNumber, disposition: 'quarantined', issue: 'unknown_student' })
    const existing = subscriptions.get(row.sourceSubscriptionId)
    if (existing && existing.studentId !== studentId) {
      return Object.freeze({ rowNumber, disposition: 'quarantined', issue: 'subscription_student_conflict' })
    }
    if (existing) return Object.freeze({ rowNumber, disposition: 'matched', ...row, studentId, enrollmentId: existing.enrollmentId })
    return Object.freeze({ rowNumber, disposition: 'creation_candidate', ...row, studentId })
  })
  return Object.freeze({
    scope: Object.freeze({ tenantId: scope.tenantId, contextId: scope.contextId, sourceSystem: scope.sourceSystem }),
    rows: Object.freeze(rows),
    counts: Object.freeze({
      total: rows.length,
      matched: rows.filter(row => row.disposition === 'matched').length,
      creationCandidates: rows.filter(row => row.disposition === 'creation_candidate').length,
      quarantined: rows.filter(row => row.disposition === 'quarantined').length,
    }),
  })
}