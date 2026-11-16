'use client'

import { useRef, useState } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { EntryPathCard } from '@/components/ui/EntryPathCard'
import { Music, Users, CalendarDays, DoorOpen, Ban, Sparkles } from 'lucide-react'
import entryStyles from '../content-studio-prototype/event-explorer/explorer.module.css'
import { calendarBookingOptions, reconcileCalendarBooking } from '@/beta-source/lib/academy-calendar-options'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { Notice } from '@/components/ui/Notice'
import { bookingReason, type BookingContext, type CalendarBooking, roomRecords, roomSupportsBooking, isStaffDuty, staffDutyLabel, type CalendarBookingKind } from '@/beta-source/lib/academy-calendar-booking'
import { spacing } from '@/lib/tokens'
import { matchingSubscriptions } from '@/beta-source/lib/academy-calendar-enrollment'

export type BookingPrefill = { date: string; time: string; duration: number; teacherId?: string; roomId?: string; serviceId?: string; source?: 'teacher' | 'room' | 'service'; existing?: CalendarBooking }

/** Both Add booking and drawing mount this same stable-size dialog. */
export default function CalendarBookingModal({ initial, context, onClose, onSave, blockOnly = false }: { initial: BookingPrefill; context: BookingContext; onClose: () => void; onSave: (booking: CalendarBooking, action?: 'staff' | 'send') => string | null; blockOnly?: boolean }) {
  const spaceKind = context.setup.services?.find(service => service.id === initial.serviceId)?.values.bookingKind
  const initialKind: CalendarBookingKind = blockOnly ? 'block' : spaceKind === 'room' ? 'studio' : spaceKind === 'rehearsal' || spaceKind === 'event' ? spaceKind : 'lesson'
  const constraints = { teacherId: undefined, roomId: initial.source === 'room' ? initial.roomId : undefined, serviceId: initial.source === 'service' && initialKind === 'lesson' ? initial.serviceId : undefined }
  const [screen, setScreen] = useState<'cards' | 'details'>(initial.existing || blockOnly || initial.source === 'service' ? 'details' : 'cards')
  const [booking, setBooking] = useState<CalendarBooking>(() => initial.existing || reconcileCalendarBooking(context, { id: `beta:booking:${crypto.randomUUID()}`, kind: initialKind, title: '', date: initial.date, time: initial.time, duration: initialKind === 'lesson' ? (initial.duration >= 15 && initial.duration % 15 === 0 ? initial.duration : 30) : initial.duration, teacherId: initial.teacherId || '', roomId: initial.roomId || '', serviceId: initial.serviceId || '', studentIds: [], groupId: '', repeat: 'once', until: initial.date, publicOnly: false, status: 'Scheduled', arrangement: 'Monthly subscription' }, constraints))
  const kind = booking.kind
  const pathDrafts = useRef<Partial<Record<CalendarBookingKind, CalendarBooking>>>({})
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState<'staff' | 'send' | null>(null)
  const [confirmSend, setConfirmSend] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const patch = (value: Partial<CalendarBooking>) => { setBooking(current => { const next = { ...current, ...value }; const reconciled = reconcileCalendarBooking(context, next, constraints); return { ...reconciled, serviceId: next.kind === 'lesson' ? next.serviceId : '', teacherId: next.kind === 'studio' ? '' : value.teacherId ?? next.teacherId } }); setError(''); setSubmitted(false) }
  const options = calendarBookingOptions(context, booking, constraints)
  const preferenceReason = bookingReason(options.context, booking, false)
  const timeOptions = Array.from({ length: 32 }, (_, index) => {
    const minutes = 360 + index * 30
    const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${minutes % 60 ? '30' : '00'}`
    const candidates = kind === 'lesson' && booking.serviceId ? calendarBookingOptions(context, { ...booking, time, roomId: constraints.roomId || '' }, constraints) : null
    return { time, available: kind !== 'lesson' || !booking.serviceId || Boolean(candidates?.teachers.length) }
  })
  const rooms = options.rooms
  const lesson = kind === 'lesson', block = kind === 'block', duty = isStaffDuty(kind)
  const serviceOptions = context.setup.services || []
  const durationsFor = (id: string) => (serviceOptions.find(item => item.id === id)?.values.durations || '').split(',').map(Number).filter(value => Number.isFinite(value) && value >= 30 && value % 15 === 0)
  const serviceDurations = durationsFor(booking.serviceId)
  // The duration list comes from the configured service; 45-minute classes are only offered where configured.
  const durationOptions = Array.from(new Set([...(lesson ? (serviceDurations.length ? serviceDurations : [30, 60]) : Array.from({ length: 32 }, (_, index) => (index + 1) * 30)), booking.duration])).sort((a, b) => a - b)
  const reason = kind ? bookingReason(options.context, booking) : null
  const account = context.data.accounts.find(item => item.studentIds.includes(booking.studentIds[0]))
  const subscriptions = matchingSubscriptions(context.data, booking.studentIds[0], booking.serviceId, serviceOptions.find(item => item.id === booking.serviceId)?.values.name || '')
  const submit = (action: 'staff' | 'send', accepted = false, sendConfirmed = false) => {
    setSubmitted(true)
    if (reason) { setError(reason); return }
    if (lesson && booking.arrangement === 'Monthly subscription' && subscriptions.length && !accepted) { setPendingAction(action); return }
    if (lesson && action === 'send' && !sendConfirmed) { setPendingAction(action); setConfirmSend(true); return }
    const service = serviceOptions.find(item => item.id === booking.serviceId)
    const result = onSave({ ...booking, title: booking.title.trim() || (block ? 'Unavailable' : lesson ? service?.values.name || 'Lesson' : kind === 'studio' ? 'Studio booking' : kind === 'rehearsal' ? 'Band rehearsal' : 'Event') }, action)
    if (result) setError(result)
    setPendingAction(null); setConfirmSend(false)
  }
  const selectedTeacher = context.setup.teachers?.find(teacher => teacher.id === booking.teacherId)
  const selectedRoom = roomRecords(context.setup).find(room => room.id === constraints.roomId)
  const title = lesson ? selectedTeacher ? `Lesson with ${selectedTeacher.values.name}` : constraints.serviceId ? `${serviceOptions.find(service => service.id === constraints.serviceId)?.values.name || 'Lesson'} booking` : 'Lesson details' : block ? 'Block / unavailable' : duty ? staffDutyLabel(kind) : kind === 'studio' ? 'Studio booking' : kind === 'rehearsal' ? 'Band rehearsal' : 'Event'
  const fieldError = (pattern: RegExp) => submitted && error && pattern.test(error) ? error : undefined
  const choose = (next: CalendarBookingKind, single = false) => {
    pathDrafts.current[kind] = booking
    const previous = pathDrafts.current[next]
    patch({ ...(previous || { studentIds: [], groupId: '', serviceId: initial.serviceId || '', title: '', locationId: '', notes: '', roomId: '', requiredCapacity: undefined }), kind: next, date: booking.date, time: booking.time, until: booking.until, arrangement: single ? 'À-la-carte' : 'Monthly subscription', teacherId: next === 'studio' ? '' : previous?.teacherId || initial.teacherId || '', duration: next === 'lesson' ? (booking.duration >= 60 ? 60 : 30) : previous?.duration || initial.duration || 30, repeat: next === 'block' || isStaffDuty(next) ? previous?.repeat || 'once' : 'once' })
    setScreen('details')
  }
  const paths = [
    { id: 'lesson', label: 'Lesson', icon: Music },
    { id: 'single', label: 'Single lesson / Free trial', icon: Sparkles },
    { id: 'studio', label: 'Studio booking', icon: DoorOpen },
    { id: 'rehearsal', label: 'Band rehearsal', icon: Users },
    { id: 'event', label: 'Event', icon: CalendarDays },
    { id: 'front-desk', label: 'Front desk', icon: Users },
    { id: 'admin', label: 'Admin', icon: CalendarDays },
    { id: 'block', label: 'Block / unavailable', icon: Ban },
  ] as const
  const availablePaths = paths.filter(path => {
    if (blockOnly) return path.id === 'block'
    if (!selectedRoom || path.id === 'block' || isStaffDuty(path.id)) return true
    const nextKind = path.id === 'single' ? 'lesson' : path.id
    const probe = { ...booking, kind: nextKind, studentIds: [], groupId: '', requiredCapacity: undefined }
    if (nextKind === 'lesson') return serviceOptions.some(service => roomSupportsBooking(context, { ...probe, serviceId: service.id }, selectedRoom))
    return roomSupportsBooking(context, { ...probe, serviceId: '' }, selectedRoom)
  })
  if (pendingAction) return <Modal key="confirmation" isOpen size="md" ariaLabel={confirmSend ? 'Send enrollment request' : 'Existing subscription'} onClose={() => { setPendingAction(null); setConfirmSend(false) }}>
    <ModalHeader title={confirmSend ? 'Send enrollment request' : 'Existing subscription'} onClose={() => { setPendingAction(null); setConfirmSend(false) }} />
    <ModalBody>{confirmSend ? <p>Send a portal enrollment request to {account?.holderName} · {account?.email || 'No email available'}.</p> : <p>This student already has an active subscription for this lesson type. Do you want to start a new subscription?</p>}</ModalBody>
    <ModalFooter><Button variant="secondary" onClick={() => { setPendingAction(null); setConfirmSend(false) }}>Cancel</Button><Button disabled={confirmSend && !account?.email} onClick={() => submit(pendingAction, true, confirmSend)}>{confirmSend ? 'Send request' : 'Continue'}</Button></ModalFooter>
  </Modal>
  return <Modal key="booking" isOpen size="lg" layout="fixed" ariaLabel="Add booking" style={{ height: 'min(82dvh, 760px)', maxHeight: '90dvh' }} onClose={onClose}>
    <ModalHeader title={screen === 'cards' ? 'Add booking' : title} onBack={screen === 'details' && initial.source !== 'service' && !blockOnly ? () => { setScreen('cards'); setSubmitted(false); setError('') } : undefined} onClose={onClose} />
    <ModalBody style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
      {screen === 'cards' ? <div className={entryStyles.choices} style={{ gap: spacing.lg }} aria-label="Booking type">
        {availablePaths.map(path => <EntryPathCard key={path.id} title={path.label} action="Choose" onChoose={() => choose(path.id === 'single' ? 'lesson' : path.id, path.id === 'single')}><path.icon size={28} /></EntryPathCard>)}
      </div> : <>
        {selectedRoom && <strong>{selectedRoom.name} · capacity {selectedRoom.capacity}</strong>}
        {lesson && <Select error={submitted && !booking.studentIds.length ? 'Choose a student.' : fieldError(/student|participant|family|account|email/i)} label="Student" value={booking.studentIds[0] || ''} onChange={event => patch({ studentIds: event.target.value ? [event.target.value] : [] })}><option value="">Choose a student</option>{context.data.students.map(student => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}</option>)}</Select>}
        {lesson && <Select error={submitted && !booking.serviceId ? 'Choose a service.' : fieldError(/service/i)} label="Lesson service" disabled={Boolean(constraints.serviceId)} value={booking.serviceId} onChange={event => { const serviceId = event.target.value; const offered = durationsFor(serviceId); patch({ serviceId, ...(offered.length && !offered.includes(booking.duration) ? { duration: offered[0] } : {}) }) }}><option value="">Choose a service</option>{[...options.services, ...serviceOptions.filter(service => service.id === booking.serviceId && !options.services.some(option => option.id === service.id))].map(service => <option key={service.id} value={service.id}>{service.values.name}</option>)}</Select>}
        {!lesson && !duty && <Input label={block ? 'Block reason' : 'Booking name'} value={booking.title} onChange={event => patch({ title: event.target.value })} placeholder={block ? 'e.g. Maintenance or personal time' : 'Optional name'} />}
        {duty && <>
          <Select label="Duty location" value={booking.locationId || ''} onChange={event => patch({ locationId: event.target.value, roomId: '' })}><option value="">Choose a location</option>{context.setup.locations.map(location => <option key={location.id} value={location.id}>{location.values.name}</option>)}</Select>
          <Input label="Duty notes" value={booking.notes || ''} onChange={event => patch({ notes: event.target.value })} />
          {!options.teachers.length && <Notice>No eligible staff. Enable this duty under Additional duties in teacher setup.</Notice>}
        </>}
        <FieldGrid><Input error={submitted && (!booking.date || reason?.includes("date") || reason?.includes("closed")) ? reason || "Choose a date." : undefined} label="Booking date" type="date" value={booking.date} onChange={event => patch({ date: event.target.value, until: event.target.value })} /><Select error={submitted && reason && /time|gap|rest|booking|unavailable|blocked/.test(reason) ? reason : undefined} label="Start time" value={booking.time} onChange={event => patch({ time: event.target.value })}>{timeOptions.map(({ time, available }) => <option key={time} value={time} disabled={!available}>{time}{available ? '' : ' · unavailable'}</option>)}</Select></FieldGrid>
        {lesson && booking.serviceId && <p role="status">{preferenceReason || (options.teachers.length ? `${options.teachers.length} compatible teacher${options.teachers.length === 1 ? '' : 's'} available at ${booking.time}.` : 'No compatible teacher and room are available at this time. Choose another date or time.')}</p>}
        <Select error={submitted && reason?.includes("increments") ? reason : undefined} label="Duration" value={booking.duration} onChange={event => patch({ duration: Number(event.target.value) })}>{durationOptions.map(value => <option key={value} value={value}>{value} minutes</option>)}</Select>
        <FieldGrid>{kind !== 'studio' && <Select error={submitted && lesson && !booking.teacherId ? 'Choose an available teacher.' : fieldError(/teacher/i)} label={duty ? 'Assigned staff' : lesson ? 'Teacher' : 'Teacher (optional)'} value={booking.teacherId} onChange={event => patch({ teacherId: event.target.value })}><option value="">{duty ? 'Choose eligible staff' : lesson ? 'Choose a teacher' : 'No teacher'}</option>{[...options.teachers, ...(context.setup.teachers || []).filter(teacher => teacher.id === booking.teacherId && !options.teachers.some(option => option.id === teacher.id))].map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.values.name}</option>)}</Select>}<Select error={submitted && !booking.roomId && !duty && (!block || !booking.teacherId) ? 'Choose an available room.' : fieldError(/room|capacity/i)} label={block || duty ? 'Room (optional)' : 'Room'} disabled={Boolean(constraints.roomId)} value={booking.roomId} onChange={event => patch({ roomId: event.target.value })}><option value="">{block || duty ? 'No room' : 'Choose a room'}</option>{[...rooms, ...roomRecords(context.setup).filter(room => room.id === booking.roomId && !rooms.some(option => option.id === room.id))].map(room => <option key={room.id} value={room.id}>{room.name} · capacity {room.capacity}</option>)}</Select></FieldGrid>

        {lesson && <p role="status">The time is confirmed when enrollment is completed. Drafts and enrollment requests do not reserve this spot.</p>}
        {lesson && <Select label="Lesson arrangement" value={booking.arrangement || 'Monthly subscription'} onChange={event => patch({ arrangement: event.target.value as CalendarBooking['arrangement'] })}><option value="À-la-carte">À-la-carte · one lesson</option><option value="Monthly subscription">Ongoing · monthly subscription</option></Select>}
        {kind === 'event' && <Input label="Required event capacity" type="number" min={1} value={booking.requiredCapacity || ''} error={fieldError(/capacity/)} onChange={event => patch({ requiredCapacity: Number(event.target.value) || undefined })} />}
        {!lesson && !block && !duty && <>
          <Select error={fieldError(/band|participant/i)} label="Band (optional)" value={booking.groupId} onChange={event => patch({ groupId: event.target.value })}><option value="">No band</option>{context.groups.map(group => <option key={group.id} value={group.id}>{group.name} · {group.memberIds.length} members</option>)}</Select>
          <details><summary>Add individual participants (optional){booking.studentIds.length ? ` · ${booking.studentIds.length} selected` : ''}</summary><div style={{ maxHeight: 180, overflowY: 'auto', marginTop: spacing.md }}>{context.data.students.map(student => <Checkbox key={student.id} label={`${student.firstName} ${student.lastName}`} checked={booking.studentIds.includes(student.id)} onChange={event => patch({ studentIds: event.target.checked ? [...booking.studentIds, student.id] : booking.studentIds.filter(id => id !== student.id) })} />)}</div></details>
        </>}
        {(block || duty) && <>
          <Select label="Repeat" value={booking.repeat} onChange={event => patch({ repeat: event.target.value as 'once' | 'weekly' })}><option value="once">Does not repeat</option><option value="weekly">Every week</option></Select>
          {booking.repeat === 'weekly' && <Input error={submitted && reason?.includes("end date") ? reason : undefined} label="Repeat through" type="date" min={booking.date} value={booking.until} onChange={event => patch({ until: event.target.value })} />}
        </>}
        {!block && !duty && !rooms.length && <p role="status">No suitable rooms available for this activity and time.</p>}
        {submitted && error && <Notice variant="error">{error}</Notice>}
      </>}
    </ModalBody>
    {screen === 'details' && <ModalFooter>{lesson && <Button variant="secondary" onClick={() => submit('send')}>Send enrollment request</Button>}<Button onClick={() => submit('staff')}>{duty ? 'Save duty' : block ? 'Save block' : lesson ? 'Continue enrollment' : 'Add booking'}</Button></ModalFooter>}
  </Modal>
}
