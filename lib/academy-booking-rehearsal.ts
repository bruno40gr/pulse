/** Fictional UI fixtures only. Never use these as identity or provider evidence. */
import { newBookingRequest, transitionBookingRequest, type BookingRequestEvent, type BookingRequestState } from './academy-booking-request'

export const rehearsalSlots = [
  'Jordan Vale · Tuesday 4:00 pm · Studio A',
  'Robin Ellis · Wednesday 5:30 pm · Studio B',
] as const

export type RehearsalRequest = {
  id: string
  name: string
  instrument: string
  format: string
  availability: string
  note: string
  cardReady: boolean
  identityResolved: boolean
  teacherBenefit: boolean
  slot: string
  termsReviewed: boolean
  state: BookingRequestState
  history: string[]
}

export function createRehearsalRequests(): RehearsalRequest[] {
  return [
    { id: 'DEMO-101', name: 'Avery Lane', instrument: 'Piano', format: 'Recurring · 30 minutes weekly', availability: 'Tuesday after 3 pm or Wednesday evening', note: 'Returning to piano. Would love a regular weekly lesson.', cardReady: true, identityResolved: true, teacherBenefit: true },
    { id: 'DEMO-102', name: 'Sam Reed', instrument: 'Guitar', format: 'One-off · 30 minutes', availability: 'Wednesday after 5 pm', note: 'Same name as a teacher, different email. Keep identities separate until staff resolve the match.', cardReady: true, identityResolved: false, teacherBenefit: false },
    { id: 'DEMO-103', name: 'Morgan Quinn', instrument: 'Voice', format: 'À-la-carte · 30 minutes', availability: 'Tuesday afternoon', note: 'Saved draft. A card is still required before submission.', cardReady: false, identityResolved: true, teacherBenefit: false },
  ].map(request => ({ ...request, slot: '', termsReviewed: false,
    state: request.cardReady ? transitionBookingRequest(newBookingRequest(), { type: 'submit', cardReady: true }) : newBookingRequest(),
    history: [request.cardReady ? 'Fictional request submitted. No charge made.' : 'Fictional draft saved. Not in staff review.'],
  }))
}

export function rehearsalPrice(request: RehearsalRequest) {
  return request.identityResolved && request.teacherBenefit ? 25 : 50
}

export function advanceRehearsal(request: RehearsalRequest, event: BookingRequestEvent): RehearsalRequest {
  if (event.type === 'submit' && (!request.cardReady || event.cardReady !== true)) throw new Error('Simulate a ready card before submitting.')
  if (event.type === 'approve' && (!request.identityResolved || !rehearsalSlots.some(slot => slot === request.slot) || !request.termsReviewed)) {
    throw new Error('Resolve identity, agree a lesson slot and review the terms before approval.')
  }
  const state = transitionBookingRequest(request.state, event)
  const messages: Record<BookingRequestEvent['type'], string> = {
    submit: 'Submitted for staff review. No charge made.',
    approve: 'Staff approval simulated. Awaiting payment; not confirmed.',
    reject: 'Request declined in this rehearsal.',
    start_payment: 'Fictional payment attempt started. No provider contacted.',
    payment_failed: 'Payment failure simulated. Still pending payment, not confirmed.',
    payment_succeeded: 'Payment success simulated. Booking confirmed in this rehearsal only.',
  }
  return { ...request, state, history: [...request.history, messages[event.type]] }
}