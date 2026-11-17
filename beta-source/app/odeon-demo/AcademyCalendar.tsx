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
import { bookingReason, saveCalendarBooking, roomRecords, configuredBlocks, isStaffDuty, staffDutyLabel, type CalendarBooking } from '@/beta-source/lib/academy-calendar-booking'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { ChevronLeft, ChevronRight, Check, X, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ControlButton } from '@/components/ui/ControlButton'
import { CalendarTimeGrid } from '../content-studio-prototype/enrollment/CalendarTimeGrid'
import { CalendarBookingBlock } from '../content-studio-prototype/enrollment/CalendarBookingBlock'
import { MoveLesson } from '../content-studio-prototype/students/MoveLesson'
import { InlineWorkspaceContext } from '../content-studio-prototype/students/AccountWorkspace'
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

export default function AcademyCalendar({ data, groups, events, setup, today, onApply, makeups, onDemoChange, onSetup, onEnroll }: {
  onEnroll: (booking: CalendarBooking, action: 'staff' | 'send') => void
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

  const dates = useMemo(() => (dayMode ? [focusDate] : betaWeekDates(week)), [dayMode, focusDate, week])
  // The same recurring expansion the family portal sees, so both agree.
  const expanded = useMemo(() => expandPreviewCalendar(data, dates[dates.length - 1]), [data, dates])
  const occurrences = useMemo(() => betaCalendarOccurrences({ ...expanded, calendarBookings: [...(expanded.calendarBookings || []), ...configuredBlocks(setup)] }, groups, events, dates).map(item => {
    const booking = [...(expanded.calendarBookings || []), ...configuredBlocks(setup)].find(booking => booking.id === item.bookingId)
    return booking ? { ...item, room: roomRecords(setup).find(room => room.id === booking.roomId)?.name || '', teacherName: setup.teachers.find(teacher => teacher.id === booking.teacherId)?.values.name || '' } : item
  }), [expanded, groups, events, dates, setup])
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
  const emptyMakeupState = { items: [], absences: [] }

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

  function finishReschedule() {
    setReschedule(null); setSelected(null)
    requestAnimationFrame(() => {
      window.scrollTo(returnScroll.current.x, returnScroll.current.y)
      blockRef.current?.focus({ preventScroll: true })
    })
  }

  const studentOf = (id: string) => data.students.find(student => student.id === id)
  const selectedStudent = selected?.studentIds[0] ? studentOf(selected.studentIds[0]) : undefined

  function cancelOccurrence() {
    if (!selected) return
    onApply(current => changeSessionOccurrence(expandPreviewCalendar(current, selected.date), selected.id, { status: 'Cancelled' }))
    setNotice(`Cancelled ${selected.title} on ${dayName(selected.date)}.`)
    setSelected(null)
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
      <PageHeader density="compact" singleLine title="Academy calendar" subtitle={`${dayMode ? dayName(focusDate) : `${dayName(dates[0])} – ${dayName(dates[dates.length - 1])}`} · ${visible.length} scheduled`} right={!reschedule && <Button style={{ whiteSpace: 'nowrap' }} onClick={() => bookSlot(focusDate, '15:00')}><Plus size={16} />Add booking</Button>} />

      <div hidden={Boolean(reschedule)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: '0 0 10px', flexWrap: 'wrap' }}>
        <Tabs<CalendarPerspective> variant="prominent" controlSize="toolbar" ariaLabel="View by" activeKey={perspective} onChange={view => { setPerspective(view); setWeekResource(''); setSelected(null) }} items={[{ key: 'teacher', label: 'Teacher' }, { key: 'room', label: 'Room' }, { key: 'service', label: 'Service' }]} />
        {!dayMode && !mobile && <div style={{ width: 230 }}><Select controlSize="toolbar" aria-label={perspective === 'teacher' ? 'Week teacher' : perspective === 'service' ? 'Week service' : 'Week room'} value={activeResource?.id || ''} onChange={event => { setWeekResource(event.target.value); setSelected(null) }}><option value="">All {perspective === 'teacher' ? 'teachers' : perspective === 'room' ? 'rooms' : 'services'}</option>{shownResources.map(resource => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</Select></div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: '0 0 10px', flexWrap: 'wrap' }}>
        {mobile ? <Button size="toolbar" variant="secondary" aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>Filters{filterCount > 0 ? ` (${filterCount})` : ''}</Button> : <>
        <CalendarFilter label="Staff" options={calendarResources('teacher', setup, occurrences)} value={filters.staff} onChange={staff => setFilters(current => ({ ...current, staff }))} />
        <CalendarFilter label="Room" options={calendarResources('room', setup, occurrences)} value={filters.room} onChange={room => setFilters(current => ({ ...current, room }))} />
        <CalendarFilter label="Service" options={calendarResources('service', setup, occurrences)} value={filters.service} onChange={service => setFilters(current => ({ ...current, service }))} />
        <Checkbox label="Show unavailable time" checked={showUnavailable} onChange={event => setShowUnavailable(event.target.checked)} />
        {filterCount > 0 && <Button size="toolbar" variant="secondary" onClick={resetFilters}>Reset filters</Button>}
        </>}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap', marginLeft: 'auto' }}>
          <ControlButton kind="icon" aria-label={`Previous ${dayMode ? 'day' : 'week'}`} onClick={() => { const next = betaShiftDate(focusDate, dayMode ? -1 : -7); setFocusDate(next); setWeek(betaWeekStart(next)); setSelected(null) }}><ChevronLeft size={18} /></ControlButton>
          <Button variant="secondary" onClick={() => { setWeek(betaWeekStart(today)); setFocusDate(today) }}>Today</Button>
          <ControlButton kind="icon" aria-label={`Next ${dayMode ? 'day' : 'week'}`} onClick={() => { const next = betaShiftDate(focusDate, dayMode ? 1 : 7); setFocusDate(next); setWeek(betaWeekStart(next)); setSelected(null) }}><ChevronRight size={18} /></ControlButton>
          <div style={{ width: 158 }}><Input type="date" aria-label="Calendar date" value={focusDate} onChange={event => { if (event.target.value) { setFocusDate(event.target.value); setWeek(betaWeekStart(event.target.value)); setSelected(null) } }} /></div>
          <Tabs<'Day' | 'Week'> variant="prominent" controlSize="toolbar" ariaLabel="Calendar range" activeKey={dayMode ? 'Day' : 'Week'} onChange={range => { setDayMode(range === 'Day'); setSelected(null) }} items={[{ key: 'Day', label: 'Day' }, { key: 'Week', label: 'Week' }]} />
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
      {visible.some(item => isStaffDuty(item.kind)) && <div aria-label="Staff duty coverage" style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md, paddingBottom: spacing.md }}>{visible.filter(item => isStaffDuty(item.kind)).map(item => <span key={`${item.id}:${item.date}`}><strong>{staffDutyLabel(item.kind)}</strong> · {setup.locations.find(location => location.id === item.locationId)?.values.name} · {item.teacherName} · {item.date} {item.start}–{item.end}</span>)}</div>}
      <CalendarTimeGrid dates={columns.map(column => column.id)} times={times} label="Academy schedule" minimumColumnWidth={allWeek ? 240 : 180} slotHeight={30} maxHeight="72vh" initialScrollTime={occurrences.length ? clock(Math.max(startMinutes, Math.min(...occurrences.map(item => minutesOf(item.start))) - 30)) : undefined}
        renderDayHeading={id => { const column = columns.find(item => item.id === id)!; const teacher = perspective === 'teacher' ? setup.teachers.find(item => item.id === column.resource.id) : undefined; const [firstName, ...lastName] = column.resource.name.split(' '); return <><span>{dayMode ? dayName(column.date) : betaWeekdayName(column.date)}</span><strong style={{ fontSize: typography.sizeSm, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{teacher && <Avatar firstName={firstName} lastName={lastName.join(' ')} size={26} src={teacher.values.photo || teacher.values.avatar_url || teacher.values.image || undefined} />}{dayMode ? column.resource.name : dayName(column.date)}</strong></> }}
        renderDay={id => {
          const column = columns.find(item => item.id === id)!
          const items = visible.filter(item => item.date === column.date && (!column.resource.id || calendarResourceIds(item, perspective, setup).includes(column.resource.id)))
          const layout = placeCalendarBlocks(items.map(item => ({ item, time: item.start, duration: minutesOf(item.end) - minutesOf(item.start), booked: true })), startMinutes)
          return <div className={calendarStyles.daySlots} data-resource-column={column.resource.id} data-resource-date={column.date} style={{ gridTemplateRows: `repeat(${rows}, var(--calendar-slot-height))`, gridTemplateColumns: `repeat(${layout.lanes}, minmax(0, 1fr))` }}>
            {times.filter((_, index) => index % 2 === 0).map(time => {
              const index = times.indexOf(time)
              const reason = slotReason(column.date, time, column.resource.id)
              const active = drawing.current?.column === id && drawEnd && minutesOf(time) >= Math.min(minutesOf(drawing.current.time), minutesOf(drawEnd)) && minutesOf(time) <= Math.max(minutesOf(drawing.current.time), minutesOf(drawEnd))
              return <button key={time} type="button" disabled={Boolean(reason)} title={reason || undefined} data-unavailable={Boolean(reason) || undefined} aria-label={`${reason ? 'Unavailable' : 'Book'} ${column.resource.name}, ${column.date} at ${time}`} style={{ gridRow: `${index + 1} / span 2`, gridColumn: '1 / -1', border: 0, background: reason && showUnavailable ? colors.border : active ? colors.surfaceMuted : 'transparent', opacity: 1, margin: 0, padding: 0, cursor: reason ? 'not-allowed' : mobile ? 'default' : 'crosshair', touchAction: 'pan-x pan-y' }} onPointerDown={event => { if (mobile || event.pointerType === 'touch' || event.button !== 0 || reason) return; drawing.current = { date: column.date, time, resource: column.resource.id, column: id }; setDrawEnd(time) }} onPointerEnter={() => { if (!mobile && drawing.current?.column === id) setDrawEnd(time) }} onPointerUp={event => {
                if (mobile || event.pointerType === 'touch') return
                const start = drawing.current
                if (!start || start.column !== id) return
                const from = clock(Math.min(minutesOf(start.time), minutesOf(time)))
                const duration = Math.abs(minutesOf(time) - minutesOf(start.time)) + 30
                const invalid = slotReason(start.date, from, start.resource, duration)
                if (!invalid) bookSlot(start.date, from, start.resource, duration)
                else setNotice(invalid)
                drawing.current = null; setDrawEnd(null)
              }} onClick={event => { if (event.detail === 0 && !reason) bookSlot(column.date, time, column.resource.id) }} />
            })}
            {layout.blocks.map(({ item, row, duration, lane }) => {
              return <CalendarBookingBlock key={item.id} interactive detailed data-booking-id={item.id} data-cancelled={item.status === 'Cancelled' || undefined} aria-label={`${item.status === 'Cancelled' ? 'Cancelled · ' : ''}${item.title}, ${item.studentNames.join(', ') || item.teacherName}, ${item.date} ${item.start}–${item.end}`} aria-haspopup="dialog" aria-expanded={selected?.id === item.id} title={item.status === 'Cancelled' ? 'Cancelled lesson' : undefined} style={{ gridRow: `${row + 1} / span ${duration / 15}`, gridColumn: lane + 1, zIndex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', ...calendarServiceStyle(item), ...(item.status === 'Cancelled' ? { borderStyle: 'dashed', opacity: 0.65 } : {}) }} onClick={event => {
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
      {reschedule && taskItem && <InlineWorkspaceContext.Provider value><MoveLesson key={taskItem.id} item={taskItem} data={expanded} state={emptyMakeupState} initialDate={taskItem.date} onBack={finishReschedule} onMove={applyReschedule} availableSlots={replacementSlots} /></InlineWorkspaceContext.Provider>}

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
            <div><strong>Status</strong><p style={{ margin: '2px 0 0' }}>{selected.status}</p></div>
            {selected.kind === 'lesson' && selected.status !== 'Cancelled' && selected.participantLessonIds?.map(id => {
              const lesson = expanded.lessons.find(item => item.id === id)
              const student = expanded.students.find(item => item.enrollments.some(enrollment => enrollment.id === lesson?.enrollmentId))
              return lesson && student ? <div key={id} role="group" aria-label={`Attendance · ${student.firstName} ${student.lastName}`}><strong>Attendance · {student.firstName} {student.lastName}</strong><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>{attendanceOutcomes.map((outcome, index) => { const Icon = [Check, X, Minus][index]; return <ControlButton key={outcome} kind="toggle" selected={lesson.attendance === outcome} aria-pressed={lesson.attendance === outcome} onClick={() => onApply(current => markParticipantAttendance(expandPreviewCalendar(current, selected.date), id, lesson.attendance === outcome ? undefined : outcome))}><Icon size={14} aria-hidden="true" />{outcome}</ControlButton> })}</div></div> : null
            })}
            {selectedStudent && <Button variant="secondary" onClick={() => { setStudentPanel(selectedStudent.id); setSelected(null) }}>View profile</Button>}
            {selected.kind === 'lesson' && selected.status === 'Scheduled' && <Button variant="destructive" onClick={cancelOccurrence}>{selected.studentIds.length > 1 ? 'Cancel whole session' : 'Cancel this lesson'}</Button>}
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
