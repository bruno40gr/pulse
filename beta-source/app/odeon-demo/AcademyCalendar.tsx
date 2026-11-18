'use client'

import { PageHeader } from '@/components/ui/PageHeader'
import { PageContainer } from '@/components/ui/PageContainer'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { FamilyPreviewData } from '@/beta-source/lib/academy-family-preview'
import type { AcademyGroup } from '@/beta-source/lib/academy-explorer'
import type { ExplorerEvent } from '@/beta-source/lib/event-explorer'
import type { SetupRecord } from '@/beta-source/app/content-studio-prototype/school-setup/setup-content'
import { betaCalendarOccurrences, betaShiftDate, betaWeekDates, betaWeekdayName, betaWeekStart, type CalendarOccurrence } from '@/beta-source/lib/beta-academy-calendar'
import { betaAcademyTeachers, betaAvailableTeachers, type BetaTeachingLoad } from '@/beta-source/lib/beta-academy-schedule'
import { expandPreviewCalendar } from '@/beta-source/lib/academy-makeup-preview'
import ContactBulkComposer from '@/components/inbox/ContactBulkComposer'
import StudentWorkspaceV3 from '../content-studio-prototype/students/StudentWorkspaceV3'
import { CalendarFilter } from './CalendarFilters'
import CalendarBookingModal, { type BookingPrefill } from './CalendarBookingModal'
import { useCalendarEnrollment } from './CalendarEnrollmentContext'
import { BookableSlot } from './BookableSlot'
import { bookingReason, saveCalendarBooking, roomRecords, configuredBlocks, isStaffDuty, staffDutyLabel, type CalendarBooking } from '@/beta-source/lib/academy-calendar-booking'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { ChevronLeft, ChevronRight, Check, X, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ControlButton } from '@/components/ui/ControlButton'
import { CalendarTimeGrid } from '../content-studio-prototype/enrollment/CalendarTimeGrid'
import { CalendarBookingBlock } from '../content-studio-prototype/enrollment/CalendarBookingBlock'
import { previewCalendarLessons, type PreviewMakeup, type MakeupPreviewState } from '@/beta-source/lib/academy-makeup-preview'
import { calendarResources, calendarResourceIds, calendarServiceName, type CalendarPerspective } from '@/beta-source/lib/academy-calendar-resources'
import { placeCalendarBlocks } from '@/beta-source/lib/academy-calendar-layout'
import { calendarServiceStyle } from '@/lib/calendar-appearance'
import calendarStyles from '../content-studio-prototype/enrollment/enrollment.module.css'
import { Select } from '@/components/ui/Select'
import { Tabs } from '@/components/ui/Tabs'
import { workspaceInitial } from '@/beta-source/lib/academy-student-preview'
import { Notice } from '@/components/ui/Notice'
import { SlidePanel } from '@/components/ui/SlidePanel'
import { SlidePanelHeader } from '@/components/ui/SlidePanelHeader'
import { useIsMobile } from '@/lib/useMediaQuery'
import { attendanceOutcomes, changeSessionOccurrence, markParticipantAttendance } from '@/beta-source/lib/academy-session'
import { colors, radius, spacing, typography } from '@/lib/tokens'

type Filters = { staff: string[]; room: string[]; service: string[] }

const blankFilters: Filters = { staff: [], room: [], service: [] }
const startMinutes = 9 * 60
const endMinutes = 21 * 60
const rows = Math.round((endMinutes - startMinutes) / 15)
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
const dayName = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })

