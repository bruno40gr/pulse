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
import { academyRescheduleAvailability } from '@/beta-source/lib/academy-reschedule-availability'
import { commitFamilyMovesWithRooms, familyLessonSlots, type FamilyMoves } from '@/beta-source/lib/family-reschedule'
import { ConfirmActionButton } from '../content-studio-prototype/students/ConfirmActionButton'
import { formatScheduleTime } from '@/beta-source/lib/academy-enrollment-schedule'
import { FamilyRescheduleCards } from '../content-studio-prototype/students/FamilyReschedule'
import { CalendarFilter } from './CalendarFilters'
import CalendarBookingModal, { type BookingPrefill } from './CalendarBookingModal'
import { useCalendarEnrollment } from './CalendarEnrollmentContext'
import { BookableSlot } from './BookableSlot'
import { bookingReason, saveCalendarBooking, roomRecords, configuredBlocks, isStaffDuty, staffDutyLabel, type CalendarBooking } from '@/beta-source/lib/academy-calendar-booking'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { ArrowUpRight, ChevronLeft, ChevronRight, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ControlButton } from '@/components/ui/ControlButton'
import { OverflowMenu } from '@/components/ui/OverflowMenu'
import { CalendarTimeGrid } from '../content-studio-prototype/enrollment/CalendarTimeGrid'
import { CalendarBookingBlock } from '../content-studio-prototype/enrollment/CalendarBookingBlock'
import { previewCalendarLessons, type PreviewMakeup, type MakeupPreviewState } from '@/beta-source/lib/academy-makeup-preview'
import { calendarResources, calendarResourceIds, calendarServiceName, type CalendarPerspective } from '@/beta-source/lib/academy-calendar-resources'
import { placeCalendarBlocks } from '@/beta-source/lib/academy-calendar-layout'
import { calendarServiceStyle, calendarStudentStyle } from '@/lib/calendar-appearance'
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
const inspectorWidth = 440
const inspectorLabel = { display: 'block', color: colors.textSecondary, fontSize: typography.sizeSm, marginBottom: spacing.xs }
const inspectorValue = { margin: 0, fontWeight: typography.weightSemibold, overflowWrap: 'anywhere' as const }
function inspectorTimeRange(start: string, end: string) {
  const from = formatScheduleTime(start).toUpperCase()
  const to = formatScheduleTime(end).toUpperCase()
  return `${from.slice(-2) === to.slice(-2) ? from.slice(0, -3) : from}–${to}`
}
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
const dayName = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })

