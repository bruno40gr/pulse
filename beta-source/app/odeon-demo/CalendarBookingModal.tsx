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
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { Textarea } from '@/components/ui/Textarea'
import { Notice } from '@/components/ui/Notice'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { bookingReason, type BookingContext, type CalendarBooking, roomRecords, roomSupportsBooking, isStaffDuty, staffDutyLabel, type CalendarBookingKind } from '@/beta-source/lib/academy-calendar-booking'
import { colors, spacing, typography } from '@/lib/tokens'
import { matchingSubscriptions } from '@/beta-source/lib/academy-calendar-enrollment'

export type BookingPrefill = { date: string; time: string; duration: number; teacherId?: string; roomId?: string; serviceId?: string; source?: 'teacher' | 'room' | 'service'; existing?: CalendarBooking; replacementScope?: 'occurrence' | 'future'; kind?: 'admin' }

/** Both Add booking and drawing mount this same stable-size dialog. */
export default function CalendarBookingModal({ initial, context, onClose, onSave, onStartLesson, blockOnly = false }: { initial: BookingPrefill; context: BookingContext; onClose: () => void; onSave: (booking: CalendarBooking, action?: 'staff' | 'send') => string | null; onStartLesson?: (single: boolean) => void; blockOnly?: boolean }) {
  const spaceKind = context.setup.services?.find(service => service.id === initial.serviceId)?.values.bookingKind
  const initialKind: CalendarBookingKind = blockOnly ? 'block' : initial.kind || (spaceKind === 'room' ? 'studio' : spaceKind === 'rehearsal' || spaceKind === 'event' ? spaceKind : 'lesson')
  const constraints = { teacherId: initial.source === 'teacher' ? initial.teacherId : undefined, roomId: initial.source === 'room' ? initial.roomId : undefined, serviceId: initial.source === 'service' && initialKind === 'lesson' ? initial.serviceId : undefined }
  const [screen, setScreen] = useState<'cards' | 'details'>(initial.kind || initial.existing || blockOnly || initial.source === 'service' ? 'details' : 'cards')
  const [booking, setBooking] = useState<CalendarBooking>(() => initial.existing ? initial.replacementScope ? { ...initial.existing, id: `beta:booking:${crypto.randomUUID()}`, kind: 'admin', date: initial.date, repeat: initial.replacementScope === 'occurrence' ? 'once' : initial.existing.repeat, until: initial.replacementScope === 'occurrence' ? initial.date : initial.existing.until, excludedDates: [] } : initial.existing : reconcileCalendarBooking(context, { id: `beta:booking:${crypto.randomUUID()}`, kind: initialKind, title: '', date: initial.date, time: initial.time, duration: initialKind === 'lesson' ? (initial.duration >= 15 && initial.duration % 15 === 0 ? initial.duration : 30) : initial.duration, teacherId: initial.teacherId || '', roomId: initial.roomId || '', serviceId: initial.serviceId || '', studentIds: [], groupId: '', repeat: 'once', until: initial.date, publicOnly: false, status: 'Scheduled', arrangement: 'Monthly subscription' }, constraints))
  const kind = booking.kind
  const pathDrafts = useRef<Partial<Record<CalendarBookingKind, CalendarBooking>>>({})
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState<'staff' | 'send' | null>(null)
  const [confirmSend, setConfirmSend] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [studentSearch, setStudentSearch] = useState(false)
  const patch = (value: Partial<CalendarBooking>) => { setBooking(current => { const next = { ...current, ...value }; const reconciled = reconcileCalendarBooking(context, next, constraints); return { ...reconciled, serviceId: next.kind === 'lesson' ? next.serviceId : '', teacherId: value.teacherId ?? next.teacherId } }); setError(''); setSubmitted(false) }
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
  const engineeringLevel = (teacherId: string) => Number(context.setup.teachers?.find(item => item.id === teacherId)?.values.engineeringLevel || 0)
  // A rehearsal or private event is attended by people, not only by students.
  const peopleOptions = [
    ...context.data.students.map(student => ({ id: student.id, name: `${student.firstName} ${student.lastName}` })),
    ...(context.setup.teachers || []).map(teacher => ({ id: teacher.id, name: `${teacher.values.name} · staff` })),
  ]
  const participants = booking.participantIds || []
  // Only offer students who do not already hold this lesson type.
  const studentOptions = context.data.students.filter(student => !matchingSubscriptions(context.data, student.id, booking.serviceId, serviceOptions.find(item => item.id === booking.serviceId)?.values.name || '').length)
  const chosenStudent = context.data.students.find(student => student.id === booking.studentIds[0])
  const eligibleTeachers = [...options.teachers, ...(context.setup.teachers || []).filter(teacher => teacher.id === booking.teacherId && !options.teachers.some(option => option.id === teacher.id))]
    .filter(teacher => kind === 'rehearsal' ? teachesBand(teacher.id) : kind === 'studio' ? engineeringLevel(teacher.id) >= 1 : true)
  const subscriptions = matchingSubscriptions(context.data, booking.studentIds[0], booking.serviceId, serviceOptions.find(item => item.id === booking.serviceId)?.values.name || '')
  const submit = (action: 'staff' | 'send', accepted = false, sendConfirmed = false) => {
    setSubmitted(true)
    if (kind === 'studio' && !booking.teacherId) { setError('Choose a studio engineer.'); return }
    if (kind === 'rehearsal' && !booking.groupId && !participants.length) { setError('Choose a band or at least one participant.'); return }
    if (reason) { setError(reason); return }
    if (lesson && booking.arrangement === 'Monthly subscription' && subscriptions.length && !accepted) { setPendingAction(action); return }
    if (lesson && action === 'send' && !sendConfirmed) { setPendingAction(action); setConfirmSend(true); return }
    const service = serviceOptions.find(item => item.id === booking.serviceId)
    const result = onSave({ ...booking, title: booking.title.trim() || (block ? 'Unavailable' : lesson ? service?.values.name || 'Lesson' : kind === 'studio' ? 'Studio booking' : kind === 'rehearsal' ? context.groups.find(group => group.id === booking.groupId)?.name || 'Band rehearsal' : 'Event') }, action)
    if (result) setError(result)
    setPendingAction(null); setConfirmSend(false)
  }
  const selectedTeacher = context.setup.teachers?.find(teacher => teacher.id === booking.teacherId)
  const selectedRoom = roomRecords(context.setup).find(room => room.id === constraints.roomId)
  const title = lesson ? selectedTeacher ? `Lesson with ${selectedTeacher.values.name}` : constraints.serviceId ? `${serviceOptions.find(service => service.id === constraints.serviceId)?.values.name || 'Lesson'} booking` : 'Lesson details' : block ? 'Block / unavailable' : duty ? staffDutyLabel(kind) : kind === 'studio' ? 'Studio booking' : kind === 'rehearsal' ? 'Band rehearsal' : 'Event'
  const fieldError = (pattern: RegExp) => submitted && error && pattern.test(error) ? error : undefined
  const choose = (next: CalendarBookingKind | 'duty', single = false) => {
    const kindNext: CalendarBookingKind = next === 'duty' ? 'admin' : next
    if (kindNext === 'lesson' && onStartLesson) { onStartLesson(single); return }
    pathDrafts.current[kind] = booking
    const previous = pathDrafts.current[kindNext]
    patch({ ...(previous || { studentIds: [], groupId: '', serviceId: initial.serviceId || '', title: '', locationId: '', notes: '', roomId: '', requiredCapacity: undefined }), kind: kindNext, date: booking.date, time: booking.time, until: booking.until, arrangement: single ? 'À-la-carte' : 'Monthly subscription', teacherId: kindNext === 'studio' ? '' : previous?.teacherId || initial.teacherId || '', duration: kindNext === 'lesson' ? (booking.duration >= 60 ? 60 : 30) : previous?.duration || initial.duration || 30, repeat: kindNext === 'block' || isStaffDuty(kindNext) ? previous?.repeat || 'once' : 'once', ...(kindNext === 'rehearsal' ? { studentIds: [] } : {}) })
    setScreen('details')
  }
  const paths = [
    { id: 'lesson', label: 'Lesson', icon: Music },
    { id: 'single', label: 'Single lesson / Free trial', icon: Sparkles },
    { id: 'studio', label: 'Studio booking', icon: DoorOpen },
    { id: 'rehearsal', label: 'Band rehearsal', icon: Users },
    { id: 'event', label: 'Event', icon: CalendarDays },
    { id: 'duty', label: 'Administrative time', icon: Users },
    { id: 'block', label: 'Block / unavailable', icon: Ban },
  ] as const
  const teachesBand = (teacherId: string) => {
    const teacher = context.setup.teachers?.find(item => item.id === teacherId)
    if (!teacher) return false
    let assignments: { serviceId: string }[] = []
    try { assignments = JSON.parse(teacher.values.assignments || '[]') } catch { assignments = [] }
    return assignments.some(item => serviceOptions.some(service => service.id === item.serviceId && /band|ensemble/i.test(service.values.name)))
  }
  // The calendar column already says what this person or space can host.
  const availablePaths = paths.filter(path => {
    if (blockOnly) return path.id === 'block'
    const nextKind: CalendarBookingKind = path.id === 'single' ? 'lesson' : path.id === 'duty' ? 'admin' : path.id
    const probe = { ...booking, kind: nextKind, studentIds: [], groupId: '', requiredCapacity: undefined }
    if (initial.source === 'teacher') {
      // A teacher cannot hire themselves out as a room, and events are not their diary entry.
      if (nextKind === 'event') return false
      if (nextKind === 'studio') return engineeringLevel(constraints.teacherId || '') >= 1
      if (nextKind === 'rehearsal') return teachesBand(constraints.teacherId || '')
      return true
    }
    if (initial.source === 'room') {
      // Duties belong to staff, not to a room.
      if (isStaffDuty(nextKind)) return false
    } else if (nextKind === 'block' || isStaffDuty(nextKind)) return true
    if (!selectedRoom) return true
    if (nextKind === 'lesson') return serviceOptions.some(service => roomSupportsBooking(context, { ...probe, serviceId: service.id }, selectedRoom))
    return roomSupportsBooking(context, { ...probe, serviceId: '' }, selectedRoom)
  })
  if (pendingAction) return <Modal key="confirmation" isOpen size="md" ariaLabel={confirmSend ? 'Send enrollment request' : 'Existing subscription'} onClose={() => { setPendingAction(null); setConfirmSend(false) }}>
    <ModalHeader title={confirmSend ? 'Send enrollment request' : 'Existing subscription'} onClose={() => { setPendingAction(null); setConfirmSend(false) }} />
    <ModalBody>{confirmSend ? <p>Send a portal enrollment request to {account?.holderName} · {account?.email || 'No email available'}.</p> : <p>This student already has an active subscription for this lesson type. Do you want to start a new subscription?</p>}</ModalBody>
    <ModalFooter><Button variant="secondary" onClick={() => { setPendingAction(null); setConfirmSend(false) }}>Cancel</Button><Button disabled={confirmSend && !account?.email} onClick={() => submit(pendingAction, true, confirmSend)}>{confirmSend ? 'Send request' : 'Continue'}</Button></ModalFooter>
  </Modal>
  return <Modal key="booking" isOpen size="lg" layout="fixed" ariaLabel="Add booking" style={{ height: 'min(82dvh, 760px)', maxHeight: '90dvh' }} onClose={onClose}>
    <ModalHeader title={screen === 'cards' ? initial.source === 'teacher' ? `Book time with ${selectedTeacher?.values.name || 'this teacher'}` : selectedRoom ? `Book room ${selectedRoom.name}` : 'Add booking' : title} onBack={screen === 'details' && initial.source !== 'service' && !blockOnly ? () => { setScreen('cards'); setSubmitted(false); setError('') } : undefined} onClose={onClose} />
    <ModalBody style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
      {screen === 'cards' ? <div className={entryStyles.choices} style={{ gap: spacing.lg }} aria-label="Booking type">
        {availablePaths.map(path => <EntryPathCard key={path.id} title={path.label} action="Choose" onChoose={() => choose(path.id === 'single' ? 'lesson' : path.id, path.id === 'single')}><path.icon size={28} /></EntryPathCard>)}
      </div> : <>
        {selectedRoom && <strong>{selectedRoom.name} · capacity {selectedRoom.capacity}</strong>}
        {initial.replacementScope && <Notice>Replacing {initial.replacementScope === 'occurrence' ? 'this occurrence only' : 'this and future occurrences'} from {initial.date}. Earlier assignments remain unchanged.</Notice>}
        {lesson && <div>
          {studentSearch
            ? <SearchSelect fieldLabel="Student" label="Search students" defaultOpen options={studentOptions.map(student => ({ value: student.id, label: `${student.firstName} ${student.lastName}` }))} onSelect={value => { patch({ studentIds: [value] }); setStudentSearch(false) }} onClose={() => setStudentSearch(false)} />
            : <>
              <span style={{ display: 'block', marginBottom: spacing.xs, color: colors.text, fontFamily: typography.fontSans, fontSize: typography.sizeSm, fontWeight: typography.weightMedium }}>Student</span>
              <Button variant="secondary" aria-label="Choose a student" onClick={() => setStudentSearch(true)}>{chosenStudent ? `${chosenStudent.firstName} ${chosenStudent.lastName}` : 'Search students'}</Button>
            </>}
          {submitted && !booking.studentIds.length && <Notice variant="error">Choose a student.</Notice>}
          {!studentOptions.length && <p role="status">Everyone who already holds this lesson type is hidden. Choose a different service.</p>}
        </div>}
        {lesson && <Select error={submitted && !booking.serviceId ? 'Choose a service.' : fieldError(/service/i)} label="Lesson service" disabled={Boolean(constraints.serviceId)} value={booking.serviceId} onChange={event => { const serviceId = event.target.value; const offered = durationsFor(serviceId); patch({ serviceId, ...(offered.length && !offered.includes(booking.duration) ? { duration: offered[0] } : {}) }) }}><option value="">Choose a service</option>{[...options.services, ...serviceOptions.filter(service => service.id === booking.serviceId && !options.services.some(option => option.id === service.id))].map(service => <option key={service.id} value={service.id}>{service.values.name}</option>)}</Select>}
        {!lesson && !duty && <Input label={block ? 'Block reason' : 'Booking name'} value={booking.title} onChange={event => patch({ title: event.target.value })} placeholder={block ? 'e.g. Maintenance or personal time' : 'Optional name'} />}
        {duty && <DenseSectionPanel title="Duty details" headingLevel="h3" contentStyle={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
          <FieldGrid>
          {kind === 'front-desk' ? <p>Admin · Front desk (legacy assignment)</p> : <Select label="Duty" value={booking.responsibilityId || ''} onChange={event => patch({ responsibilityId: event.target.value })}><option value="">Choose a duty</option>{(context.setup.adminResponsibilities || []).filter(item => item.values.enabled !== 'No').map(item => <option key={item.id} value={item.id}>{item.values.name}</option>)}</Select>}
          <Select label="Location" value={booking.locationId || ''} onChange={event => patch({ locationId: event.target.value, roomId: '' })}><option value="">Choose a location</option>{context.setup.locations.map(location => <option key={location.id} value={location.id}>{location.values.name}</option>)}</Select>
          </FieldGrid>
          <Textarea label="Notes" rows={2} hint="Optional details about this scheduled work." value={booking.notes || ''} onChange={event => patch({ notes: event.target.value })} />
          {!context.setup.adminResponsibilities?.some(item => item.values.enabled !== 'No') && <Notice>Configure duties under School Setup → Administrative time first.</Notice>}
          {!options.teachers.length && <Notice>Enable “Can be scheduled for administrative time” in staff setup to assign non-teaching work.</Notice>}
        </DenseSectionPanel>}
        {duty && <DenseSectionPanel title="Schedule" headingLevel="h3">
          <FieldGrid>
            <Input label="Booking date" type="date" disabled={Boolean(initial.replacementScope)} value={booking.date} onChange={event => patch({ date: event.target.value, until: event.target.value })} />
            <Select label="Start time" value={booking.time} onChange={event => patch({ time: event.target.value })}>{timeOptions.map(({ time }) => <option key={time} value={time}>{time}</option>)}</Select>
            <Select label="Duration" value={booking.duration} onChange={event => patch({ duration: Number(event.target.value) })}>{durationOptions.map(value => <option key={value} value={value}>{value} minutes</option>)}</Select>
            <Select label="Assigned staff" disabled={Boolean(constraints.teacherId)} value={booking.teacherId} onChange={event => patch({ teacherId: event.target.value })}><option value="">Choose eligible staff</option>{eligibleTeachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.values.name}</option>)}</Select>
            <Select label="Room (optional)" disabled={Boolean(constraints.roomId)} value={booking.roomId} onChange={event => patch({ roomId: event.target.value })}><option value="">No room</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.name} · capacity {room.capacity}</option>)}</Select>
            <Select label="Repeat" disabled={Boolean(initial.replacementScope)} value={booking.repeat} onChange={event => patch({ repeat: event.target.value as 'once' | 'weekly' })}><option value="once">Does not repeat</option><option value="weekly">Every week</option></Select>
            {booking.repeat === 'weekly' && <Input label="Repeat through" type="date" disabled={Boolean(initial.replacementScope)} min={booking.date} value={booking.until} onChange={event => patch({ until: event.target.value })} />}
          </FieldGrid>
          <p style={{ ...typography.helper, color: colors.textSecondary, marginTop: spacing.md }}>Scheduled work only—not attendance, approved hours or pay. Admin work cannot replace a protected teaching break.</p>
        </DenseSectionPanel>}
        {!duty && <>
        <FieldGrid><Input error={submitted && (!booking.date || reason?.includes("date") || reason?.includes("closed")) ? reason || "Choose a date." : undefined} label="Booking date" type="date" value={booking.date} onChange={event => patch({ date: event.target.value, until: event.target.value })} /><Select error={submitted && reason && /time|gap|rest|booking|unavailable|blocked/.test(reason) ? reason : undefined} label="Start time" value={booking.time} onChange={event => patch({ time: event.target.value })}>{timeOptions.map(({ time, available }) => <option key={time} value={time} disabled={!available}>{time}{available ? '' : ' · unavailable'}</option>)}</Select></FieldGrid>
        {lesson && booking.serviceId && preferenceReason && <p role="status">{preferenceReason}</p>}
        <Select error={submitted && reason?.includes("increments") ? reason : undefined} label="Duration" value={booking.duration} onChange={event => patch({ duration: Number(event.target.value) })}>{durationOptions.map(value => <option key={value} value={value}>{value} minutes</option>)}</Select>
        <FieldGrid>{<Select error={submitted && (lesson || kind === 'studio') && !booking.teacherId ? 'Choose an available teacher.' : fieldError(/teacher|engineer/i)} label={duty ? 'Assigned staff' : lesson ? 'Teacher' : kind === 'studio' ? 'Studio engineer' : 'Teacher (optional)'} disabled={Boolean(constraints.teacherId)} value={booking.teacherId} onChange={event => patch({ teacherId: event.target.value })}><option value="">{duty ? 'Choose eligible staff' : lesson ? 'Choose a teacher' : kind === 'studio' ? 'Choose an engineer' : 'No teacher'}</option>{eligibleTeachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.values.name}</option>)}</Select>}<Select error={submitted && !booking.roomId && !duty && (!block || !booking.teacherId) ? 'Choose an available room.' : fieldError(/room|capacity/i)} label={block || duty ? 'Room (optional)' : 'Room'} disabled={Boolean(constraints.roomId)} value={booking.roomId} onChange={event => patch({ roomId: event.target.value })}><option value="">{block || duty ? 'No room' : 'Choose a room'}</option>{[...rooms, ...roomRecords(context.setup).filter(room => room.id === booking.roomId && !rooms.some(option => option.id === room.id))].map(room => <option key={room.id} value={room.id}>{room.name} · capacity {room.capacity}</option>)}</Select></FieldGrid>

        {lesson && <Select label="Lesson arrangement" value={booking.arrangement || 'Monthly subscription'} onChange={event => patch({ arrangement: event.target.value as CalendarBooking['arrangement'] })}><option value="À-la-carte">À-la-carte · one lesson</option><option value="Monthly subscription">Ongoing · monthly subscription</option></Select>}
        {lesson && <p role="status">This time is only held once enrollment is complete.</p>}
        {kind === 'rehearsal' && !eligibleTeachers.length && <Notice>No band-qualified staff are available at this time. Choose another time or assign band teaching in staff setup.</Notice>}
        {kind === 'studio' && !eligibleTeachers.length && <Notice>No studio engineer is available at this time. Choose another time or set a studio engineering level in staff setup.</Notice>}
        {kind === 'event' && <Input label="Required event capacity" type="number" min={1} value={booking.requiredCapacity || ''} error={fieldError(/capacity/)} onChange={event => patch({ requiredCapacity: Number(event.target.value) || undefined })} />}
        {!lesson && !block && !duty && <>
          <Select error={fieldError(/band|participant/i)} label={kind === 'rehearsal' ? 'Band' : 'Band (optional)'} value={booking.groupId} onChange={event => patch({ groupId: event.target.value })}><option value="">No band</option>{context.groups.map(group => <option key={group.id} value={group.id}>{group.name} · {group.memberIds.length} members</option>)}</Select>
          <details><summary>Participants{participants.length ? ` · ${participants.length} selected` : ''}</summary><div style={{ maxHeight: 180, overflowY: 'auto', marginTop: spacing.md }}>{peopleOptions.map(person => <Checkbox key={person.id} label={person.name} checked={participants.includes(person.id)} onChange={event => patch({ participantIds: event.target.checked ? [...participants, person.id] : participants.filter(id => id !== person.id) })} />)}</div></details>
        </>}
        {(block || duty) && <>
          <Select label="Repeat" value={booking.repeat} onChange={event => patch({ repeat: event.target.value as 'once' | 'weekly' })}><option value="once">Does not repeat</option><option value="weekly">Every week</option></Select>
          {booking.repeat === 'weekly' && <Input error={submitted && reason?.includes("end date") ? reason : undefined} label="Repeat through" type="date" min={booking.date} value={booking.until} onChange={event => patch({ until: event.target.value })} />}
        </>}
        {!block && !duty && !rooms.length && <p role="status">No suitable rooms available for this activity and time.</p>}
        </>}
        {submitted && error && <Notice variant="error">{error}</Notice>}
      </>}
    </ModalBody>
    {screen === 'details' && <ModalFooter>{lesson && <Button variant="secondary" onClick={() => submit('send')}>Send enrollment request</Button>}<Button onClick={() => submit('staff')}>{duty ? 'Save administrative time' : block ? 'Save block' : lesson ? 'Continue enrollment' : 'Add booking'}</Button></ModalFooter>}
  </Modal>
}
