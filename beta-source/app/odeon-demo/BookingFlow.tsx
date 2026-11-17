'use client'

import CalendarBookingModal, { type BookingPrefill } from './CalendarBookingModal'
import type { BookingContext, CalendarBooking } from '@/beta-source/lib/academy-calendar-booking'

/**
 * One chooser for both entry points. Non-lesson bookings are saved here; a lesson
 * continues on the full enrollment screen as a saved draft, never inside this dialog.
 */
export default function BookingFlow({ initial, context, onClose, onSaveBooking, onStartEnrollment }: {
  initial: BookingPrefill
  context: BookingContext
  onClose: () => void
  onSaveBooking: (booking: CalendarBooking) => string | null
  onStartEnrollment: (booking: CalendarBooking | null, single: boolean) => string | null
}) {
  return <CalendarBookingModal initial={initial} context={context} onClose={onClose}
    onStartLesson={single => onStartEnrollment(null, single)}
    onSave={booking => booking.kind === 'lesson'
      ? onStartEnrollment(booking, booking.arrangement === 'À-la-carte')
      : onSaveBooking(booking)}
  />
}