export default function AcademyCalendar({ data, groups, events, setup, today, onApply, makeups, onDemoChange, onSetup, onEnroll, initialReschedule, siblingRequest, rescheduleAccount, initialScope }: {
  onEnroll: (booking: CalendarBooking, action: 'staff' | 'send') => void
  /** Lesson to open for rescheduling on arrival, so other surfaces can deep-link here. */
  initialReschedule?: string
  siblingRequest?: string
  rescheduleAccount?: string
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
  const [moves, setMoves] = useState<FamilyMoves>({})
  const [focusedLesson, setFocusedLesson] = useState('')
  const [familyError, setFamilyError] = useState('')
  const [familyStaff, setFamilyStaff] = useState<Record<string, string>>({})
  const familyPlanning = Boolean(siblingRequest)
  const rescheduling = Boolean(reschedule || familyPlanning)
  const draftCount = Object.keys(moves).length
  const familyLessons = useMemo(() => {
    if (!initialReschedule || !siblingRequest || !rescheduleAccount) return []
    const ids = [initialReschedule, ...siblingRequest.split(',')]
    if (ids.length > 4 || new Set(ids).size !== ids.length) return []
    const account = data.accounts.find(item => item.id === rescheduleAccount)
    const through = ids.map(id => id.match(/:calendar:(\d{4}-\d{2}-\d{2})$/)?.[1]).filter((date): date is string => Boolean(date) && Number.isFinite(Date.parse(date!))).sort().at(-1)
    const snapshot = through ? expandPreviewCalendar(data, through) : data
    const items = previewCalendarLessons(snapshot, makeups?.items || [], workspaceInitial)
    const selected = ids.map(id => items.find(item => item.id === id && item.status === 'Scheduled' && account?.studentIds.includes(item.student.id)))
    return selected.every(item => item !== undefined) ? selected : []
  }, [data, makeups, initialReschedule, siblingRequest, rescheduleAccount])
  const familyFocus = familyLessons.find(item => item.id === focusedLesson) || familyLessons[0]
  const rescheduleConsumed = useRef(false)
  // Where the reschedule was opened from, read after mount so the header does not diverge on hydration.
  const [backLabel, setBackLabel] = useState('Calendar')
  const [done, setDone] = useState<{ title: string; when: string; teacher: string; room?: string }[] | null>(null)
  useEffect(() => { if (new URLSearchParams(window.location.search).get('backTo') === 'record') setBackLabel('Family') }, [])
  // A cancellation records why it happened, because billing, make-ups and the family
  // message all follow from that answer, not from the status string alone.
  const [cancelTarget, setCancelTarget] = useState<CalendarOccurrence | null>(null)
  const [cancelReason, setCancelReason] = useState('Family cancelled')
  const [cancelCredit, setCancelCredit] = useState(true)
  const [cancelCharge, setCancelCharge] = useState(false)

  const dates = useMemo(() => (dayMode && !rescheduling ? [focusDate] : betaWeekDates(week)), [dayMode, focusDate, week, rescheduling])
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
  const familyStudentIds = familyLessons.map(item => item.student.id)
  const familyColor = (item: NonNullable<typeof familyFocus>) => calendarStudentStyle(item.student.id, familyStudentIds)
  const singleColor = taskItem ? calendarServiceStyle({ kind: 'lesson', serviceType: taskItem.enrollment.service, program: taskItem.program }) : {}
  // While rescheduling the columns are days, not resources: the slot is the decision, and the
  // teacher follows from it, so a cell can never mean two different teachers at once.
  // Candidate times per visible day: computed once so every cell answers from one set, and so
  // the cells and the confirm button cannot disagree about what is available.
  // Rescheduling is a week of days: the decision is "which day and time", and the teacher
  // comes from whoever is free there.
  const rescheduleDates = useMemo(() => betaWeekDates(week).slice(0, 6), [week])
  const gridColumns = rescheduling ? rescheduleDates.map(date => ({ id: date, date, resource: { id: '', name: '' } })) : columns
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
  const resolveFamilySlots = useMemo(() => academyRescheduleAvailability({ setup, groups, events }, true), [setup, groups, events])
  // Preload every selected lesson for the visible week. Focus, drafts and Staff only change presentation.
  const familyOptions = useMemo(() => {
    const options = new Map<string, NonNullable<PreviewMakeup['booking']>[]>()
    if (!familyLessons.length || !makeups) return options
    if (!rescheduleConsumed.current && rescheduleDates[0] !== betaWeekStart(familyLessons[0].date)) return options
    const snapshot = expandPreviewCalendar(data, [...rescheduleDates, ...familyLessons.map(item => item.date)].sort().at(-1)!)
    for (const item of familyLessons) {
      const lesson: PreviewMakeup = { id: item.id, lessonId: item.id, studentId: item.student.id, enrollmentId: item.enrollmentId, date: item.date, duration: item.duration, program: item.program, teacher: item.teacher, service: item.enrollment.service }
      options.set(item.id, rescheduleDates.flatMap(date => date < today ? [] : familyLessonSlots(snapshot, makeups, lesson, date, resolveFamilySlots)).filter(slot => minutesOf(slot.time) >= startMinutes && minutesOf(slot.time) + item.duration <= endMinutes && !(slot.date === item.date && slot.time === item.time && slot.teacher === item.teacher)))
    }
    return options
  }, [data, makeups, familyLessons, rescheduleDates, today, resolveFamilySlots])
  const staffId = familyFocus ? familyStaff[familyFocus.id] ?? setup.teachers.find(teacher => teacher.values.name === familyFocus.teacher)?.id ?? '' : filters.staff[0] || ''
  const familyBlocks = new Map<string, { date: string; time: string; teachers: string[] }>()
  for (const slot of (familyFocus && familyOptions.get(familyFocus.id)) || []) {
    if (staffId && setup.teachers.find(teacher => teacher.id === staffId)?.values.name !== slot.teacher) continue
    const key = `${slot.date}|${slot.time}`
    const block = familyBlocks.get(key) || { date: slot.date, time: slot.time, teachers: [] }
    if (!block.teachers.includes(slot.teacher)) block.teachers.push(slot.teacher)
    familyBlocks.set(key, block)
  }
  useEffect(() => {
    const first = familyLessons[0]
    if (!first || rescheduleConsumed.current) return
    rescheduleConsumed.current = true
    setFocusDate(first.date)
    setWeek(betaWeekStart(first.date))
  }, [familyLessons])

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
    if (!initialReschedule || familyPlanning || rescheduleConsumed.current) return
    const date = initialReschedule.match(/(\d{4}-\d{2}-\d{2})$/)?.[1]
    if (date && !betaWeekDates(week).includes(date)) { setWeek(betaWeekStart(date)); setFocusDate(date) }
  }, [initialReschedule, week, familyPlanning])

  useEffect(() => {
    if (!initialReschedule || familyPlanning || reschedule || rescheduleConsumed.current) return
    // A lesson list names an occurrence `<enrollment>:calendar:<date>`; the grid names its own
    // sessions. Accept either reference so a handoff from the record always finds its lesson.
    const [enrollmentId, date] = initialReschedule.split(':calendar:')
    const match = visible.find(item => item.id === initialReschedule || (date && item.enrollmentId === enrollmentId && item.date === date))
    if (match) { rescheduleConsumed.current = true; setReschedule(match) }
    setPick(null)
    // The lesson may sit outside the visible week; the link still arrives, it just waits.
  }, [initialReschedule, visible, reschedule, familyPlanning])

  useEffect(() => {
    if (!selected || rescheduling || cancelTarget || message) return
    inspectorRef.current?.focus({ preventScroll: true })
    const close = () => { setSelected(null); blockRef.current?.focus({ preventScroll: true }) }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !(event.target instanceof Element && event.target.closest('[role="menu"]'))) close()
    }
    const outside = (event: PointerEvent) => {
      if (!inspectorRef.current?.contains(event.target as Node) && !blockRef.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('keydown', key)
    document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', outside) }
  }, [selected, rescheduling, cancelTarget, message])

  // One wording for the lesson, used by the card and the candidate blocks alike.
  function lessonTitle(item: NonNullable<typeof taskItem>) {
    const enrollment = item.student.enrollments.find(entry => entry.program === item.program) || item.student.enrollments[0]
    return `${item.program}${enrollment?.level ? `, Level ${enrollment.level}` : ''}`
  }
  function dayShort(date: string) { return dayName(date) }
  const timeShort = formatScheduleTime

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
    if (familyPlanning && !done && draftCount && !window.confirm('Discard the proposed lesson changes?')) return
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
  const inspectorActions: { label: string; onSelect: () => void }[] = []
  if (selectedStudent) {
    const contactId = selectedStudent.communicationContactId
    inspectorActions.push(
      { label: 'Send SMS', onSelect: () => setMessage({ contactId, channel: 'sms' }) },
      { label: 'Send email', onSelect: () => setMessage({ contactId, channel: 'email' }) },
    )
  }
  if (selected?.kind === 'lesson' && selected.status === 'Scheduled') {
    const group = selected.studentIds.length > 1
    inspectorActions.push(
      { label: group ? 'Reschedule whole session' : 'Reschedule lesson', onSelect: () => {
        returnScroll.current = { x: window.scrollX, y: window.scrollY }
        setReschedule(selected)
      } },
      { label: group ? 'Cancel whole session' : 'Cancel lesson', onSelect: () => setCancelTarget(selected) },
    )
  }
  if (selected?.bookingId) {
    const bookingId = selected.bookingId
    if (isStaffDuty(selected.kind)) inspectorActions.push({ label: 'Edit duty series', onSelect: () => {
      const existing = data.calendarBookings?.find(item => item.id === bookingId)
      if (existing) { setBooking({ date: existing.date, time: existing.time, duration: existing.duration, existing }); setSelected(null) }
    } })
    inspectorActions.push({ label: isStaffDuty(selected.kind) ? 'Cancel duty series' : selected.kind === 'block' ? 'Remove block' : 'Cancel booking', onSelect: () => {
      if (configuredBlocks(setup).some(item => item.id === bookingId)) onSetup({ ...setup, resourceBlocks: setup.resourceBlocks.filter(item => item.id !== bookingId) })
      else onApply(current => ({ ...current, calendarBookings: current.calendarBookings?.map(item => item.id === bookingId ? { ...item, status: 'Cancelled' } : item) }))
      setSelected(null); setNotice('Booking removed; resources released.')
    } })
  }
  const inspectedAttendance = selected?.kind === 'lesson' && selected.status !== 'Cancelled' ? (selected.participantLessonIds || []).flatMap(id => {
    const lesson = expanded.lessons.find(item => item.id === id)
    const student = expanded.students.find(item => item.enrollments.some(enrollment => enrollment.id === lesson?.enrollmentId))
    return lesson && student ? [{ lesson, name: `${student.firstName} ${student.lastName}` }] : []
  }) : []
  const inspectedCancellation = expanded.lessons.find(item => item.id === selected?.participantLessonIds?.[0])?.cancellation

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

  function saveFamilyMoves() {
    if (!familyFocus || !makeups || !onDemoChange || !rescheduleAccount || !draftCount) return
    try {
      const through = [...familyLessons.map(item => item.date), ...Object.values(moves).map(item => item.date)].sort().at(-1)!
      const result = commitFamilyMovesWithRooms(expandPreviewCalendar(data, through), makeups, rescheduleAccount, moves, resolveFamilySlots)
      const summary = familyLessons.flatMap(item => {
        const move = moves[item.id]
        if (!move) return []
        const room = result.data.lessons.find(lesson => lesson.id === item.id)?.room || result.state.items.find(lesson => lesson.id === item.id)?.booking?.room
        return [{ title: `${item.student.firstName} · ${lessonTitle(item)}`, when: `${dayShort(move.date)} · ${timeShort(move.time)}`, teacher: move.teacher, room }]
      })
      onDemoChange(result.data, result.state)
      setFamilyError('')
      setDone(summary)
    } catch (error) {
      setFamilyError(error instanceof Error ? error.message : 'Unable to reschedule lessons.')
    }
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
        onBack={rescheduling ? leaveReschedule : undefined}
        backLabel={backLabel}
        title={familyPlanning ? 'Reschedule together' : reschedule && taskItem ? `Rescheduling ${taskItem.student.firstName}'s lesson` : 'Academy calendar'}
        subtitle={rescheduling ? undefined : `${dayMode ? dayName(focusDate) : `${dayName(dates[0])} – ${dayName(dates[dates.length - 1])}`} · ${visible.length} scheduled`}
        right={familyPlanning ? <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
            <ConfirmActionButton disabled={!draftCount || Boolean(done)} loadingLabel="Rescheduling lessons" onClick={saveFamilyMoves}>Confirm {draftCount} of {familyLessons.length} changes</ConfirmActionButton>
            <Button variant="secondary" onClick={leaveReschedule}>Cancel</Button>
          </div> : reschedule && taskItem
          ? <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
            <ConfirmActionButton disabled={!pick} loadingLabel="Rescheduling lesson" onClick={() => {
              if (!pick || !taskItem) return
              const message = applyReschedule(pick)
              if (message) { setNotice(message); return }
              setDone([{ title: lessonTitle(taskItem), when: `${dayShort(pick.date)} · ${timeShort(pick.time)}`, teacher: pick.teacher }])
            }}>Confirm changes</ConfirmActionButton>
            <Button variant="secondary" onClick={leaveReschedule}>Cancel</Button>
          </div>
          : <div style={{ display: 'flex', alignItems: 'flex-end', gap: spacing.md, flexWrap: 'wrap' }}><Button style={{ whiteSpace: 'nowrap' }} onClick={() => bookSlot(focusDate, '15:00')}><Plus size={16} />Add booking</Button></div>} />

      {familyPlanning && (!familyFocus || familyError) && <Notice variant="error">{familyError || 'These lessons are unavailable. Return to the record and select two to four scheduled lessons.'}</Notice>}
      <div>
      <div style={{ display: rescheduling ? 'none' : 'flex', alignItems: 'center', gap: spacing.md, padding: '0 0 10px', flexWrap: 'wrap' }}>
        <Tabs<CalendarPerspective> variant="prominent" controlSize="toolbar" ariaLabel="View by" activeKey={perspective} onChange={view => { setPerspective(view); setWeekResource(''); setSelected(null) }} items={[{ key: 'teacher', label: 'Teacher' }, { key: 'room', label: 'Room' }, { key: 'service', label: 'Service' }]} />
        {!dayMode && !mobile && <div style={{ width: 230 }}><Select controlSize="toolbar" aria-label={perspective === 'teacher' ? 'Week teacher' : perspective === 'service' ? 'Week service' : 'Week room'} value={activeResource?.id || ''} onChange={event => { setWeekResource(event.target.value); setSelected(null) }}><option value="">All {perspective === 'teacher' ? 'teachers' : perspective === 'room' ? 'rooms' : 'services'}</option>{shownResources.map(resource => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</Select></div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: '0 0 10px', flexWrap: 'wrap' }}>
        {!rescheduling && (mobile ? <Button size="toolbar" variant="secondary" aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>Filters{filterCount > 0 ? ` (${filterCount})` : ''}</Button> : <>
        {!reschedule && !scope && <>
                  <CalendarFilter label="Staff" options={calendarResources('teacher', setup, occurrences)} value={filters.staff} onChange={staff => setFilters(current => ({ ...current, staff }))} />
                  <CalendarFilter label="Room" options={calendarResources('room', setup, occurrences)} value={filters.room} onChange={room => setFilters(current => ({ ...current, room }))} />
                  <CalendarFilter label="Service" options={calendarResources('service', setup, occurrences)} value={filters.service} onChange={service => setFilters(current => ({ ...current, service }))} />
                  <Checkbox label="Show unavailable time" checked={showUnavailable} onChange={event => setShowUnavailable(event.target.checked)} />
                  {filterCount > 0 && <Button size="toolbar" variant="secondary" onClick={resetFilters}>Reset filters</Button>}
        </>}
                </>)}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginRight: 'auto' }}>
          {rescheduling && <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexShrink: 0 }}>
            <span style={{ ...typography.bodySmall, color: colors.textSecondary, whiteSpace: 'nowrap' }}>Staff:</span>
            <Select aria-label="Reschedule staff" controlSize="toolbar" value={staffId} onChange={event => { const id = event.target.value; if (familyFocus) setFamilyStaff(current => ({ ...current, [familyFocus.id]: id })); else { setFilters(current => ({ ...current, staff: id ? [id] : [] })); setPick(null) } }}>
              <option value="">All staff</option>
              {calendarResources('teacher', setup, occurrences).map(resource => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
            </Select>
          </div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap', marginLeft: 'auto' }}>
          <ControlButton kind="icon" aria-label={`Previous ${dayMode && !rescheduling ? 'day' : 'week'}`} onClick={() => { const next = betaShiftDate(focusDate, dayMode && !rescheduling ? -1 : -7); setFocusDate(next); setWeek(betaWeekStart(next)); setSelected(null) }}><ChevronLeft size={18} /></ControlButton>
          <Button variant="secondary" onClick={() => { setWeek(betaWeekStart(today)); setFocusDate(today) }}>Today</Button>
          <ControlButton kind="icon" aria-label={`Next ${dayMode && !rescheduling ? 'day' : 'week'}`} onClick={() => { const next = betaShiftDate(focusDate, dayMode && !rescheduling ? 1 : 7); setFocusDate(next); setWeek(betaWeekStart(next)); setSelected(null) }}><ChevronRight size={18} /></ControlButton>
          <div style={{ width: 158 }}><Input type="date" aria-label="Calendar date" value={focusDate} onChange={event => { if (event.target.value) { setFocusDate(event.target.value); setWeek(betaWeekStart(event.target.value)); setSelected(null) } }} /></div>
          {!rescheduling && <Tabs<'Day' | 'Week'> variant="prominent" controlSize="toolbar" ariaLabel="Calendar range" activeKey={dayMode ? 'Day' : 'Week'} onChange={range => { setDayMode(range === 'Day'); setSelected(null) }} items={[{ key: 'Day', label: 'Day' }, { key: 'Week', label: 'Week' }]} />}
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
      {!rescheduling && allWeek && <p style={{ margin: '0 0 10px', color: colors.textSecondary, fontSize: typography.sizeSm }}>All-week overview · Filter by staff, room or service for detail. Select a time to choose resources; blank space does not confirm availability.</p>}
      {scopeSummary && !rescheduling && <div role="status" style={{ display: 'flex', alignItems: 'center', gap: spacing.lg, flexWrap: 'wrap', padding: '0 0 10px', ...typography.bodySmall, color: colors.textSecondary }}>
        <span>Viewing: <strong style={{ color: colors.text }}>{scopeSummary.name}</strong></span>
        {scopeSummary.lessons.length > 0 && <span>Lessons: <span style={{ color: colors.text }}>{scopeSummary.lessons.join(', ')}</span></span>}
        {scopeSummary.teachers.length > 0 && <span>Teachers: <span style={{ color: colors.text }}>{scopeSummary.teachers.join(', ')}</span></span>}
        <button type="button" onClick={() => { setScope(null); const url = new URL(window.location.href); url.searchParams.delete('scope'); window.history.replaceState(window.history.state, '', url) }} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', color: colors.teal, font: 'inherit' }}>clear {scope?.kind === 'family' ? 'family' : 'student'} view</button>
      </div>}
      {!rescheduling && visible.some(item => isStaffDuty(item.kind)) && <div aria-label="Staff duty coverage" style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md, paddingBottom: spacing.md }}>{visible.filter(item => isStaffDuty(item.kind)).map(item => <span key={`${item.id}:${item.date}`}><strong>{staffDutyLabel(item.kind)}</strong> · {setup.locations.find(location => location.id === item.locationId)?.values.name} · {item.teacherName} · {item.date} {item.start}–{item.end}</span>)}</div>}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: rescheduling ? spacing.lg : 0, flexDirection: mobile && rescheduling ? 'column' : 'row', minWidth: 0 }}>
        {familyFocus && <aside style={{ width: mobile ? '100%' : 232, flexShrink: 0 }}>
          <FamilyRescheduleCards items={familyLessons} activeId={familyFocus.id} moves={moves} onFocus={item => setFocusedLesson(item.id)} onClear={id => {
            setMoves(current => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)))
            setFamilyError('')
          }} />
        </aside>}
              {reschedule && taskItem && <aside aria-label="Rescheduling" style={{ position: 'sticky', top: 0, alignSelf: 'flex-start', width: 232, flexShrink: 0, display: 'grid', gap: spacing.md }}>
        <div style={{ display: 'grid', gap: 2, padding: spacing.md, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg }}>
          <strong style={{ fontSize: typography.sizeSm }}>{lessonTitle(taskItem)}</strong>
          <span style={{ fontSize: typography.sizeSm, color: colors.textSecondary }}>{dayShort(reschedule.date)} · {timeShort(reschedule.start)}</span>
          <span style={{ fontSize: typography.sizeSm, color: colors.textSecondary }}>w/ {reschedule.teacherName || taskItem.teacher}</span>
        </div>
        {pick && <div style={{ display: 'grid', gap: 2, padding: spacing.md, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg }}>
          <span style={{ fontSize: typography.sizeSm, opacity: 0.75 }}>Reschedule to:</span>
          <strong style={{ fontSize: typography.sizeSm }}>{lessonTitle(taskItem)}</strong>
          <span style={{ fontSize: typography.sizeSm }}>{dayShort(pick.date)} · {timeShort(pick.time)}</span>
          <span style={{ fontSize: typography.sizeSm }}>w/ {pick.teacher}</span>
        </div>}
      </aside>}
        <div style={{ flex: 1, minWidth: 0, width: mobile && rescheduling ? '100%' : undefined }}><CalendarTimeGrid dates={gridColumns.map(column => column.id)} times={times} label="Academy schedule" minimumColumnWidth={familyPlanning && draftCount ? 220 : rescheduling ? 150 : allWeek ? 240 : 180} slotHeight={30} maxHeight="72vh" initialScrollTime={occurrences.length ? clock(Math.max(startMinutes, Math.min(...occurrences.map(item => minutesOf(item.start))) - 30)) : undefined}
        renderDayHeading={id => { const column = gridColumns.find(item => item.id === id)!; const teacher = perspective === 'teacher' ? setup.teachers.find(item => item.id === column.resource.id) : undefined; const [firstName, ...lastName] = column.resource.name.split(' '); return <><span>{!dayMode && !rescheduling ? betaWeekdayName(column.date) : rescheduling ? '' : dayName(column.date)}</span><strong style={{ fontSize: typography.sizeSm, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{teacher && <Avatar firstName={firstName} lastName={lastName.join(' ')} size={26} src={teacher.values.photo || teacher.values.avatar_url || teacher.values.image || undefined} />}{dayMode && !rescheduling ? column.resource.name : dayName(column.date)}</strong></> }}
        renderDay={id => {
          const column = gridColumns.find(item => item.id === id)!
          const items = (rescheduling ? occurrences : visible).filter(item => item.date === column.date && (!column.resource.id || calendarResourceIds(item, perspective, setup).includes(column.resource.id)))
          const layout = placeCalendarBlocks(items.map(item => ({ item, time: item.start, duration: minutesOf(item.end) - minutesOf(item.start), booked: true })), startMinutes)
          const focus = familyFocus || taskItem
          const options = (familyPlanning ? [...familyBlocks.values()] : candidateBlocks).filter(block => block.date === column.date)
          const originals = familyPlanning ? familyLessons : taskItem && reschedule ? [{ ...taskItem, date: reschedule.date, time: reschedule.start }] : []
          const foreground = originals.flatMap(lesson => {
            const color = familyPlanning ? familyColor(lesson) : singleColor
            const title = familyPlanning ? `${lesson.student.firstName} · ${lessonTitle(lesson)}` : lessonTitle(lesson)
            const draft = familyPlanning ? moves[lesson.id] : pick
            const isFocused = focus?.id === lesson.id
            return [
              ...(lesson.date === column.date && (!familyPlanning || isFocused) ? [{ key: `origin:${lesson.id}`, kind: 'origin' as const, time: lesson.time, duration: lesson.duration, booked: true, title, teachers: [lesson.teacher], color, muted: Boolean(draft), lessonId: lesson.id }] : []),
              ...(draft?.date === column.date ? [{ key: `draft:${lesson.id}`, kind: 'draft' as const, time: draft.time, duration: lesson.duration, booked: true, title, teachers: [...new Set([draft.teacher, ...(isFocused ? options.find(option => option.time === draft.time)?.teachers || [] : [])])], color, teacher: draft.teacher, compactName: familyPlanning && !isFocused ? lesson.student.firstName : undefined, lessonId: lesson.id }] : []),
            ]
          })
          const candidates = focus ? options.filter(option => !foreground.some(card => card.kind === 'draft' && card.lessonId === focus.id && card.time === option.time)).map(option => ({ key: `option:${focus.id}:${option.time}`, kind: 'option' as const, time: option.time, duration: focus.duration, booked: false, title: lessonTitle(focus), teachers: option.teachers, lessonId: focus.id })) : []
          const placed = placeCalendarBlocks([...foreground, ...candidates].filter(card => minutesOf(card.time) >= startMinutes && minutesOf(card.time) < endMinutes), startMinutes).blocks
          // Only cards in the same overlapping run share width. Grey occupancy stays behind them.
          const runs: { end: number; lanes: number; cards: typeof placed }[] = []
          for (const card of placed) {
            const end = card.row + card.duration / 15
            const last = runs.at(-1)
            if (!last || card.row >= last.end) runs.push({ end, lanes: card.lane + 1, cards: [card] })
            else { last.cards.push(card); last.end = Math.max(last.end, end); last.lanes = Math.max(last.lanes, card.lane + 1) }
          }
          const occupiedRows = new Set(layout.blocks.flatMap(block => Array.from({ length: Math.max(1, block.duration / 15) }, (_, step) => block.row + step)))
          return <div className={calendarStyles.daySlots} data-resource-column={column.resource.id} data-resource-date={column.date} style={{ gridTemplateRows: `repeat(${rows}, var(--calendar-slot-height))`, gridTemplateColumns: `repeat(${layout.lanes}, minmax(0, 1fr))` }}>
            {times.filter((_, index) => index % 2 === 0).map(time => {
              const index = times.indexOf(time)
              const reason = rescheduling ? 'Not available' : slotReason(column.date, time, column.resource.id)
              const occupied = occupiedRows.has(index)
              const active = drawing.current?.column === id && drawEnd && minutesOf(time) >= Math.min(minutesOf(drawing.current.time), minutesOf(drawEnd)) && minutesOf(time) <= Math.max(minutesOf(drawing.current.time), minutesOf(drawEnd))
              return <button key={time} type="button" disabled={Boolean(reason)} title={reason || undefined} data-unavailable={Boolean(reason) || undefined} data-available={reason ? undefined : time} aria-label={`${reason ? 'Unavailable' : 'Book'} ${column.resource.name}, ${column.date} at ${time}`} className={reason ? undefined : calendarStyles.bookableSlot} style={{ gridRow: `${index + 1} / span 2`, gridColumn: '1 / -1', border: reason ? 0 : '1.5px dotted transparent', borderRadius: reason ? 0 : 5, background: occupied || rescheduling ? undefined : reason && showUnavailable ? colors.border : active ? colors.surfaceMuted : undefined, opacity: 1, margin: 0, padding: 0, cursor: reason ? 'not-allowed' : mobile ? 'default' : 'crosshair', touchAction: 'pan-x pan-y' }} onPointerDown={event => { if (mobile || event.pointerType === 'touch' || event.button !== 0 || reason || rescheduling) return; drawing.current = { date: column.date, time, resource: column.resource.id, column: id }; setDrawEnd(time) }} onPointerEnter={() => { if (!mobile && drawing.current?.column === id) setDrawEnd(time) }} onPointerUp={event => {
                if (mobile || event.pointerType === 'touch') return
                const start = drawing.current
                if (!start || start.column !== id) return
                const from = clock(Math.min(minutesOf(start.time), minutesOf(time)))
                const duration = Math.abs(minutesOf(time) - minutesOf(start.time)) + 30
                const invalid = slotReason(start.date, from, start.resource, duration)
                if (!invalid) bookSlot(start.date, from, start.resource, duration)
                else setNotice(invalid)
                drawing.current = null; setDrawEnd(null)
                }} onClick={event => { if (reason) return; if (event.detail === 0) bookSlot(column.date, time, column.resource.id) }} />
            })}
            {runs.flatMap(({ lanes, cards }) => cards.map(card => {
              const when = `${dayShort(column.date)} · ${timeShort(card.time)}`
              const position = { gridRow: `${card.row + 1} / span ${Math.ceil(card.duration / 15)}`, gridColumn: '1 / -1', width: `calc(${100 / lanes}% - 6px)`, marginLeft: `calc(${card.lane * 100 / lanes}% + 3px)`, boxSizing: 'border-box' as const, justifySelf: 'start' as const, minHeight: 0 }
              if (card.kind === 'origin') return <CalendarBookingBlock key={card.key} data-origin data-reschedule-lesson={card.lessonId} title={card.title} detailed style={{ ...position, ...card.color, gridTemplateColumns: 'minmax(0, 1fr)', background: card.muted ? `color-mix(in srgb, var(--calendar-student-surface) 40%, ${colors.surface})` : 'var(--calendar-student-surface)', color: 'var(--calendar-student-text)', border: '1px solid var(--calendar-student-border)', zIndex: 2, display: 'grid', gap: 1, alignContent: 'center', overflow: 'hidden', fontSize: 11, lineHeight: '14px' }}>
                <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.title}</strong><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{when}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>w/ {card.teachers[0]}</span>
              </CalendarBookingBlock>
              const choose = (teacher: string) => {
                if (!teacher || !focus || card.lessonId !== focus.id) return
                const booking = { date: column.date, time: card.time, teacher, program: focus.program }
                if (familyFocus) { setMoves(previous => ({ ...previous, [familyFocus.id]: booking })); setFamilyError('') }
                else setPick(booking)
              }
              const picked = card.kind === 'draft'
              return <BookableSlot key={card.key} title={card.title} when={when} teachers={card.teachers} selectedTeacher={picked ? card.teacher : undefined} picked={picked} compactName={picked ? card.compactName : undefined} constrainText
                teacherLabel={`Teacher for ${when}`} style={{ ...position, ...(picked ? card.color : {}), zIndex: picked ? 3 : 2 }}
                onPick={() => { if (card.teachers.length === 1) choose(card.teachers[0]) }} onChooseTeacher={choose} />
            }))}
            {layout.blocks.map(({ item, row, duration, lane }) => {
              if (rescheduling) {
                if (reschedule?.id === item.id || (item.participantLessonIds?.length && item.participantLessonIds.every(id => familyLessons.some(lesson => lesson.id === id)))) return null
                return <div key={item.id} aria-hidden title="Not available" style={{ gridRow: `${row + 1} / span ${duration / 15}`, gridColumn: '1 / -1', background: colors.border, borderRadius: 5, cursor: 'not-allowed', zIndex: 1 }} />
              }
              const inScope = Boolean(scopeStudents && item.studentIds.some(id => scopeStudents.has(id)))
              // Scoped: the family's lessons take the column and everything else becomes a bar without text,
              // so the week stays legible instead of splitting each day into a dozen unreadable lanes.
              if (scopeStudents && !inScope) return <div key={item.id} aria-hidden style={{ gridRow: `${row + 1} / span ${duration / 15}`, gridColumn: lane + 1, background: colors.textSecondary, opacity: 0.18, borderRadius: 4, zIndex: 1 }} />
              return <CalendarBookingBlock key={item.id} interactive detailed data-booking-id={item.id} data-scoped={inScope || undefined} data-cancelled={item.status === 'Cancelled' || undefined} aria-label={`${item.status === 'Cancelled' ? 'Cancelled · ' : ''}${item.title}, ${item.studentNames.join(', ') || item.teacherName}, ${item.date} ${item.start}–${item.end}`} aria-haspopup="dialog" aria-expanded={selected?.id === item.id} title={item.status === 'Cancelled' ? 'Cancelled lesson' : undefined} style={{ gridRow: `${row + 1} / span ${duration / 15}`, gridColumn: '1 / -1', zIndex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', ...(scopeStudents && inScope ? { gridColumn: '1 / -1', zIndex: 3, outline: `1.5px solid ${colors.border}` } : {}), ...calendarServiceStyle(item), ...(item.status === 'Cancelled' ? { borderStyle: 'dashed', opacity: 0.65 } : {}) }} onClick={event => {
                if (rescheduling) return
                blockRef.current = event.currentTarget
                const bounds = event.currentTarget.getBoundingClientRect()
                setAnchor({ top: Math.max(12, Math.min(bounds.top, window.innerHeight - 470)), left: Math.max(12, Math.min(bounds.right + 8, window.innerWidth - inspectorWidth - 12)) })
                setSelected(item)
              }}>
                <strong style={{ textDecoration: item.status === 'Cancelled' ? 'line-through' : undefined }}>{item.title}</strong><span>{item.studentNames.join(', ') || item.teacherName}</span><span>{formatScheduleTime(item.start)} · {item.room || (isStaffDuty(item.kind) ? setup.locations.find(location => location.id === item.locationId)?.values.name : item.teacherName)}</span>
              </CalendarBookingBlock>
            })}
          </div>
        }} />
        </div>
      </div>
      </div>

      {done && <Modal isOpen size="sm" ariaLabel={done.length === 1 ? "Lesson rescheduled" : "Lessons rescheduled"} onClose={leaveReschedule}>
        <ModalHeader title={done.length === 1 ? "Lesson rescheduled" : "Lessons rescheduled"} onClose={leaveReschedule} />
        <ModalBody>
          {done.map((entry, index) => <div key={index} style={{ display: 'grid', gap: spacing.xs, marginBottom: spacing.md }}>
            <strong style={{ ...typography.body }}>{entry.title}</strong>
            <span style={{ ...typography.body }}>{entry.when}</span>
            <span style={{ ...typography.body, color: colors.textSecondary }}>w/ {entry.teacher}{entry.room ? ` · ${entry.room}` : ''}</span>
          </div>)}
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
      {selected && !rescheduling && (
        <div ref={inspectorRef} role="dialog" aria-label="Booking details" tabIndex={-1} style={{ position: 'fixed', top: anchor.top, left: anchor.left, zIndex: 60, width: `min(${inspectorWidth}px, calc(100vw - 24px))`, boxSizing: 'border-box', maxHeight: `calc(100dvh - ${anchor.top + 12}px)`, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflowY: 'auto', padding: spacing.lg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
            <h2 style={{ flex: 1, minWidth: 0, margin: 0, overflowWrap: 'anywhere', fontSize: typography.sizeXl }}>{selected.title}</h2>
            {inspectorActions.length > 0 && <OverflowMenu key={selected.id} label="Booking actions" items={inspectorActions} />}
            <ControlButton kind="icon" aria-label="Close booking details" onClick={() => { setSelected(null); blockRef.current?.focus({ preventScroll: true }) }}><X size={18} aria-hidden="true" /></ControlButton>
          </div>
          <p style={{ margin: `0 0 ${spacing.lg}`, color: colors.textSecondary, fontSize: typography.sizeBase }}>{dayName(selected.date)} · {inspectorTimeRange(selected.start, selected.end)} · {selected.serviceType}</p>
          {isStaffDuty(selected.kind) && <p>{setup.locations.find(location => location.id === selected.locationId)?.values.name}{selected.notes ? ` · ${selected.notes}` : ''}</p>}
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.lg }}>
            {!isStaffDuty(selected.kind) && <div>
              <dt style={inspectorLabel}>{selected.studentNames.length > 1 ? 'Students' : 'Student'}</dt>
              <dd style={{ ...inspectorValue, display: 'grid', justifyItems: 'start', gap: spacing.xs }}>
                {selected.studentNames.length ? selected.studentNames.map((name, index) => {
                  const studentId = selected.studentIds[index]
                  return studentId && studentOf(studentId) ? <ControlButton key={studentId} kind="name" style={{ fontWeight: typography.weightSemibold, textDecoration: 'underline', textUnderlineOffset: 3, textAlign: 'left' }} onClick={() => { setStudentPanel(studentId); setSelected(null) }}>{name}<ArrowUpRight size={13} style={{ flexShrink: 0 }} aria-hidden="true" /></ControlButton> : <span key={`${name}:${index}`}>{name}</span>
                }) : 'No student booked'}
              </dd>
            </div>}
            <div><dt style={inspectorLabel}>Teacher</dt><dd style={inspectorValue}>{selected.teacherName || 'Not assigned'}</dd></div>
            <div><dt style={inspectorLabel}>Room</dt><dd style={inspectorValue}>{selected.room || 'Not assigned'}</dd></div>
            <div><dt style={inspectorLabel}>Status</dt><dd style={{ ...inspectorValue, fontWeight: typography.weightNormal }}>{selected.status}{inspectedCancellation && ` · ${inspectedCancellation.reason}${inspectedCancellation.credited ? ' · make-up credited' : ''}${inspectedCancellation.charged ? ' · charged' : ' · not charged'}`}</dd></div>
          </dl>
          {inspectedAttendance.length > 0 && <section style={{ marginTop: spacing.lg, paddingTop: spacing.lg, borderTop: `1px solid ${colors.border}` }}>
            <h3 style={{ margin: `0 0 ${spacing.md}`, fontSize: typography.sizeMd }}>Take attendance</h3>
            <div style={{ display: 'grid', gap: spacing.md }}>
              {inspectedAttendance.map(({ lesson, name }) => <div key={lesson.id} role="group" aria-label={`Attendance · ${name}`}>
                {inspectedAttendance.length > 1 && <strong style={inspectorLabel}>{name}</strong>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: spacing.xs }}>
                  {attendanceOutcomes.map(outcome => <ControlButton key={outcome} kind="toggle" selected={lesson.attendance === outcome} aria-pressed={lesson.attendance === outcome} style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, minHeight: 42, padding: spacing.xs, ...(lesson.attendance !== outcome && { color: colors.text }) }} onClick={() => onApply(current => markParticipantAttendance(expandPreviewCalendar(current, selected.date), lesson.id, lesson.attendance === outcome ? undefined : outcome))}>{outcome === 'Excused absence' ? 'Excused' : outcome}</ControlButton>)}
                </div>
              </div>)}
            </div>
          </section>}
        </div>
      )}


      {notice && <div style={{ padding: '0 0 10px' }}><Notice variant="info" onDismiss={() => setNotice('')}>{notice}</Notice></div>}

      {message && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: spacing.md }} onClick={() => setMessage(null)}>
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
