'use client'

import { Button, DenseSectionPanel, EmptyState, FieldGrid, Select, SurfacePanel } from '@/components/ui'
import { ControlButton } from '@/components/ui/ControlButton'
import { colors, spacing, typography } from '@/lib/tokens'
import { formatScheduleDate, formatScheduleTime, shiftDate } from '@/lib/academy-enrollment-schedule'
import { workspaceOccurrences, type LessonRequest, type PreviewStudent, type WorkspaceLocation, type createConnectedPreview } from '@/lib/academy-student-preview'
import type { WorkspaceOccurrence } from './WorkspaceSections'
import styles from './StudentWorkspace.module.css'

type Props = {
  data: ReturnType<typeof createConnectedPreview>; location: WorkspaceLocation; students: PreviewStudent[]; occurrences: WorkspaceOccurrence[]
  requests: LessonRequest[]; headingLevel: 'h2' | 'h3'; onNavigate: (patch: Partial<WorkspaceLocation>) => void; onLesson: (id: string) => void
  enrollmentScoped?: boolean
}
export function SchedulePreview({ data, location, students, occurrences, requests, headingLevel, onNavigate, onLesson, enrollmentScoped = false }: Props) {
  const weekStart = location.week ? '2026-11-09' : '2026-11-02'
  const dates = Array.from({ length: 5 }, (_, index) => shiftDate(weekStart, index))
  const weekLessons = occurrences.filter(lesson => dates.includes(lesson.date))
  const teachers = Array.from(new Set(workspaceOccurrences(data, { ...location, teacher: '', enrollmentId: '' }).map(item => item.teacher))).sort()
  return <DenseSectionPanel title={location.view === 'parent' && !location.studentId ? 'Family schedule' : 'Schedule'} headingLevel={headingLevel} actions={<div style={{ display: 'flex', gap: spacing.xs }}>
    {(['agenda', 'week'] as const).map(view => <ControlButton key={view} kind="toggle" selected={location.calendar === view} aria-pressed={location.calendar === view} onClick={() => onNavigate({ calendar: view })}>{view === 'agenda' ? 'Agenda' : 'Week calendar'}</ControlButton>)}
  </div>} contentStyle={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
    {!enrollmentScoped && <FieldGrid>
      <Select label="Enrollment filter" value={location.enrollmentId} onChange={event => onNavigate({ enrollmentId: event.target.value, teacher: '' })}><option value="">All enrollments</option>{students.flatMap(student => student.enrollments.map(item => <option key={item.id} value={item.id}>{student.firstName} · {item.program}</option>))}</Select>
      <Select label="Teacher filter" value={location.teacher} onChange={event => onNavigate({ teacher: event.target.value })}><option value="">All teachers</option>{teachers.map(teacher => <option key={teacher} value={teacher}>{teacher}</option>)}</Select>
    </FieldGrid>}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }}>
      <Button variant="secondary" size="sm" disabled={location.week === 0} onClick={() => onNavigate({ week: 0 })}>Previous week</Button>
      <span style={typography.body}>{formatScheduleDate(dates[0])}–{formatScheduleDate(dates[4], { month: 'short', day: 'numeric', year: 'numeric' })} · Los Angeles</span>
      <Button variant="secondary" size="sm" disabled={location.week === 1} onClick={() => onNavigate({ week: 1 })}>Next week</Button>
    </div>
    {location.calendar === 'agenda' ? <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
      {weekLessons.map(item => <SurfacePanel key={item.id} appearance="flat" tone="muted">
        <ControlButton kind="link" aria-label={`Open ${item.student.firstName} ${item.enrollment.program} ${item.date}`} onClick={() => onLesson(item.id)}>{formatScheduleDate(item.date, { weekday: 'short', month: 'short', day: 'numeric' })} · {formatScheduleTime(item.time)} · {item.student.firstName} · {item.enrollment.program}</ControlButton>
        <div style={{ ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs }}>{item.teacher} · {item.enrollment.duration} min · {item.room} · {requests.some(request => request.lessonId === item.id) ? 'Change requested (preview)' : item.status}</div>
        {item.teacher !== item.enrollment.teacher && <div style={typography.bodySmall}>Substitute for this lesson only · recurring teacher: {item.enrollment.teacher}</div>}
      </SurfacePanel>)}
      {!weekLessons.length && <EmptyState title="No lessons in this view" description="Try another week or clear your filters." />}
    </div> : <>
      <p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: 0 }}>Week calendar · 2–6 pm. On small screens, scroll horizontally or switch to Agenda. Empty space is not bookable availability.</p>
      <div className={styles.calendarScroll} role="region" aria-label="Week calendar" tabIndex={0}>
        <div className={styles.calendar}>
          <div aria-hidden="true" />{dates.map(date => <div key={date} style={{ ...typography.bodySmall, padding: spacing.sm, borderBottom: `1px solid ${colors.border}`, textAlign: 'center' }}>{formatScheduleDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}</div>)}
          <div className={styles.day}>{[14, 15, 16, 17].map(hour => <div key={hour} style={{ ...typography.bodySmall, position: 'absolute', top: (hour - 14) * 120, color: colors.textSecondary }}>{hour - 12} pm</div>)}</div>
          {dates.map(date => <div key={date} className={styles.day} style={{ borderLeft: `1px solid ${colors.border}` }}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map(row => <div key={row} style={{ position: 'absolute', top: row * 60, left: 0, right: 0, borderTop: `1px solid ${colors.borderLight}` }} />)}
            {weekLessons.filter(item => item.date === date).map((item, index, peers) => {
              const sameTime = peers.filter(peer => peer.time === item.time)
              const lane = sameTime.findIndex(peer => peer.id === item.id)
              const top = (Number(item.time.slice(0, 2)) * 60 + Number(item.time.slice(3)) - 14 * 60) * 2
              return <div key={item.id} className={styles.event} style={{ top, height: item.enrollment.duration * 2 - 2, left: `calc(${lane / sameTime.length * 100}% + 3px)`, width: `calc(${100 / sameTime.length}% - 6px)`, background: colors.surfaceMuted, border: `1px solid ${colors.border}`, borderRadius: 8, padding: spacing.xs }}>
                <ControlButton kind="link" style={{ textAlign: 'left', fontSize: typography.sizeSm }} aria-label={`Open ${item.student.firstName} ${item.enrollment.program} ${item.date}`} onClick={() => onLesson(item.id)}>{item.student.firstName} · {item.enrollment.program}</ControlButton>
                <div style={{ ...typography.bodySmall, fontSize: typography.sizeSm }}>{formatScheduleTime(item.time)} · {item.teacher}</div>
                {requests.some(request => request.lessonId === item.id) && <div style={{ ...typography.bodySmall, fontSize: typography.sizeSm }}>Change requested (preview)</div>}
              </div>
            })}
          </div>)}
        </div>
      </div>
    </>}
  </DenseSectionPanel>
}