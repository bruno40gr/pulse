import { durationRates, evaluateDiscount, type SetupRecord, type SetupDiscount, type DiscountPolicy, type DiscountFacts } from '../app/content-studio-prototype/school-setup/setup-content'
import type { ExplorerPerson } from './event-explorer'

export type BandPrice = {
  planId: string; serviceId: string; label: string; unit: string; recurring: boolean;
  baseAmount: string; amount: string; discountIds: string[];
}
export function bandPricingPlans(services: SetupRecord[], plans: SetupRecord[]) {
  return services.filter(service => /\b(band|ensemble)\b/i.test(service.values.name)).flatMap(service => {
    let ids: string[] = []
    try { const parsed: unknown = JSON.parse(service.values.planIds || '[]'); ids = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [] } catch { /* No configured link. */ }
    return plans.filter(plan => ids.includes(plan.id)).map(plan => ({ service, plan }))
  })
}
export function bandDiscountFacts(student: ExplorerPerson, people: ExplorerPerson[]): DiscountFacts {
  return {
    familyStudents: String(people.filter(person => (person.accountId || person.id) === (student.accountId || student.id) && person.enrolled && !person.roles.some(role => ['Parent', 'Account holder'].includes(role))).length),
    activeEnrollments: student.subscriptions ? String(student.subscriptions.filter(subscription => subscription.status === 'active').length) : undefined,
    status: 'pending',
  }
}
export function quoteBandPrice(service: SetupRecord, plan: SetupRecord, rate: string, discounts: SetupDiscount[], policy: DiscountPolicy): BandPrice {
  const values = plan.values
  if (!rate.trim() || !Number.isFinite(Number(rate)) || Number(rate) <= 0) throw new Error('Set a valid price on the band service pricing model.')
  const recurring = values.kind === 'Subscription'
  const cadence = (values.cadence || '').toLowerCase()
  const perSession = values.basis === 'Per scheduled lesson'
  const unit = recurring ? perSession ? `per session · billed ${cadence}` : `flat fee · billed ${cadence}` : values.kind === 'Single lesson' ? 'per session' : `${values.kind.toLowerCase()} · ${values.visits} sessions`
  const base = Math.round(Number(rate) * 100)
  const apply = (amount: number, discount: SetupDiscount) => Math.max(0, amount - (discount.unit === '%' ? Math.round(amount * Number(discount.amount) / 100) : Math.round(Number(discount.amount) * 100)))
  const selected = policy.combination === 'best' ? [...discounts].sort((a, b) => apply(base, a) - apply(base, b)).slice(0, 1) : [...discounts].sort((a, b) => a.unit === b.unit ? 0 : (a.unit === '%') === (policy.order === 'percentage-first') ? -1 : 1)
  const total = selected.reduce(apply, base)
  if (total <= 0) throw new Error('The selected discounts leave no payable amount. Choose another discount.')
  return { planId: plan.id, serviceId: service.id, label: values.name || values.kind, unit, recurring, baseAmount: (base / 100).toFixed(2), amount: (total / 100).toFixed(2), discountIds: selected.map(discount => discount.id) }
}
export function bandPlanRates(plan: SetupRecord) {
  return durationRates(plan.values)
}
export function eligibleBandDiscounts(discounts: SetupDiscount[], students: ExplorerPerson[], people: ExplorerPerson[], date: string) {
  return discounts.filter(discount => (!discount.startsOn || discount.startsOn <= date) && (!discount.endsOn || discount.endsOn >= date) && students.length > 0 && students.every(student => evaluateDiscount(discount, bandDiscountFacts(student, people)) === 'eligible'))
}