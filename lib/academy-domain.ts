/** Pure M1 contracts. No database, authorization, clock, provider or UI dependencies.
 * Callers must supply an already authorized scope and eligible enrollment rows.
 * These types are not a hosted schema or permission boundary.
 */
export class AcademyValidationError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'AcademyValidationError'
  }
}

function fail(code: string): never {
  throw new AcademyValidationError(code)
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid_object')
  return value as Record<string, unknown>
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) fail('invalid_text')
  return value.trim()
}

function integer(value: unknown, minimum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) fail('invalid_integer')
  return value
}

function only(row: Record<string, unknown>, keys: string[]): void {
  if (Object.keys(row).some(key => !keys.includes(key))) fail('unexpected_field')
}

export type EnrollmentScope = Readonly<{ tenantId: string; contextId: string; studentId: string }>
export type EnrollmentReference = EnrollmentScope & Readonly<{ id: string }>

/** No filtering hides bad rows: callers must first query eligible rows in scope.
 * Omitted ID compatibility is allowed only for exactly one candidate.
 */
export function selectEnrollment(
  scope: EnrollmentScope,
  candidates: readonly EnrollmentReference[],
  requestedId?: string,
): EnrollmentReference {
  const tenantId = text(scope.tenantId)
  const contextId = text(scope.contextId)
  const studentId = text(scope.studentId)
  const ids = new Set<string>()
  for (const row of candidates) {
    const id = text(row.id)
    if (id !== row.id || ids.has(id)) fail('invalid_enrollment_identity')
    ids.add(id)
    if (row.tenantId !== tenantId || row.contextId !== contextId || row.studentId !== studentId) {
      fail('enrollment_scope_mismatch')
    }
  }
  if (requestedId !== undefined) {
    const id = text(requestedId)
    const selected = candidates.find(row => row.id === id)
    if (!selected) fail('enrollment_not_found')
    return Object.freeze({ id: selected.id, tenantId, contextId, studentId })
  }
  if (!candidates.length) fail('enrollment_not_found')
  if (candidates.length !== 1) fail('enrollment_selection_required')
  return Object.freeze({ id: candidates[0].id, tenantId, contextId, studentId })
}

export type PaymentPlanTerms = Readonly<
  | { kind: 'single_visit'; paymentCadence: 'once'; pricing: 'flat'; visits: 1 }
  | { kind: 'visit_pack'; paymentCadence: 'once'; pricing: 'flat'; visits: number }
  | { kind: 'recurring_payments'; paymentCadence: 'weekly' | 'monthly'; pricing: 'flat' | 'per_visit' }
  | { kind: 'prepaid_recurring'; paymentCadence: 'once'; pricing: 'flat' | 'per_visit'; visits: number }
>

/** Validates payment terms only; does not generate recurrence, dates or charges. */
export function parsePaymentPlan(value: unknown): PaymentPlanTerms {
  const row = record(value)
  const { kind, paymentCadence, pricing } = row
  if (kind === 'recurring_payments') {
    only(row, ['kind', 'paymentCadence', 'pricing'])
    if (paymentCadence !== 'weekly' && paymentCadence !== 'monthly') fail('invalid_payment_cadence')
    if (pricing !== 'flat' && pricing !== 'per_visit') fail('invalid_pricing_basis')
    return Object.freeze({ kind, paymentCadence, pricing })
  }
  only(row, ['kind', 'paymentCadence', 'pricing', 'visits'])
  if (paymentCadence !== 'once') fail('invalid_payment_cadence')
  const visits = integer(row.visits, 1)
  if (kind === 'single_visit') {
    if (visits !== 1 || pricing !== 'flat') fail('invalid_single_visit')
    return Object.freeze({ kind, paymentCadence, pricing, visits: 1 })
  }
  if (kind === 'visit_pack') {
    if (pricing !== 'flat') fail('invalid_pricing_basis')
    return Object.freeze({ kind, paymentCadence, pricing, visits })
  }
  if (kind === 'prepaid_recurring') {
    if (pricing !== 'flat' && pricing !== 'per_visit') fail('invalid_pricing_basis')
    return Object.freeze({ kind, paymentCadence, pricing, visits })
  }
  return fail('invalid_plan_kind')
}

export type OfferAdjustment = Readonly<
  | { kind: 'fixed_price' | 'amount_off'; currency: string; amountMinor: number }
  | { kind: 'percent_off'; basisPoints: number }
>
export type OfferScope = Readonly<{ kind: 'visits' | 'billing_periods'; count: number }>
export type SavedOffer = Readonly<{
  id: string; tenantId: string; name: string; version: number; archived: boolean
  adjustment: OfferAdjustment; scope: OfferScope
}>

export function parseSavedOffer(value: unknown): SavedOffer {
  const row = record(value)
  only(row, ['id', 'tenantId', 'name', 'version', 'archived', 'adjustment', 'scope'])
  const raw = record(row.adjustment)
  let adjustment: OfferAdjustment
  if (raw.kind === 'percent_off') {
    only(raw, ['kind', 'basisPoints'])
    const basisPoints = integer(raw.basisPoints, 0)
    if (basisPoints > 10000) fail('invalid_percentage')
    adjustment = Object.freeze({ kind: raw.kind, basisPoints })
  } else if (raw.kind === 'fixed_price' || raw.kind === 'amount_off') {
    only(raw, ['kind', 'currency', 'amountMinor'])
    const currency = text(raw.currency)
    if (!/^[A-Z]{3}$/.test(currency)) fail('invalid_currency_format')
    adjustment = Object.freeze({ kind: raw.kind, currency, amountMinor: integer(raw.amountMinor, 0) })
  } else {
    return fail('invalid_adjustment_kind')
  }
  const scope = record(row.scope)
  only(scope, ['kind', 'count'])
  if (scope.kind !== 'visits' && scope.kind !== 'billing_periods') fail('invalid_offer_scope')
  if (typeof row.archived !== 'boolean') fail('invalid_archive_state')
  return Object.freeze({
    id: text(row.id), tenantId: text(row.tenantId), name: text(row.name),
    version: integer(row.version, 1), archived: row.archived, adjustment,
    scope: Object.freeze({ kind: scope.kind, count: integer(scope.count, 1) }),
  })
}

export type OfferApplicationSnapshot = Readonly<{
  tenantId: string; contextId: string; enrollmentId: string
  offerId: string; offerVersion: number; offerName: string
  adjustment: OfferAdjustment; scope: OfferScope
}>

/** Immutable terms snapshot, not a persisted/authorized application or charge.
 * Eligibility, effective dates, stacking, currency support and acceptance remain
 * integration responsibilities. No offer edit can mutate this copied snapshot.
 */
export function snapshotOfferForEnrollment(
  offerInput: unknown,
  target: Readonly<{ tenantId: string; contextId: string; enrollmentId: string }>,
  expectedVersion: number,
): OfferApplicationSnapshot {
  const offer = parseSavedOffer(offerInput)
  const tenantId = text(target.tenantId)
  const contextId = text(target.contextId)
  const enrollmentId = text(target.enrollmentId)
  if (offer.tenantId !== tenantId) fail('offer_tenant_mismatch')
  if (offer.archived) fail('offer_archived')
  if (offer.version !== integer(expectedVersion, 1)) fail('offer_version_conflict')
  return Object.freeze({
    tenantId, contextId, enrollmentId, offerId: offer.id, offerVersion: offer.version,
    offerName: offer.name, adjustment: offer.adjustment, scope: offer.scope,
  })
}