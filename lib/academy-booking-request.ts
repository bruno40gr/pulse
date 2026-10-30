/** Pure request lifecycle only. No scheduling, authorization, persistence or
 * provider calls. Caller verifies card readiness, staff authority and payment
 * evidence. These inputs are not a browser-facing API or a billing command.
 */
export type BookingRequestStatus =
  | 'draft' | 'awaiting_confirmation' | 'pending_payment'
  | 'processing_payment' | 'confirmed' | 'rejected'
export type BookingRequestState = Readonly<{
  status: BookingRequestStatus
  paymentAttemptId: string | null
}>
export type BookingRequestEvent =
  | Readonly<{ type: 'submit'; cardReady: boolean }>
  | Readonly<{ type: 'approve' | 'reject' }>
  | Readonly<{ type: 'start_payment'; attemptId: string }>
  | Readonly<{ type: 'payment_succeeded' | 'payment_failed'; attemptId: string }>

function state(status: BookingRequestStatus, paymentAttemptId: string | null = null): BookingRequestState {
  return Object.freeze({ status, paymentAttemptId })
}

export function newBookingRequest(): BookingRequestState {
  return state('draft')
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
}

export function transitionBookingRequest(current: BookingRequestState, event: BookingRequestEvent): BookingRequestState {
  const statuses: readonly string[] = ['draft', 'awaiting_confirmation', 'pending_payment', 'processing_payment', 'confirmed', 'rejected']
  if (!current || !statuses.includes(current.status) || Object.keys(current).some(key => !['status', 'paymentAttemptId'].includes(key))) {
    throw new Error('invalid_booking_state')
  }
  const needsAttempt = current.status === 'processing_payment' || current.status === 'confirmed'
  if (needsAttempt ? !validId(current.paymentAttemptId) : current.paymentAttemptId !== null) {
    throw new Error('invalid_booking_state')
  }
  if (!event || typeof event !== 'object') throw new Error('invalid_booking_event')
  const keys = event.type === 'submit' ? ['type', 'cardReady']
    : ['start_payment', 'payment_succeeded', 'payment_failed'].includes(event.type) ? ['type', 'attemptId'] : ['type']
  if (Object.keys(event).some(key => !keys.includes(key))) throw new Error('invalid_booking_event')
  switch (event.type) {
    case 'submit':
      if (typeof event.cardReady !== 'boolean') throw new Error('invalid_card_readiness')
      if (current.status !== 'draft') break
      if (!event.cardReady) throw new Error('card_required_before_review')
      return state('awaiting_confirmation')
    case 'approve':
      if (current.status === 'awaiting_confirmation') return state('pending_payment')
      break
    case 'reject':
      if (current.status === 'awaiting_confirmation') return state('rejected')
      break
    case 'start_payment':
      if (!validId(event.attemptId)) throw new Error('invalid_payment_attempt')
      if (current.status === 'pending_payment') return state('processing_payment', event.attemptId)
      break
    case 'payment_succeeded':
    case 'payment_failed':
      if (!validId(event.attemptId)) throw new Error('invalid_payment_attempt')
      if (current.status !== 'processing_payment') break
      if (event.attemptId !== current.paymentAttemptId) throw new Error('payment_attempt_mismatch')
      return event.type === 'payment_succeeded' ? state('confirmed', event.attemptId) : state('pending_payment')
    default:
      throw new Error('invalid_booking_event')
  }
  throw new Error('invalid_booking_transition')
}