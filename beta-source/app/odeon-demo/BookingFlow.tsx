'use client'

import { useCallback, useState } from 'react'
import { Modal, ModalBody, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import StaffEnrollment from '../content-studio-prototype/enrollment/StaffEnrollment'
import CalendarBookingModal, { type BookingPrefill } from './CalendarBookingModal'
import { useCalendarEnrollment } from './CalendarEnrollmentContext'
import { newEnrollmentDraft, completeEnrollmentDraft, type EnrollmentDraftRecord } from '@/beta-source/lib/academy-enrollment-drafts'
import { newLesson } from '@/beta-source/lib/academy-staff-enrollment'
import type { BookingContext, CalendarBooking } from '@/beta-source/lib/academy-calendar-booking'
import type { EnrollmentPerson } from '@/beta-source/lib/academy-staff-enrollment'

/** One mounted flow for the hub CTA, Calendar CTA and contextual calendar selection. */
export default function BookingFlow({ initial, context, people, onClose, onSaveBooking, onCreateEnrollment, onSaveEnrollment }: {
  initial: BookingPrefill
  context: BookingContext
  people: readonly EnrollmentPerson[]
  onClose: () => void
  onSaveBooking: (booking: CalendarBooking) => string | null
  onCreateEnrollment: (booking: CalendarBooking) => EnrollmentDraftRecord
  onSaveEnrollment: (record: EnrollmentDraftRecord, action: 'draft' | 'complete' | 'send') => void
}) {
  const adapter = useCalendarEnrollment()
  const [record, setRecord] = useState<EnrollmentDraftRecord | null>(null)
  const [error, setError] = useState('')
  const updateDraft = useCallback<NonNullable<NonNullable<Parameters<typeof StaffEnrollment>[0]>['onDraftChange']>>((draft, step, reviewedSteps) => {
    setRecord(current => current ? { ...current, draft, step, reviewedSteps, started: true } : current)
  }, [])
  const save = (next: EnrollmentDraftRecord, action: 'draft' | 'complete' | 'send') => {
    onSaveEnrollment(next, action)
    onClose()
  }
  if (record) return <Modal isOpen size="wide" layout="fixed" ariaLabel="Enrollment and booking" closeOnBackdrop={false} closeOnEscape={false}>
    <ModalHeader title="Enrollment and booking" />
    <ModalBody>
      {error && <Notice variant="error">{error}</Notice>}
      {!record.completedAt && <Button variant="secondary" onClick={() => {
        try { save(record, 'send') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to send request.') }
      }}>Send to family to complete</Button>}
      <StaffEnrollment key={record.id} initialRecord={record} availablePeople={people} academyTeachers={adapter?.teachers} availability={adapter?.availability}
        singleSession={record.entryLesson?.frequency === 'À-la-carte'}
        onDraftChange={updateDraft}
        onSaveAndClose={(draft, step, reviewedSteps) => save({ ...record, draft, step, reviewedSteps }, 'draft')}
        onClose={() => save(record, 'draft')}
        onComplete={(draft, step, reviewedSteps) => save(completeEnrollmentDraft({ ...record, draft, step, reviewedSteps }, new Date().toISOString()), 'complete')}
      />
    </ModalBody>
  </Modal>
  return <CalendarBookingModal initial={initial} context={context} onClose={onClose}
    onStartLesson={single => {
      const next = newEnrollmentDraft(crypto.randomUUID(), new Date().toISOString())
      const formatsOf = (formats: string) => { try { return JSON.parse(formats || '[]') as string[] } catch { return [] as string[] } }
      // Start on the first teachable service the academy configured; the stepper can change it.
      const service = context.setup.services.find(item => {
        const formats = formatsOf(item.values.formats || '')
        return (!item.values.bookingKind || item.values.bookingKind === 'lesson') && item.values.status !== 'Inactive' && (formats.includes('private') || formats.includes('semi'))
      })
      const durations = (service?.values.durations || '').split(',').map(Number).filter(value => value > 0)
      const name = service?.values.name || ''
      const frequency = single ? 'À-la-carte' : 'Monthly subscription'
      const formats = formatsOf(service?.values.formats || '')
      next.entryLesson = {
        ...(service ? { serviceId: service.id, service: formats.includes('semi') && !formats.includes('private') ? 'Semi-private' : 'Private', instrument: name === 'Voice & Vocals' ? 'Voice' : name === 'Band' ? 'Band Program' : name, duration: String(durations[0] || 30) } : {}),
        frequency,
      }
      next.draft.lessons = [{ ...newLesson('lesson-1'), ...next.entryLesson }]
      setRecord(next)
    }}
    onSave={booking => {
      if (booking.kind !== 'lesson') return onSaveBooking(booking)
      try {
        const next = onCreateEnrollment(booking)
        setRecord({ ...next, step: 0, reviewedSteps: [] })
        return null
      } catch (cause) { return cause instanceof Error ? cause.message : 'Unable to start enrollment.' }
    }}
  />
}