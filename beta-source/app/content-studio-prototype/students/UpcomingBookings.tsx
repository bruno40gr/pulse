'use client'

import { List, Grid2X2 } from 'lucide-react'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useContext, useState } from 'react'
import { InlineWorkspaceContext } from './AccountWorkspace'
import { WeeklySchedule } from './WeeklySchedule'
import { LessonSelectionToolbar } from './LessonSelectionToolbar'
import { ConfirmActionButton } from './ConfirmActionButton'
import { SectionHeader, SectionHeading } from './SectionHeader'
import { Avatar, Badge, Button, EmptyState, SurfacePanel, Modal, ModalHeader, ModalBody, ModalFooter, DenseSectionPanel } from '@/beta-source/components/ui'
import { ControlButton } from '@/beta-source/components/ui/ControlButton'
import { OverflowMenu } from '@/beta-source/components/ui/OverflowMenu'
import { formatScheduleDate, formatScheduleTime, shiftDate, weekStart } from '@/beta-source/lib/academy-enrollment-schedule'
import { makeupPreviewNow, previewCalendarLessons, absenceEligible } from '@/beta-source/lib/academy-makeup-preview'
import { colors, avatarSizes, spacing, typography } from '@/beta-source/lib/tokens'
import { getStaffAvatarUrl } from '@/beta-source/lib/staff-avatars'
import { getActiveTenantId } from '@/beta-source/lib/tenant'
import type { WorkspaceSectionProps } from './WorkspaceSections'
import { LessonStatus } from './LessonStatus'

