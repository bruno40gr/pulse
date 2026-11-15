import type { FamilyPreviewData } from './academy-family-preview'
import { subscriptionTerms } from './academy-subscription-history'

/** Additive upgrade: retain tester IDs, bookings, invoices, drafts and unknown fields.
 * Legacy shared-session identity is deliberately not guessed from time/name. */
export function upgradeAcademyModel(data: FamilyPreviewData): FamilyPreviewData {
  if ((data.modelVersion || 0) >= 3) return data
  return { ...data, modelVersion: 3, paymentAttempts: data.paymentAttempts || [], payments: data.payments || [], paymentRefunds: data.paymentRefunds || [], students: data.students.map(student => ({ ...student, enrollments: student.enrollments.map(enrollment => enrollment.history?.length ? enrollment : { ...enrollment, history: [{ id: `${enrollment.id}:initial`, effectiveFrom: enrollment.start, recordedAt: new Date().toISOString(), actor: 'migration', reason: 'Preserved existing terms; earlier history unavailable.', terms: subscriptionTerms(enrollment) }] }) })) }
}