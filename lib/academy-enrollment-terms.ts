import { AcademyValidationError, parsePaymentPlan, type PaymentPlanTerms } from './academy-domain'

/** Pure proposed effective-date contract, not a schema or accepted live change.
 * Calendar dates use [effectiveFrom, effectiveUntil); no timezone/clock inference.
 */
export type TermsScope = Readonly<{ tenantId: string; contextId: string; enrollmentId: string }>
type VersionReference = Readonly<{ id: string; version: number }>
export type EnrollmentTerms = TermsScope & Readonly<{
  version: number
  effectiveFrom: string
  effectiveUntil: string | null
  service: VersionReference
  plan: VersionReference
  paymentPlan: PaymentPlanTerms
  price: Readonly<{ currency: string; amountMinor: number }>
  recordedBy: string
  reason: string
}>

function fail(code: string): never {
  throw new AcademyValidationError(code)
}

function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid_terms_object')
  const row = value as Record<string, unknown>
  if (Object.keys(row).some(key => !keys.includes(key))) fail('unexpected_terms_field')
  return row
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value || value !== value.trim()) fail('invalid_terms_text')
  return value
}

function positiveInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) fail('invalid_terms_version')
  return value
}

/** Validate actual calendar dates without Date parsing/rollover or local timezone. */
function date(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('invalid_terms_date')
  const [year, month, day] = value.split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) fail('invalid_terms_date')
  return value
}

function reference(value: unknown): VersionReference {
  const row = record(value, ['id', 'version'])
  return Object.freeze({ id: text(row.id), version: positiveInteger(row.version) })
}

function copyScope(scope: TermsScope): TermsScope {
  return Object.freeze({ tenantId: text(scope.tenantId), contextId: text(scope.contextId), enrollmentId: text(scope.enrollmentId) })
}

export function parseEnrollmentTerms(value: unknown): EnrollmentTerms {
  const row = record(value, [
    'tenantId', 'contextId', 'enrollmentId', 'version', 'effectiveFrom', 'effectiveUntil',
    'service', 'plan', 'paymentPlan', 'price', 'recordedBy', 'reason',
  ])
  const effectiveFrom = date(row.effectiveFrom)
  const effectiveUntil = row.effectiveUntil === null ? null : date(row.effectiveUntil)
  if (effectiveUntil !== null && effectiveUntil <= effectiveFrom) fail('invalid_terms_range')
  const price = record(row.price, ['currency', 'amountMinor'])
  const currency = text(price.currency)
  if (!/^[A-Z]{3}$/.test(currency)) fail('invalid_terms_currency')
  if (typeof price.amountMinor !== 'number' || !Number.isSafeInteger(price.amountMinor) || price.amountMinor < 0) {
    fail('invalid_terms_amount')
  }
  return Object.freeze({
    tenantId: text(row.tenantId), contextId: text(row.contextId), enrollmentId: text(row.enrollmentId),
    version: positiveInteger(row.version), effectiveFrom, effectiveUntil,
    service: reference(row.service), plan: reference(row.plan), paymentPlan: parsePaymentPlan(row.paymentPlan),
    price: Object.freeze({ currency, amountMinor: price.amountMinor }),
    recordedBy: text(row.recordedBy), reason: text(row.reason),
  })
}

/** Input order must already be version/effective order. Gaps are allowed; missing
 * earlier history is not certified. This does not validate external references.
 */
export function validateEnrollmentTermsHistory(scope: TermsScope, values: readonly unknown[]): readonly EnrollmentTerms[] {
  const expectedScope = copyScope(scope)
  const history = values.map(parseEnrollmentTerms)
  for (let index = 0; index < history.length; index++) {
    const row = history[index]
    if (row.tenantId !== expectedScope.tenantId || row.contextId !== expectedScope.contextId || row.enrollmentId !== expectedScope.enrollmentId) {
      fail('terms_scope_mismatch')
    }
    const previous = history[index - 1]
    if (previous) {
      if (row.version <= previous.version) fail('terms_version_order')
      if (row.effectiveFrom <= previous.effectiveFrom) fail('terms_date_order')
      if (previous.effectiveUntil === null || previous.effectiveUntil > row.effectiveFrom) fail('terms_overlap')
    }
  }
  return Object.freeze(history)
}

export type EnrollmentTermsChange = Readonly<{
  scope: TermsScope
  expectedVersion: number
  previous: EnrollmentTerms | null
  closePreviousAt: string | null
  next: EnrollmentTerms
}>

/** Prepare only. Persistence must atomically compare expectedVersion, close an
 * open predecessor when requested, and append next with authorization/audit.
 * Supports append-only revisions in effective-date order, not corrections.
 * No clock is read: the caller must enforce any retroactive-change restrictions.
 */
export function prepareEnrollmentTermsChange(
  scope: TermsScope,
  values: readonly unknown[],
  expectedVersion: number,
  proposed: unknown,
): EnrollmentTermsChange {
  const history = validateEnrollmentTermsHistory(scope, values)
  const previous = history[history.length - 1] ?? null
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0 || expectedVersion !== (previous?.version ?? 0)) {
    fail('terms_version_conflict')
  }
  const next = parseEnrollmentTerms(proposed)
  validateEnrollmentTermsHistory(scope, [next])
  if (!Number.isSafeInteger(expectedVersion + 1) || next.version !== expectedVersion + 1) fail('terms_next_version')
  let closePreviousAt: string | null = null
  if (previous) {
    if (next.effectiveFrom <= previous.effectiveFrom) fail('terms_change_not_append')
    if (previous.effectiveUntil === null) closePreviousAt = next.effectiveFrom
    else if (previous.effectiveUntil > next.effectiveFrom) fail('terms_overlap')
  }
  return Object.freeze({ scope: copyScope(scope), expectedVersion, previous, closePreviousAt, next })
}