export function UpcomingBookings({ data, makeups, location, onEnsure, onLesson, onMove, onCalendar, lessonView, onLessonView, lessonWeek, onLessonWeek, onRescheduleTogether, onCancelTogether }: Pick<WorkspaceSectionProps, 'data' | 'makeups' | 'location' | 'onEnsure' | 'onLesson' | 'onMove' | 'onCalendar' | 'lessonView' | 'onLessonView' | 'lessonWeek' | 'onLessonWeek' | 'onRescheduleTogether' | 'onCancelTogether'>) {
  const inline = useContext(InlineWorkspaceContext)
  const [localWeek, setWeek] = useState(() => weekStart(makeupPreviewNow.slice(0, 10)))
  const week = inline && lessonWeek ? lessonWeek : localWeek
  const through = shiftDate(week, 6)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const [dateView, setDateView] = useState('week')
  const [rangeStart, setRangeStart] = useState(week)
  const [rangeEnd, setRangeEnd] = useState(shiftDate(week, 20))
  const listView = inline && lessonView !== 'calendar'
  const horizon = data.demoSchool ? '2027-04-01' : data.lessons.reduce((last, item) => item.date > last ? item.date : last, through)
  const from = listView && dateView === 'all' ? makeupPreviewNow.slice(0, 10) : listView && dateView === 'range' ? rangeStart : week
  const to = listView && dateView === 'all' ? horizon : listView && dateView === 'range' ? rangeEnd : through
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const selectedLessons = previewCalendarLessons(data, makeups, { ...location, enrollmentId: '', teacher: '' }).filter(item => checked.includes(item.id))
  const tenantId = getActiveTenantId()
  const bookings = previewCalendarLessons(data, makeups, { ...location, enrollmentId: '', teacher: '' }).filter(item => item.date >= from && item.date <= to)
  function navigateWeek(days: number) { const next = shiftDate(week, days); onEnsure(shiftDate(next, 6)); setWeek(next); onLessonWeek?.(next); setSelectedId(null) }
  return <section aria-label="Upcoming bookings" style={{ display: 'flex', flexDirection: 'column', gap: inline ? 10 : spacing.md, minWidth: 0 }}>
    <SectionHeader compactActions={inline} actions={inline ? <div role="group" aria-label="Lesson view" style={{ display: 'flex', gap: spacing.xs }}>{(['list', 'calendar'] as const).map(view => <ControlButton key={view} kind="toggle" selected={(lessonView || 'list') === view} aria-pressed={(lessonView || 'list') === view} onClick={() => onLessonView?.(view)}>{view === 'list' ? <List size={16} aria-hidden="true" /> : <Grid2X2 size={16} aria-hidden="true" />}{view === 'list' ? 'List' : 'Calendar'}</ControlButton>)}</div> : <Button variant="secondary" size="md" onClick={onCalendar}>View calendar</Button>}>
      <SectionHeading>{inline ? 'Schedule & lessons' : <>Week of {formatScheduleDate(week)} – {formatScheduleDate(through)}</>}</SectionHeading>
      {!inline && <div role="group" aria-label="Browse lesson weeks" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}><ControlButton kind="icon" aria-label="Previous lesson week" onClick={() => navigateWeek(-7)} style={{ width: 40, height: 40 }}><ChevronLeft size={20} aria-hidden="true" /></ControlButton><ControlButton kind="icon" aria-label="Next lesson week" onClick={() => navigateWeek(7)} style={{ width: 40, height: 40 }}><ChevronRight size={20} aria-hidden="true" /></ControlButton></div>}
    </SectionHeader>
    {inline && <LessonSelectionToolbar mode={dateView} calendar={!listView} onMode={value => { setDateView(value); if (value !== 'week') onEnsure(value === 'all' ? horizon : rangeEnd) }} week={week} lastDate={shiftDate(week, bookings.some(item => item.date === through) ? 6 : 5)} onWeek={next => { onEnsure(shiftDate(next, 6)); setWeek(next); onLessonWeek?.(next); setSelectedId(null) }} horizon={horizon} from={rangeStart} through={rangeEnd} onFrom={setRangeStart} onThrough={value => { setRangeEnd(value); onEnsure(value > horizon ? horizon : value) }} count={checked.length} onClear={() => setChecked([])} onReschedule={() => onRescheduleTogether?.(checked)} onCancel={onCancelTogether ? () => { setCancelError(''); setCancelOpen(true) } : undefined} />}
    <Modal isOpen={cancelOpen} onClose={() => setCancelOpen(false)} size="md" layout="content" ariaLabel={checked.length > 1 ? 'Cancel selected lessons' : 'Cancel selected lesson'}>
      <ModalHeader title={checked.length > 1 ? `Cancel ${checked.length} lessons?` : 'Cancel this lesson?'} onClose={() => setCancelOpen(false)} />
      <ModalBody><div style={{ display: 'grid', gap: spacing.md }}>
        <p style={{ ...typography.bodySmall, margin: 0 }}>Only these lesson occurrences will be cancelled. Recurring subscriptions stay unchanged.</p>
        {selectedLessons.map(item => <DenseSectionPanel key={item.id} title={`${item.student.firstName} · ${item.program}`}><strong style={typography.bodySmall}>{formatScheduleDate(item.date)} · {formatScheduleTime(item.time)}</strong><p style={{ ...typography.bodySmall, color: colors.textSecondary }}>{item.teacher}</p><p style={typography.bodySmall}>{absenceEligible(item.date, item.time) ? item.makeup ? 'Makeup credit returns to the makeup bin.' : 'A makeup credit will be added.' : 'Less than 24 hours away: no makeup credit will be added or returned.'}</p></DenseSectionPanel>)}
        {cancelError && <p role="alert">{cancelError}</p>}
      </div></ModalBody>
      <ModalFooter><Button variant="secondary" onClick={() => setCancelOpen(false)}>Keep lessons</Button><ConfirmActionButton variant="destructive" disabled={!checked.length || selectedLessons.length !== checked.length} loadingLabel="Cancelling lessons" onClick={() => { const error = onCancelTogether?.(checked); if (error) setCancelError(error); else { setCancelOpen(false); setChecked([]) } }}>Cancel</ConfirmActionButton></ModalFooter>
    </Modal>
    {listView && dateView === 'range' && rangeStart > rangeEnd && <p role="alert">Choose an end date on or after the start date.</p>}
    {inline && lessonView === 'calendar' ? <WeeklySchedule data={data} makeups={makeups} location={location} onEnsure={onEnsure} onLesson={onLesson} onMove={onMove} taskLayout compact week={week} onWeek={onLessonWeek} /> : <>{bookings.map(item => {
      const [firstName, ...rest] = item.teacher.split(' ')
      const cancelled = item.status === 'Absent' || item.status === 'Cancelled'
      const rescheduled = !cancelled && 'originalDate' in item && Boolean(item.originalDate && item.originalDate !== item.date)
      const status = cancelled ? 'Cancelled' : rescheduled ? 'Rescheduled' : item.status
      return <SurfacePanel key={item.id} appearance="flat" padding={spacing.lg} style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.lg, minWidth: 0 }}>
          {inline && onRescheduleTogether && item.status === 'Scheduled' && <input type="checkbox" aria-label={`Include ${item.student.firstName} ${item.program} lesson ${item.date}`} checked={checked.includes(item.id)} onChange={event => setChecked(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} style={{ width: 18, height: 18, flexShrink: 0, margin: 0 }} />}
          <ControlButton kind="row" aria-label={`Select ${item.student.firstName} ${item.program} lesson ${item.date}${item.makeup ? ', makeup lesson' : ''}`} aria-pressed={selectedId === item.id} onClick={() => setSelectedId(selectedId === item.id ? null : item.id)} style={{ flex: 1, minWidth: 0, padding: 0, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', gap: spacing.xs, textAlign: 'left' }}>
            <span style={{ ...typography.h2, margin: 0, color: colors.text, fontWeight: typography.weightBold }}>
              {formatScheduleDate(item.date, { weekday: 'long', month: 'short', day: 'numeric' })} · {formatScheduleTime(item.time)}
            </span>
            <span style={{ ...typography.bodySmall, color: colors.textSecondary }}>
              {item.student.firstName} · {item.program} • {item.duration} min
            </span>
          </ControlButton>
          {item.status === 'Scheduled' && <OverflowMenu label={`${item.student.firstName} ${item.program} lesson ${item.date} actions`} items={[{ label: 'Reschedule lesson', onSelect: () => onMove(item.id) }, { label: 'Cancel lesson', onSelect: () => onLesson(item.id) }]} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', minWidth: 0, marginLeft: inline && onRescheduleTogether && item.status === 'Scheduled' ? `calc(18px + ${spacing.lg})` : undefined }}>
          <Avatar firstName={firstName} lastName={rest.join(' ')} size={avatarSizes.sm} src={getStaffAvatarUrl(tenantId, item.teacher)} />
          <span style={{ ...typography.bodySmall, color: colors.textMuted }}>{item.teacher}</span>
          <LessonStatus status={status} />
          {item.makeup && <Badge size="sm" variant="info">Makeup lesson</Badge>}
          {!item.makeup && item.enrollment.frequency === 'One-off' && <Badge size="sm">One-off</Badge>}
        </div>
      </SurfacePanel>
    })}
    {!bookings.length && <EmptyState title="No lessons in this date range" />}</>}
  </section>
}
