import type { PreviewEnrollment } from './academy-student-preview'
import { billingDate } from './academy-billing'

/** Effective-dated snapshots. Recorded time and effective date are deliberately separate. */
export type SubscriptionTerms = Pick<PreviewEnrollment, 'program' | 'service' | 'teacher' | 'teacherId' | 'level' | 'duration' | 'amountMinor' | 'currency' | 'payerId' | 'collection' | 'status' | 'lifecycle' | 'end' | 'autopay'>
export type SubscriptionRevision = {
  id: string; effectiveFrom: string; recordedAt: string; actor: string; reason: string
  terms: SubscriptionTerms
}

export function subscriptionTerms(enrollment: PreviewEnrollment): SubscriptionTerms {
  const { program, service, teacher, teacherId, level, duration, amountMinor, currency, payerId, collection, status, lifecycle, end, autopay } = enrollment
  return { program, service, teacher, teacherId, level, duration, amountMinor, currency, payerId, collection, status, lifecycle, end, autopay }
}

export function reviseSubscription(enrollment: PreviewEnrollment, patch: Partial<SubscriptionTerms>, context: { id: string; effectiveFrom: string; recordedAt: string; actor: string; reason: string }): PreviewEnrollment {
  if (!context.id.trim() || !context.actor.trim() || !context.reason.trim() || !billingDate(context.effectiveFrom) || context.effectiveFrom < enrollment.start || !Number.isFinite(Date.parse(context.recordedAt))) throw new Error('Provide a valid subscription change date, actor and reason.')
  const history = enrollment.history?.length ? enrollment.history : [{ id: `${enrollment.id}:initial`, effectiveFrom: enrollment.start, recordedAt: context.recordedAt, actor: 'migration', reason: 'Preserved existing terms; earlier history unavailable.', terms: subscriptionTerms(enrollment) }]
  const next = { ...enrollment, ...patch }
  const revision = { ...context, terms: subscriptionTerms(next) }
  const previous = history.find(item => item.id === context.id)
  if (previous) {
    if (JSON.stringify(previous) !== JSON.stringify(revision)) throw new Error('Subscription revision ID already has different terms.')
    return enrollment
  }
  if (context.effectiveFrom < history[history.length - 1].effectiveFrom) throw new Error('Subscription history cannot be overwritten by a backdated change.')
  if (next.end && (!billingDate(next.end) || next.end < enrollment.start)) throw new Error('Subscription end must follow its start.')
  return { ...next, history: [...history, revision] }
}

export function subscriptionTermsOn(enrollment: PreviewEnrollment, date: string) {
  return enrollment.history?.filter(item => item.effectiveFrom <= date).at(-1)?.terms || subscriptionTerms(enrollment)
}

/** End is exclusive; holds are historical states, not a payment outcome. */
export function subscriptionScheduledOn(enrollment: PreviewEnrollment, date: string) {
  const terms = subscriptionTermsOn(enrollment, date)
  return date >= enrollment.start && (!terms.end || date < terms.end) && terms.status === 'active' && !terms.lifecycle
}