export default function AcademyCalendar({ data, groups, events, setup, today, onApply, makeups, onDemoChange, onSetup, onEnroll, initialReschedule, initialScope }: {
  onEnroll: (booking: CalendarBooking, action: 'staff' | 'send') => void
  /** Lesson to open for rescheduling on arrival, so other surfaces can deep-link here. */
  initialReschedule?: string
  initialScope?: { kind: 'student' | 'family'; id: string }
  onSetup: (setup: Record<string, SetupRecord[]>) => void
  makeups?: MakeupPreviewState
  onDemoChange?: (data: FamilyPreviewData, makeups: MakeupPreviewState) => void
  data: FamilyPreviewData
  groups: readonly AcademyGroup[]
  events: readonly ExplorerEvent[]
  load: readonly BetaTeachingLoad[]
  setup: Record<string, SetupRecord[]>
  today: string
  onExit: () => void
  onApply: (change: (current: FamilyPreviewData) => FamilyPreviewData) => void
}) {
  const sharedBooking = useCalendarEnrollment()
  const mobile = useIsMobile()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [week, setWeek] = useState(() => betaWeekStart(today))
  const [dayMode, setDayMode] = useState(true)
  const [perspective, setPerspective] = useState<CalendarPerspective>('teacher')
  const [weekResource, setWeekResource] = useState('')
  const [anchor, setAnchor] = useState({ top: 100, left: 100 })
  const inspectorRef = useRef<HTMLDivElement>(null)
  const blockRef = useRef<HTMLElement | null>(null)
  const returnScroll = useRef({ x: 0, y: 0 })
  const [focusDate, setFocusDate] = useState(today)
  const [filters, setFilters] = useState<Filters>(blankFilters)
  const [selected, setSelected] = useState<CalendarOccurrence | null>(null)
  const [booking, setBooking] = useState<BookingPrefill | null>(null)
  const [showUnavailable, setShowUnavailable] = useState(true)
  const drawing = useRef<{ date: string; time: string; resource: string; column: string } | null>(null)
  const [drawEnd, setDrawEnd] = useState<string | null>(null)
  useEffect(() => {
    const clear = () => { drawing.current = null; setDrawEnd(null) }
    window.addEventListener('pointerup', clear)
    window.addEventListener('pointercancel', clear)
    return () => { window.removeEventListener('pointerup', clear); window.removeEventListener('pointercancel', clear) }
  }, [])
  const [message, setMessage] = useState<{ contactId: string; channel: 'sms' | 'email' } | null>(null)
  const [studentPanel, setStudentPanel] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [reschedule, setReschedule] = useState<CalendarOccurrence | null>(null)
  // The reschedule is the calendar in a mode: candidate cells on the same grid, not another grid.
  const [scope, setScope] = useState<{ kind: 'student' | 'family'; id: string } | null>(initialScope || null)
  const [pick, setPick] = useState<{ date: string; time: string; teacher: string; program: string } | null>(null)
  const rescheduleConsumed = useRef(false)
  // Where the reschedule was opened from, read after mount so the header does not diverge on hydration.
  const [backLabel, setBackLabel] = useState('Calendar')
  const [done, setDone] = useState<{ title: string; when: string; teacher: string } | null>(null)
  useEffect(() => { if (new URLSearchParams(window.location.search).get('backTo') === 'record') setBackLabel('Family') }, [])
  // A cancellation records why it happened, because billing, make-ups and the family
  // message all follow from that answer, not from the status string alone.
  const [cancelTarget, setCancelTarget] = useState<CalendarOccurrence | null>(null)
  const [cancelReason, setCancelReason] = useState('Family cancelled')
  const [cancelCredit, setCancelCredit] = useState(true)
  const [cancelCharge, setCancelCharge] = useState(false)

  const dates = useMemo(() => (dayMode ? [focusDate] : betaWeekDates(week)), [dayMode, focusDate, week])
  // The same recurring expansion the family portal sees, so both agree.
  const expanded = useMemo(() => expandPreviewCalendar(data, dates[dates.length - 1]), [data, dates])
  const occurrences = useMemo(() => betaCalendarOccurrences({ ...expanded, calendarBookings: [...(expanded.calendarBookings || []), ...configuredBlocks(setup)] }, groups, events, dates).map(item => {
    const booking = [...(expanded.calendarBookings || []), ...configuredBlocks(setup)].find(booking => booking.id === item.bookingId)
    return booking ? { ...item, room: roomRecords(setup).find(room => room.id === booking.roomId)?.name || '', teacherName: setup.teachers.find(teacher => teacher.id === booking.teacherId)?.values.name || '' } : item
  }), [expanded, groups, events, dates, setup])
  // The scope is the difference between the whole school and one family's week.
  const scopeSummary = useMemo(() => {
    if (!scope) return null
    if (scope.kind === 'student') {
      const student = data.students.find(item => item.id === scope.id)
      if (!student) return null
      return { name: `${student.firstName} ${student.lastName}`.trim(), lessons: student.enrollments.map(item => item.program).filter(Boolean), teachers: Array.from(new Set(student.enrollments.map(item => item.teacher).filter(Boolean))) }
    }
    const account = data.accounts.find(item => item.id === scope.id)
    if (!account) return null
    const students = data.students.filter(item => account.studentIds.includes(item.id))
    return { name: account.holderName, lessons: Array.from(new Set(students.flatMap(item => item.enrollments.map(enrollment => enrollment.program)).filter(Boolean))), teachers: Array.from(new Set(students.flatMap(item => item.enrollments.map(enrollment => enrollment.teacher)).filter(Boolean))) }
  }, [scope, data])
  const scopeStudents = useMemo(() => {
    if (!scope) return null
    if (scope.kind === 'student') return new Set([scope.id])
    const account = data.accounts.find(item => item.id === scope.id)
    return new Set(account ? account.studentIds : [])
  }, [scope, data])
  const visible = useMemo(() => occurrences.filter(item => (showUnavailable || item.kind !== 'block') &&
    (!filters.staff.length || calendarResourceIds(item, 'teacher', setup).some(id => filters.staff.includes(id))) &&
    (!filters.room.length || filters.room.includes(item.room || 'Unassigned')) &&
    (!filters.service.length || filters.service.includes(calendarServiceName(item, setup)))), [occurrences, filters, setup, showUnavailable])
  const academyTeachers = useMemo(() => betaAcademyTeachers(setup), [setup])

  const resources = useMemo(() => calendarResources(perspective, setup, occurrences), [perspective, setup, occurrences])
  const resourceFilter = perspective === 'teacher' ? filters.staff : perspective === 'room' ? filters.room : filters.service
  const shownResources = resources.filter(resource => !resourceFilter.length || resourceFilter.includes(resource.id))
  const activeResource = weekResource ? shownResources.find(resource => resource.id === weekResource) : undefined
  const filterCount = filters.staff.length + filters.room.length + filters.service.length + Number(!showUnavailable) + Number(Boolean(weekResource))
  const resetFilters = () => { setFilters(blankFilters); setWeekResource(''); setShowUnavailable(true); setSelected(null) }
  const allWeek = !dayMode && !activeResource
  const columns = dayMode
    ? shownResources.map(resource => ({ id: resource.id, date: focusDate, resource }))
    : dates.map(date => ({ id: date, date, resource: activeResource || { id: '', name: 'All' } }))
  const times = Array.from({ length: rows }, (_, index) => clock(startMinutes + index * 15))
  const taskItem = reschedule ? previewCalendarLessons(expanded, [], workspaceInitial).find(item => item.id === (reschedule.participantLessonIds?.[0] || reschedule.id)) : undefined
  // While rescheduling the columns are days, not resources: the slot is the decision, and the
  // teacher follows from it, so a cell can never mean two different teachers at once.
  // Candidate times per visible day: computed once so every cell answers from one set, and so
  // the cells and the confirm button cannot disagree about what is available.
  // Rescheduling is a week of days: the decision is "which day and time", and the teacher
  // comes from whoever is free there.
  const rescheduleDates = useMemo(() => betaWeekDates(week).slice(0, 6), [week])
  const gridColumns = reschedule && taskItem ? rescheduleDates.map(date => ({ id: date, date, resource: { id: '', name: '' } })) : columns
  // Dotted candidate blocks, one per open time, naming who could teach it.
  const candidateBlocks = useMemo(() => {
    if (!reschedule || !taskItem) return []
    const staff = new Set(filters.staff)
    const blocks: { date: string; time: string; teachers: string[] }[] = []
    for (const date of rescheduleDates) {
      const byTime = new Map<string, string[]>()
      for (const slot of replacementSlots(date)) {
        if (staff.size) {
          const teacher = setup.teachers.find(item => item.values.name === slot.teacher)
          if (!teacher || !staff.has(teacher.id)) continue
        }
        byTime.set(slot.time, Array.from(new Set([...(byTime.get(slot.time) || []), slot.teacher])))
      }
      byTime.forEach((teachers, time) => { if (!(date === reschedule.date && time === reschedule.start)) blocks.push({ date, time, teachers }) })
    }
    return blocks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reschedule, taskItem, rescheduleDates, filters.staff, data, groups, events, setup])
  const candidateTimes = useMemo(() => {
    const map = new Map<string, Set<string>>()
    if (!reschedule || !taskItem) return map
    for (const date of dates) {
      for (const slot of replacementSlots(date)) {
        const key = `${date}|${slot.program}`
        if (!map.has(key)) map.set(key, new Set())
        map.get(key)!.add(slot.time)
      }
    }
    return map
    // replacementSlots is rebuilt every render; the week's candidates only change with these inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reschedule, taskItem, rescheduleDates, filters.staff, data, groups, events, setup])

  // The lesson may sit in a week the calendar is not showing; go there before looking for it.
  // A scoped week is a week: one day of it is not the family's week.
  useEffect(() => {
    if (!scope) return
    setDayMode(false)
    setPerspective('teacher')
  }, [scope])
  useEffect(() => {
    if (!reschedule || !taskItem) return
    setPerspective('service')
    setDayMode(true)
    const teacher = setup.teachers.find(item => item.values.name === taskItem.teacher)
    setFilters(current => ({ ...current, staff: teacher ? [teacher.id] : current.staff }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reschedule?.id, taskItem?.teacher])
  useEffect(() => {
    if (!initialReschedule) return
    const date = initialReschedule.match(/(\d{4}-\d{2}-\d{2})$/)?.[1]
    if (date && !betaWeekDates(week).includes(date)) { setWeek(betaWeekStart(date)); setFocusDate(date) }
  }, [initialReschedule, week])

  useEffect(() => {
    if (!initialReschedule || reschedule || rescheduleConsumed.current) return
    // A lesson list names an occurrence `<enrollment>:calendar:<date>`; the grid names its own
    // sessions. Accept either reference so a handoff from the record always finds its lesson.
    const [enrollmentId, date] = initialReschedule.split(':calendar:')
    const match = visible.find(item => item.id === initialReschedule || (date && item.enrollmentId === enrollmentId && item.date === date))
    if (match) { rescheduleConsumed.current = true; setReschedule(match) }
    setPick(null)
    // The lesson may sit outside the visible week; the link still arrives, it just waits.
  }, [initialReschedule, visible, reschedule])

  useEffect(() => {
    if (!selected || reschedule) return
    inspectorRef.current?.focus({ preventScroll: true })
    const close = () => { setSelected(null); blockRef.current?.focus({ preventScroll: true }) }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    const outside = (event: PointerEvent) => {
      if (!inspectorRef.current?.contains(event.target as Node) && !blockRef.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('keydown', key)
    document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', outside) }
  }, [selected, reschedule])

  // One wording for the lesson, used by the card and the candidate blocks alike.
  function lessonTitle(item: NonNullable<typeof taskItem>) {
    const enrollment = item.student.enrollments.find(entry => entry.program === item.program) || item.student.enrollments[0]
    return `${item.program}${enrollment?.level ? `, Level ${enrollment.level}` : ''}`
  }
  function dayShort(date: string) { return dayName(date) }
  function timeShort(value: string) { const [h, m] = value.split(':').map(Number); const suffix = h >= 12 ? 'pm' : 'am'; const hour = h % 12 === 0 ? 12 : h % 12; return m ? `${hour}:${String(m).padStart(2, '0')}${suffix}` : `${hour}${suffix}` }

  useEffect(() => {
    if (!reschedule || !taskItem) return
    const teacher = setup.teachers.find(item => item.values.name === taskItem.teacher)
    if (teacher) setFilters(current => ({ ...current, staff: [teacher.id] }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reschedule?.id, taskItem?.teacher])

  function replacementSlots(date: string): NonNullable<PreviewMakeup['booking']>[] {
    if (!reschedule || !taskItem || date < today) return []
    const snapshot = expandPreviewCalendar(data, date)
    const conflicts = betaCalendarOccurrences(snapshot, groups, events, [date]).filter(item => item.id !== reschedule.id && item.status !== 'Cancelled' && item.kind !== 'block')
    const busyLoad: BetaTeachingLoad[] = conflicts.map(item => ({ teacherId: item.teacherId, teacher: item.teacherName, date: item.date, time: item.start, duration: minutesOf(item.end) - minutesOf(item.start), studentId: item.studentIds[0] || '', room: item.room }))
    return times.filter(time => minutesOf(time) % 30 === 0).flatMap(time => {
      const duration = taskItem.duration
      if (minutesOf(time) + duration > endMinutes) return []
      const overlap = (item: CalendarOccurrence) => minutesOf(time) < minutesOf(item.end) && minutesOf(item.start) < minutesOf(time) + duration
      if (conflicts.some(item => overlap(item) && (item.studentIds.some(id => reschedule.studentIds.includes(id)) || (reschedule.room && (item.rooms || [item.room]).includes(reschedule.room))))) return []
      return betaAvailableTeachers(academyTeachers, { instrument: taskItem.program, duration }, date, time, busyLoad, taskItem.student.id)
        .filter(teacher => !conflicts.some(item => overlap(item) && ((item.teacherIds || []).includes(teacher.id) || (item.teacherNames || [item.teacherName]).includes(teacher.name))))
        .filter(teacher => !bookingReason({ data: snapshot, setup, groups, occurrences: conflicts }, { id: reschedule.id, kind: 'lesson', title: reschedule.title, date, time, duration, teacherId: teacher.id, roomId: roomRecords(setup).find(room => room.name === reschedule.room)?.id || '', serviceId: reschedule.serviceId || '', studentIds: reschedule.studentIds, groupId: '', repeat: 'once', until: date, publicOnly: false, status: 'Scheduled' }, false))
        .map(teacher => ({ date, time, teacher: teacher.name, program: taskItem.program }))
    })
  }

  function leaveReschedule() {
    const query = new URLSearchParams(window.location.search)
    if (query.get('backTo') === 'record') {
      const next = new URLSearchParams({ view: 'quick', section: 'enrollments' })
      if (query.get('account')) next.set('account', query.get('account')!)
      if (query.get('student')) next.set('student', query.get('student')!)
      window.location.assign(`/odeon-demo?${next}`)
      return
    }
    const next = new URLSearchParams({ screen: 'calendar' })
    if (query.get('scope')) next.set('scope', query.get('scope')!)
    window.location.assign(`/odeon-demo?${next}`)
  }

  function finishReschedule() {
    setReschedule(null); setSelected(null); setPick(null)
    requestAnimationFrame(() => {
      window.scrollTo(returnScroll.current.x, returnScroll.current.y)
      blockRef.current?.focus({ preventScroll: true })
    })
  }

  const studentOf = (id: string) => data.students.find(student => student.id === id)
  const selectedStudent = selected?.studentIds[0] ? studentOf(selected.studentIds[0]) : undefined

  function cancelOccurrence() {
    const target = cancelTarget || selected
    if (!target) return
    onApply(current => changeSessionOccurrence(expandPreviewCalendar(current, target.date), target.id, {
      status: 'Cancelled',
      cancellation: { reason: cancelReason, credited: cancelCredit, charged: cancelCharge, at: new Date().toISOString() },
    }))
    setNotice(`Cancelled ${target.title} on ${dayName(target.date)} · ${cancelReason}${cancelCredit ? ' · make-up credited' : ' · no make-up'}${cancelCharge ? ' · charged' : ' · not charged'}`)
    setCancelTarget(null); setSelected(null)
  }

  function applyReschedule(booking: NonNullable<PreviewMakeup['booking']>) {
    if (!reschedule || !replacementSlots(booking.date).some(slot => slot.time === booking.time && slot.teacher === booking.teacher)) return 'Choose an available lesson time.'
    const original = reschedule
    onApply(current => {
      const snapshot = expandPreviewCalendar(current, original.date > booking.date ? original.date : booking.date)
      return changeSessionOccurrence(snapshot, original.id, { date: booking.date, time: booking.time, teacher: booking.teacher })
    })
    setNotice(`Moved ${original.title} to ${dayName(booking.date)} at ${booking.time}.`)
    finishReschedule()
    return null
  }

  const bookingContext = { data: expanded, setup, groups, occurrences, audience: 'staff' as const }
  const slots = roomRecords(setup)
  function defaults(date: string, time: string, resourceId?: string): BookingPrefill {
    return { date, time, duration: 30, source: resourceId && resourceId !== 'Unassigned' ? perspective : undefined,
      teacherId: perspective === 'teacher' && resourceId && resourceId !== 'Unassigned' ? resourceId : undefined,
      roomId: perspective === 'room' ? slots.find(room => room.name === resourceId)?.id : undefined,
      serviceId: perspective === 'service' ? setup.services.find(service => service.values.name === resourceId)?.id : undefined }
  }
  function bookSlot(date: string, time: string, resourceId?: string, duration = 30) {
    const initial = { ...defaults(date, time, resourceId), duration }
    if (sharedBooking?.openBooking) sharedBooking.openBooking(initial)
    else setBooking(initial)
    setSelected(null)
  }
  function slotReason(date: string, time: string, resourceId: string, duration = 30) {
    if (!resourceId) return null // Overview selection opens resource choice; it does not promise availability.
    const initial = defaults(date, time, resourceId)
    const base: CalendarBooking = { id: 'availability-probe', kind: 'studio', title: '', date, time, duration, serviceId: initial.serviceId || '', teacherId: initial.teacherId || '', roomId: initial.roomId || '', studentIds: [], groupId: '', repeat: 'once', until: date, publicOnly: false, status: 'Scheduled' }
    if (perspective === 'room') return bookingReason(bookingContext, base, false)
    if (perspective === 'teacher') {
      const reason = bookingReason(bookingContext, base, false)
      if (reason) return reason
      if (!slots.some(room => !bookingReason(bookingContext, { ...base, roomId: room.id }, false))) return 'No suitable room is available for this teacher.'
      return null
    }
    const service = setup.services.find(item => item.id === initial.serviceId)
    if (!service) return 'Choose a configured service.'
    const isSpace = ['room', 'rehearsal', 'event'].includes(service.values.bookingKind)
    for (const room of slots) {
      if (isSpace && !bookingReason(bookingContext, { ...base, kind: service.values.bookingKind === 'room' ? 'studio' : service.values.bookingKind as 'rehearsal' | 'event', roomId: room.id }, false)) return null
      if (!isSpace) for (const teacher of academyTeachers.filter(item => item.instruments.includes(service.values.name === 'Voice & Vocals' ? 'Voice' : service.values.name === 'Band' ? 'Band Program' : service.values.name))) {
        if (!bookingReason(bookingContext, { ...base, kind: 'lesson', teacherId: teacher.id, roomId: room.id }, false)) return null
      }
    }
    return 'No suitable teacher and room combination is available.'
  }

return (
    <PageContainer><div style={{ position: 'relative', minWidth: 0, background: colors.background, color: colors.text, display: 'flex', flexDirection: 'column', fontFamily: typography.fontSans }}>
      <PageHeader density="compact" singleLine
        onBack={reschedule && taskItem ? leaveReschedule : undefined}
        backLabel={backLabel}
        title={reschedule && taskItem ? `Rescheduling ${taskItem.student.firstName}'s lesson` : 'Academy calendar'}
        subtitle={reschedule && taskItem ? undefined : `${dayMode ? dayName(focusDate) : `${dayName(dates[0])} – ${dayName(dates[dates.length - 1])}`} · ${visible.length} scheduled`}
        right={reschedule && taskItem
          ? <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
            <Button disabled={!pick} onClick={() => {
              if (!pick || !taskItem) return
              const message = applyReschedule(pick)
              if (message) { setNotice(message); return }
              setDone({ title: lessonTitle(taskItem), when: `${dayShort(pick.date)} · ${timeShort(pick.time)}`, teacher: pick.teacher })
            }}>Confirm changes</Button>
            <Button variant="secondary" onClick={leaveReschedule}>Cancel</Button>
          </div>
          : <div style={{ display: 'flex', alignItems: 'flex-end', gap: spacing.md, flexWrap: 'wrap' }}><Button style={{ whiteSpace: 'nowrap' }} onClick={() => bookSlot(focusDate, '15:00')}><Plus size={16} />Add booking</Button></div>} />

      <div>
      <div style={{ display: reschedule ? 'none' : 'flex', alignItems: 'center', gap: spacing.md, padding: '0 0 10px', flexWrap: 'wrap' }}>
        <Tabs<CalendarPerspective> variant="prominent" controlSize="toolbar" ariaLabel="View by" activeKey={perspective} onChange={view => { setPerspective(view); setWeekResource(''); setSelected(null) }} items={[{ key: 'teacher', label: 'Teacher' }, { key: 'room', label: 'Room' }, { key: 'service', label: 'Service' }]} />
        {!dayMode && !mobile && <div style={{ width: 230 }}><Select controlSize="toolbar" aria-label={perspective === 'teacher' ? 'Week teacher' : perspective === 'service' ? 'Week service' : 'Week room'} value={activeResource?.id || ''} onChange={event => { setWeekResource(event.target.value); setSelected(null) }}><option value="">All {perspective === 'teacher' ? 'teachers' : perspective === 'room' ? 'rooms' : 'services'}</option>{shownResources.map(resource => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</Select></div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: '0 0 10px', flexWrap: 'wrap' }}>
        {mobile ? <Button size="toolbar" variant="secondary" aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>Filters{filterCount > 0 ? ` (${filterCount})` : ''}</Button> : <>
        {!reschedule && !scope && <>
                  <CalendarFilter label="Staff" options={calendarResources('teacher', setup, occurrences)} value={filters.staff} onChange={staff => setFilters(current => ({ ...current, staff }))} />
                  <CalendarFilter label="Room" options={calendarResources('room', setup, occurrences)} value={filters.room} onChange={room => setFilters(current => ({ ...current, room }))} />
                  <CalendarFilter label="Service" options={calendarResources('service', setup, occurrences)} value={filters.service} onChange={service => setFilters(current => ({ ...current, service }))} />
                  <Checkbox label="Show unavailable time" checked={showUnavailable} onChange={event => setShowUnavailable(event.target.checked)} />
                  {filterCount > 0 && <Button size="toolbar" variant="secondary" onClick={resetFilters}>Reset filters</Button>}
        </>}
                </>}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginRight: 'auto' }}>
          {reschedule && <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexShrink: 0 }}>
            <span style={{ ...typography.bodySmall, color: colors.textSecondary, whiteSpace: 'nowrap' }}>Staff:</span>
            <Select aria-label="Reschedule staff" controlSize="toolbar" value={filters.staff[0] || ''} onChange={event => { setFilters(current => ({ ...current, staff: event.target.value ? [event.target.value] : [] })); setPick(null) }}>
              <option value="">All staff</option>
              {calendarResources('teacher', setup, occurrences).map(resource => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
            </Select>
          </div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap', marginLeft: 'auto' }}>
          <ControlButton kind="icon" aria-label={`Previous ${dayMode ? 'day' : 'week'}`} onClick={() => { const next = betaShiftDate(focusDate, dayMode ? -1 : -7); setFocusDate(next); setWeek(betaWeekStart(next)); setSelected(null) }}><ChevronLeft size={18} /></ControlButton>
          <Button variant="secondary" onClick={() => { setWeek(betaWeekStart(today)); setFocusDate(today) }}>Today</Button>
          <ControlButton kind="icon" aria-label={`Next ${dayMode ? 'day' : 'week'}`} onClick={() => { const next = betaShiftDate(focusDate, dayMode ? 1 : 7); setFocusDate(next); setWeek(betaWeekStart(next)); setSelected(null) }}><ChevronRight size={18} /></ControlButton>
          <div style={{ width: 158 }}><Input type="date" aria-label="Calendar date" value={focusDate} onChange={event => { if (event.target.value) { setFocusDate(event.target.value); setWeek(betaWeekStart(event.target.value)); setSelected(null) } }} /></div>
          {!reschedule && <Tabs<'Day' | 'Week'> variant="prominent" controlSize="toolbar" ariaLabel="Calendar range" activeKey={dayMode ? 'Day' : 'Week'} onChange={range => { setDayMode(range === 'Day'); setSelected(null) }} items={[{ key: 'Day', label: 'Day' }, { key: 'Week', label: 'Week' }]} />}
        </div>
      </div>
      {mobile && <SlidePanel isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} width="min(100vw, 420px)" ariaLabel="Calendar filters">
        <SlidePanelHeader title="Calendar filters" onClose={() => setFiltersOpen(false)} />
        <div style={{ padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.lg, overflowY: 'auto' }}>
          {!dayMode && <Select label={perspective === 'teacher' ? 'Week teacher' : perspective === 'service' ? 'Week service' : 'Week room'} value={activeResource?.id || ''} onChange={event => { setWeekResource(event.target.value); setSelected(null) }}><option value="">All {perspective === 'teacher' ? 'teachers' : perspective === 'room' ? 'rooms' : 'services'}</option>{shownResources.map(resource => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</Select>}
          {(['staff', 'room', 'service'] as const).map(field => <fieldset key={field} style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ fontWeight: typography.weightSemibold }}>{field === 'staff' ? 'Staff' : field === 'room' ? 'Room' : 'Service'}</legend>
            <Checkbox label={`All ${field}`} checked={!filters[field].length} onChange={() => setFilters(current => ({ ...current, [field]: [] }))} />
            {calendarResources(field === 'staff' ? 'teacher' : field, setup, occurrences).map(option => <Checkbox key={option.id} label={option.name} checked={filters[field].includes(option.id)} onChange={() => setFilters(current => ({ ...current, [field]: current[field].includes(option.id) ? current[field].filter(id => id !== option.id) : [...current[field], option.id] }))} />)}
          </fieldset>)}
          <Checkbox label="Show unavailable time" checked={showUnavailable} onChange={event => setShowUnavailable(event.target.checked)} />
          <Button variant="secondary" onClick={resetFilters}>Reset filters</Button>
          <Button onClick={() => setFiltersOpen(false)}>Done</Button>
        </div>
      </SlidePanel>}
      {allWeek && <p style={{ margin: '0 0 10px', color: colors.textSecondary, fontSize: typography.sizeSm }}>All-week overview · Filter by staff, room or service for detail. Select a time to choose resources; blank space does not confirm availability.</p>}
      {scopeSummary && !reschedule && <div role="status" style={{ display: 'flex', alignItems: 'center', gap: spacing.lg, flexWrap: 'wrap', padding: '0 0 10px', ...typography.bodySmall, color: colors.textSecondary }}>
        <span>Viewing: <strong style={{ color: colors.text }}>{scopeSummary.name}</strong></span>
        {scopeSummary.lessons.length > 0 && <span>Lessons: <span style={{ color: colors.text }}>{scopeSummary.lessons.join(', ')}</span></span>}
        {scopeSummary.teachers.length > 0 && <span>Teachers: <span style={{ color: colors.text }}>{scopeSummary.teachers.join(', ')}</span></span>}
        <button type="button" onClick={() => { setScope(null); const url = new URL(window.location.href); url.searchParams.delete('scope'); window.history.replaceState(window.history.state, '', url) }} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', color: colors.teal, font: 'inherit' }}>clear {scope?.kind === 'family' ? 'family' : 'student'} view</button>
      </div>}
      {visible.some(item => isStaffDuty(item.kind)) && <div aria-label="Staff duty coverage" style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md, paddingBottom: spacing.md }}>{visible.filter(item => isStaffDuty(item.kind)).map(item => <span key={`${item.id}:${item.date}`}><strong>{staffDutyLabel(item.kind)}</strong> · {setup.locations.find(location => location.id === item.locationId)?.values.name} · {item.teacherName} · {item.date} {item.start}–{item.end}</span>)}</div>}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: reschedule && taskItem ? spacing.lg : 0, minWidth: 0 }}>
              {reschedule && taskItem && <aside aria-label="Rescheduling" style={{ position: 'sticky', top: 0, alignSelf: 'flex-start', width: 232, flexShrink: 0, display: 'grid', gap: spacing.md }}>
        <div style={{ display: 'grid', gap: 2, padding: spacing.md, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg }}>
          <strong style={{ fontSize: typography.sizeSm }}>{lessonTitle(taskItem)}</strong>
          <span style={{ fontSize: typography.sizeSm, color: colors.textSecondary }}>{dayShort(reschedule.date)} · {timeShort(reschedule.start)}</span>
          <span style={{ fontSize: typography.sizeSm, color: colors.textSecondary }}>w/ {reschedule.teacherName || taskItem.teacher}</span>
        </div>
        {pick && <div style={{ display: 'grid', gap: 2, padding: spacing.md, ...calendarServiceStyle({ kind: 'lesson', serviceType: taskItem.program, program: taskItem.program }), background: 'var(--calendar-student-surface)', color: 'var(--calendar-student-text)', border: '1.5px solid var(--calendar-student-border)', borderRadius: radius.lg }}>
          <span style={{ fontSize: typography.sizeSm, opacity: 0.75 }}>Reschedule to:</span>
          <strong style={{ fontSize: typography.sizeSm }}>{lessonTitle(taskItem)}</strong>
          <span style={{ fontSize: typography.sizeSm }}>{dayShort(pick.date)} · {timeShort(pick.time)}</span>
          <span style={{ fontSize: typography.sizeSm }}>w/ {pick.teacher}</span>
        </div>}
      </aside>}
        <div style={{ flex: 1, minWidth: 0 }}><CalendarTimeGrid dates={gridColumns.map(column => column.id)} times={times} label="Academy schedule" minimumColumnWidth={reschedule ? 150 : allWeek ? 240 : 180} slotHeight={30} maxHeight="72vh" initialScrollTime={occurrences.length ? clock(Math.max(startMinutes, Math.min(...occurrences.map(item => minutesOf(item.start))) - 30)) : undefined}
        renderDayHeading={id => { const column = gridColumns.find(item => item.id === id)!; const teacher = perspective === 'teacher' ? setup.teachers.find(item => item.id === column.resource.id) : undefined; const [firstName, ...lastName] = column.resource.name.split(' '); return <><span>{!dayMode ? betaWeekdayName(column.date) : reschedule ? '' : dayName(column.date)}</span><strong style={{ fontSize: typography.sizeSm, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{teacher && <Avatar firstName={firstName} lastName={lastName.join(' ')} size={26} src={teacher.values.photo || teacher.values.avatar_url || teacher.values.image || undefined} />}{dayMode && !reschedule ? column.resource.name : dayName(column.date)}</strong></> }}
        renderDay={id => {
          const column = gridColumns.find(item => item.id === id)!
          const items = visible.filter(item => item.date === column.date && (!column.resource.id || calendarResourceIds(item, perspective, setup).includes(column.resource.id)))
          const layout = placeCalendarBlocks(items.map(item => ({ item, time: item.start, duration: minutesOf(item.end) - minutesOf(item.start), booked: true })), startMinutes)
          const occupiedRows = new Set(layout.blocks.flatMap(block => Array.from({ length: Math.max(1, block.duration / 15) }, (_, step) => block.row + step)))
          return <div className={calendarStyles.daySlots} data-resource-column={column.resource.id} data-resource-date={column.date} style={{ gridTemplateRows: `repeat(${rows}, var(--calendar-slot-height))`, gridTemplateColumns: `repeat(${layout.lanes}, minmax(0, 1fr))` }}>
            {times.filter((_, index) => index % 2 === 0).map(time => {
              const index = times.indexOf(time)
              const candidate = reschedule && taskItem ? Boolean(candidateTimes.get(`${column.date}|${column.resource.name}`)?.has(time)) : false
              const reason = reschedule ? (candidate ? '' : 'Not available') : slotReason(column.date, time, column.resource.id)
              const isCandidate = Boolean(reschedule && candidate)
              const occupied = occupiedRows.has(index)
              const active = drawing.current?.column === id && drawEnd && minutesOf(time) >= Math.min(minutesOf(drawing.current.time), minutesOf(drawEnd)) && minutesOf(time) <= Math.max(minutesOf(drawing.current.time), minutesOf(drawEnd))
              return <button key={time} type="button" disabled={Boolean(reason)} title={reason || undefined} data-unavailable={Boolean(reason) || undefined} data-available={reason ? undefined : time} aria-label={`${reason ? 'Unavailable' : 'Book'} ${column.resource.name}, ${column.date} at ${time}`} className={reason ? undefined : calendarStyles.bookableSlot} style={{ gridRow: `${index + 1} / span 2`, gridColumn: '1 / -1', border: reason ? 0 : '1.5px dotted transparent', borderRadius: reason ? 0 : 5, background: occupied || isCandidate || reschedule ? undefined : reason && showUnavailable ? colors.border : active ? colors.surfaceMuted : undefined, opacity: 1, margin: 0, padding: 0, cursor: reason ? 'not-allowed' : mobile ? 'default' : 'crosshair', touchAction: 'pan-x pan-y' }} onPointerDown={event => { if (mobile || event.pointerType === 'touch' || event.button !== 0 || reason || reschedule) return; drawing.current = { date: column.date, time, resource: column.resource.id, column: id }; setDrawEnd(time) }} onPointerEnter={() => { if (!mobile && drawing.current?.column === id) setDrawEnd(time) }} onPointerUp={event => {
                if (mobile || event.pointerType === 'touch') return
                const start = drawing.current
                if (!start || start.column !== id) return
                const from = clock(Math.min(minutesOf(start.time), minutesOf(time)))
                const duration = Math.abs(minutesOf(time) - minutesOf(start.time)) + 30
                const invalid = slotReason(start.date, from, start.resource, duration)
                if (!invalid) bookSlot(start.date, from, start.resource, duration)
                else setNotice(invalid)
                drawing.current = null; setDrawEnd(null)
                }} onClick={event => { if (reason) return; if (reschedule && taskItem) { const options = replacementSlots(column.date).filter(slot => slot.time === time); const chosen = options.find(slot => slot.teacher === column.resource.name) || options[0]; setPick({ date: column.date, time, teacher: chosen?.teacher || column.resource.name, program: chosen?.program || taskItem.program }); return } if (event.detail === 0) bookSlot(column.date, time, column.resource.id) }} />
            })}
            {reschedule && candidateBlocks.filter(block => block.date === column.date).map(block => {
              const row = times.indexOf(block.time)
              if (row < 0 || block.time < times[0]) return null
              const span = Math.max(2, Math.round((taskItem?.duration || 30) / 15))
              const isPicked = pick?.date === block.date && pick?.time === block.time
              return <BookableSlot key={block.time}
                title={taskItem ? lessonTitle(taskItem) : ''}
                when={`${dayShort(block.date)} · ${timeShort(block.time)}`}
                teachers={block.teachers}
                selectedTeacher={isPicked ? pick?.teacher : undefined}
                picked={isPicked}
                teacherLabel={`Teacher for ${dayShort(block.date)} ${timeShort(block.time)}`}
                style={{ gridRow: `${row + 1} / span ${span}`, gridColumn: '1 / -1', zIndex: isPicked ? 4 : 2, ...(isPicked && taskItem ? calendarServiceStyle({ kind: 'lesson', serviceType: taskItem.program, program: taskItem.program }) : {}) }}
                onPick={() => setPick({ date: block.date, time: block.time, teacher: block.teachers[0], program: taskItem!.program })}
                onChooseTeacher={teacher => setPick({ date: block.date, time: block.time, teacher, program: taskItem!.program })} />
            })}
            {layout.blocks.map(({ item, row, duration, lane }) => {
              // While rescheduling, another family's lesson is simply not your business: grey, no name.
              // Someone else's lesson reads as unavailable here: grey, unnamed, and not pickable.
              if (reschedule && item.id !== reschedule.id) return <div key={item.id} aria-hidden title="Not available" style={{ gridRow: `${row + 1} / span ${duration / 15}`, gridColumn: '1 / -1', background: colors.border, borderRadius: 5, cursor: 'not-allowed', zIndex: 1 }} />
              const inScope = Boolean(scopeStudents && item.studentIds.some(id => scopeStudents.has(id)))
              // Scoped: the family's lessons take the column and everything else becomes a bar without text,
              // so the week stays legible instead of splitting each day into a dozen unreadable lanes.
              if (scopeStudents && !inScope) return <div key={item.id} aria-hidden style={{ gridRow: `${row + 1} / span ${duration / 15}`, gridColumn: lane + 1, background: colors.textSecondary, opacity: 0.18, borderRadius: 4, zIndex: 1 }} />
              return <CalendarBookingBlock key={item.id} data-origin={reschedule && item.id === reschedule.id ? true : undefined} interactive detailed data-booking-id={item.id} data-scoped={inScope || undefined} data-cancelled={item.status === 'Cancelled' || undefined} aria-label={`${item.status === 'Cancelled' ? 'Cancelled · ' : ''}${item.title}, ${item.studentNames.join(', ') || item.teacherName}, ${item.date} ${item.start}–${item.end}`} aria-haspopup="dialog" aria-expanded={selected?.id === item.id} title={item.status === 'Cancelled' ? 'Cancelled lesson' : undefined} style={{ gridRow: `${row + 1} / span ${duration / 15}`, gridColumn: '1 / -1', zIndex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', ...(scopeStudents && inScope ? { gridColumn: '1 / -1', zIndex: 3, outline: `1.5px solid ${colors.border}` } : {}), ...calendarServiceStyle(item), ...(item.status === 'Cancelled' ? { borderStyle: 'dashed', opacity: 0.65 } : {}) }} onClick={event => {
                blockRef.current = event.currentTarget
                const bounds = event.currentTarget.getBoundingClientRect()
                setAnchor({ top: Math.max(12, Math.min(bounds.top, window.innerHeight - 470)), left: Math.max(12, Math.min(bounds.right + 8, window.innerWidth - 372)) })
                setSelected(item)
              }}>
                <strong style={{ textDecoration: item.status === 'Cancelled' ? 'line-through' : undefined }}>{item.title}</strong><span>{item.studentNames.join(', ') || item.teacherName}</span><span>{item.start} · {item.room || (isStaffDuty(item.kind) ? setup.locations.find(location => location.id === item.locationId)?.values.name : item.teacherName)}</span>
              </CalendarBookingBlock>
            })}
          </div>
        }} />
        </div>
      </div>
      </div>

      {done && <Modal isOpen size="sm" ariaLabel="Lesson rescheduled" onClose={leaveReschedule}>
        <ModalHeader title="Lesson rescheduled" onClose={leaveReschedule} />
        <ModalBody>
          <div style={{ display: 'grid', gap: spacing.xs }}>
            <p style={{ margin: 0, ...typography.bodySmall, color: colors.textSecondary }}>Lesson has been rescheduled to</p>
            <strong style={{ ...typography.body }}>{done.title}</strong>
            <span style={{ ...typography.body }}>{done.when}</span>
            <span style={{ ...typography.body, color: colors.textSecondary }}>w/ {done.teacher}</span>
          </div>
        </ModalBody>
        <ModalFooter><Button onClick={leaveReschedule}>Close</Button></ModalFooter>
      </Modal>}

      {cancelTarget && (
        <Modal isOpen size="sm" ariaLabel="Cancel lesson" onClose={() => setCancelTarget(null)}>
          <ModalHeader title={cancelTarget.studentIds.length > 1 ? 'Cancel whole session' : 'Cancel this lesson'} onClose={() => setCancelTarget(null)} />
          <ModalBody>
            <div style={{ display: 'grid', gap: spacing.md }}>
              <p style={{ margin: 0, color: colors.textSecondary, fontSize: typography.sizeSm }}>
                {cancelTarget.title} · {dayName(cancelTarget.date)} · {cancelTarget.start}–{cancelTarget.end} · {cancelTarget.studentNames.join(', ') || cancelTarget.teacherName}
              </p>
              <Select label="Reason" value={cancelReason} onChange={event => setCancelReason(event.target.value)}>
                <option>Family cancelled</option>
                <option>Teacher unavailable</option>
                <option>Student illness</option>
                <option>Weather</option>
                <option>School closure</option>
                <option>Other</option>
              </Select>
              <Checkbox label="Credit a make-up to the family" checked={cancelCredit} onChange={event => setCancelCredit(event.target.checked)} />
              <Checkbox label="Still charge for this lesson" checked={cancelCharge} onChange={event => setCancelCharge(event.target.checked)} />
              <p style={{ margin: 0, color: colors.textSecondary, fontSize: typography.sizeSm }}>
                Recorded on the lesson: the reason, whether a make-up is owed, and whether the family is charged.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>Keep lesson</Button>
            <Button variant="destructive" onClick={cancelOccurrence}>Cancel lesson</Button>
          </ModalFooter>
        </Modal>
      )}
{selected && !reschedule && (

        <div ref={inspectorRef} role="dialog" aria-label="Booking details" tabIndex={-1} style={{ position: 'fixed', top: anchor.top, left: anchor.left, zIndex: 60, width: 'min(360px, calc(100vw - 24px))', maxHeight: `calc(100vh - ${anchor.top + 12}px)`, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ padding: spacing.lg, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'flex-start', gap: spacing.sm }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: typography.sizeLg }}>{selected.title}</h2>
              {isStaffDuty(selected.kind) && <p>{setup.locations.find(location => location.id === selected.locationId)?.values.name}{selected.notes ? ` · ${selected.notes}` : ''}</p>}
              <p style={{ margin: '4px 0 0', color: colors.textSecondary, fontSize: typography.sizeSm }}>{dayName(selected.date)} · {selected.start}–{selected.end} · {selected.serviceType}</p>
            </div>
            <Button variant="secondary" onClick={() => { setSelected(null); blockRef.current?.focus({ preventScroll: true }) }}>Close</Button>
          </div>
          <div style={{ padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {!isStaffDuty(selected.kind) && <div><strong>Student</strong><p style={{ margin: '2px 0 0' }}>{selected.studentNames.join(', ') || 'No student booked'}</p></div>}
            <div><strong>Teacher</strong><p style={{ margin: '2px 0 0' }}>{selected.teacherName || 'Not assigned'}</p></div>
            <div><strong>Room</strong><p style={{ margin: '2px 0 0' }}>{selected.room || 'Not assigned'}</p></div>
            <div><strong>Status</strong><p style={{ margin: '2px 0 0' }}>{selected.status}{selected.participantLessonIds?.length ? (() => { const record = expanded.lessons.find(item => item.id === selected.participantLessonIds![0])?.cancellation; return record ? ` · ${record.reason}${record.credited ? ' · make-up credited' : ''}${record.charged ? ' · charged' : ' · not charged'}` : '' })() : ''}</p></div>
            {selected.kind === 'lesson' && selected.status !== 'Cancelled' && selected.participantLessonIds?.map(id => {
              const lesson = expanded.lessons.find(item => item.id === id)
              const student = expanded.students.find(item => item.enrollments.some(enrollment => enrollment.id === lesson?.enrollmentId))
              return lesson && student ? <div key={id} role="group" aria-label={`Attendance · ${student.firstName} ${student.lastName}`}><strong>Attendance · {student.firstName} {student.lastName}</strong><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>{attendanceOutcomes.map((outcome, index) => { const Icon = [Check, X, Minus][index]; return <ControlButton key={outcome} kind="toggle" selected={lesson.attendance === outcome} aria-pressed={lesson.attendance === outcome} onClick={() => onApply(current => markParticipantAttendance(expandPreviewCalendar(current, selected.date), id, lesson.attendance === outcome ? undefined : outcome))}><Icon size={14} aria-hidden="true" />{outcome}</ControlButton> })}</div></div> : null
            })}
            {selectedStudent && <Button variant="secondary" onClick={() => { setStudentPanel(selectedStudent.id); setSelected(null) }}>View profile</Button>}
            {selected.kind === 'lesson' && selected.status === 'Scheduled' && <Button variant="destructive" onClick={() => setCancelTarget(selected)}>{selected.studentIds.length > 1 ? 'Cancel whole session' : 'Cancel this lesson'}</Button>}
            {selected.kind === 'lesson' && selected.status === 'Scheduled' && <Button variant="secondary" onClick={() => { returnScroll.current = { x: window.scrollX, y: window.scrollY }; setReschedule(selected) }}>{selected.studentIds.length > 1 ? 'Reschedule whole session' : 'Reschedule'}</Button>}
            {selected.bookingId && isStaffDuty(selected.kind) && <Button variant="secondary" onClick={() => { const existing = data.calendarBookings?.find(item => item.id === selected.bookingId); if (existing) { setBooking({ date: existing.date, time: existing.time, duration: existing.duration, existing }); setSelected(null) } }}>Edit duty series</Button>}
            {selected.bookingId && <Button variant="destructive" onClick={() => { if (configuredBlocks(setup).some(item => item.id === selected.bookingId)) onSetup({ ...setup, resourceBlocks: setup.resourceBlocks.filter(item => item.id !== selected.bookingId) }); else onApply(current => ({ ...current, calendarBookings: current.calendarBookings?.map(item => item.id === selected.bookingId ? { ...item, status: 'Cancelled' } : item) })); setSelected(null); setNotice('Booking removed; resources released.') }}>{isStaffDuty(selected.kind) ? 'Cancel duty series' : selected.kind === 'block' ? 'Remove block' : 'Cancel booking'}</Button>}
            {selectedStudent && <Button variant="secondary" onClick={() => setMessage({ contactId: selectedStudent.communicationContactId, channel: 'sms' })}>Message family by SMS</Button>}
            {selectedStudent && <Button variant="secondary" onClick={() => setMessage({ contactId: selectedStudent.communicationContactId, channel: 'email' })}>Message family by email</Button>}

          </div>
        </div>
      )}


      {notice && <div style={{ padding: '0 0 10px' }}><Notice variant="info" onDismiss={() => setNotice('')}>{notice}</Notice></div>}

{message && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setMessage(null)}>
          <div style={{ width: 520, maxHeight: '85vh', overflowY: 'auto', background: colors.surface, borderRadius: radius.lg, padding: spacing.lg }} onClick={event => event.stopPropagation()}>
            <ContactBulkComposer tenantId="academy-calendar" contactIds={[message.contactId]} channel={message.channel} onClose={() => setMessage(null)} />
          </div>
        </div>
      )}

      {studentPanel && <StudentWorkspaceV3 initialData={data} initialMakeups={makeups} initialLocation={{ ...workspaceInitial, view: 'quick', section: 'profile', studentId: studentPanel, accountId: data.accounts.find(account => account.studentIds.includes(studentPanel))?.id || '' }} onClose={() => setStudentPanel(null)} renderContacts={() => null} onDemoChange={onDemoChange} />}

      {booking && <CalendarBookingModal initial={booking} context={bookingContext} onClose={() => setBooking(null)} onSave={(draft, action = 'staff') => {
        try {
          if (draft.kind === 'lesson') { onEnroll(draft, action); setBooking(null); if (action === 'send') setNotice('Enrollment request sent · draft saved. Preview it in the family portal.'); return null }
          // Revalidate against the latest local snapshot inside the mutation as well.
          const withoutExisting = (current: FamilyPreviewData) => booking.existing ? { ...current, calendarBookings: current.calendarBookings?.filter(item => item.id !== booking.existing!.id) } : current
          saveCalendarBooking({ ...bookingContext, data: withoutExisting(bookingContext.data) }, draft)
          if (draft.kind === 'block') onSetup({ ...setup, resourceBlocks: [...(setup.resourceBlocks || []), { id: draft.id, values: { name: draft.title, booking: JSON.stringify(draft) } }] })
          else onApply(current => saveCalendarBooking({ ...bookingContext, data: withoutExisting(current) }, draft))
          setBooking(null); setNotice(draft.kind === 'block' ? 'Unavailable time saved.' : 'Booking added.')
          return null
        } catch (error) { return error instanceof Error ? error.message : 'Unable to save booking.' }
      }} />}
    </div></PageContainer>
  )
}
