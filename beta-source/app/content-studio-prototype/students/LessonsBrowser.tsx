'use client'

import { List, Grid2X2 } from 'lucide-react'

import { useState } from 'react'
import { Button, DenseSectionPanel, DetailField, EmptyState, FieldGrid, Input, Select, SectionTitle } from '@/beta-source/components/ui'
import { ControlButton } from '@/beta-source/components/ui/ControlButton'
import { formatScheduleDate, formatScheduleTime, shiftDate } from '@/beta-source/lib/academy-enrollment-schedule'
import { absenceEligible, makeupPreviewNow, previewCalendarLessons } from '@/beta-source/lib/academy-makeup-preview'
import { colors, spacing, typography } from '@/beta-source/lib/tokens'
import type { WorkspaceSectionProps } from './WorkspaceSections'
import { AccountSubscriptions } from './AccountSubscriptions'
import { WeeklySchedule } from './WeeklySchedule'
import styles from './StudentWorkspace.module.css'

export function LessonsBrowser(props: WorkspaceSectionProps) {
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [from, setFrom] = useState(makeupPreviewNow.slice(0, 10))
  const [subscription, setSubscription] = useState(props.location.enrollmentId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [managing, setManaging] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error, setError] = useState('')
  const location = { ...props.location, enrollmentId: subscription }
  const lessons = previewCalendarLessons(props.data, props.makeups, location)
  const entries = lessons.filter(item => item.date >= from && item.date <= shiftDate(from, 56))
  const selected = lessons.find(item => item.id === selectedId)
  const subscriptions = props.students.flatMap(student => student.enrollments.map(enrollment => ({ student, enrollment })))
  function select(id: string) { setSelectedId(id); setConfirmCancel(false); setError('') }
  function jump(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`))) return
    setFrom(date); setSelectedId(null); setConfirmCancel(false); props.onEnsure(shiftDate(date, 56))
  }
  if (managing) return <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}><div><Button variant="secondary" onClick={() => setManaging(false)}>Back to lessons</Button></div><AccountSubscriptions {...props} /></div>
  return <section aria-label="Lessons browser" style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
    <div className={styles.toolbar} style={{ justifyContent: 'space-between' }}><div role="group" aria-label="Lesson view">{(['list', 'calendar'] as const).map(item => <ControlButton key={item} kind="toggle" selected={view === item} aria-pressed={view === item} onClick={() => setView(item)}>{item === 'list' ? <List size={16} aria-hidden="true" /> : <Grid2X2 size={16} aria-hidden="true" />}{item === 'list' ? 'List' : 'Calendar'}</ControlButton>)}</div><Button variant="secondary" size="sm" onClick={() => setManaging(true)}>Manage subscriptions</Button></div>
    <div className={styles.toolbar}><div style={{ minWidth: 180 }}><Input label="Jump to date" type="date" value={from} onChange={event => jump(event.target.value)} /></div><div style={{ minWidth: 180 }}><Select label="Program" value={subscription} onChange={event => { setSubscription(event.target.value); setSelectedId(null) }}><option value="">All programs</option>{subscriptions.map(({ student, enrollment }) => <option key={enrollment.id} value={enrollment.id}>{props.location.studentId ? enrollment.program : `${student.firstName} · ${enrollment.program}`}</option>)}</Select></div><Button variant="secondary" size="sm" onClick={() => jump(shiftDate(makeupPreviewNow.slice(0, 10), 28))}>In 4 weeks</Button><Button variant="ghost" size="sm" onClick={() => jump(makeupPreviewNow.slice(0, 10))}>Upcoming</Button></div>
    <div className={styles.lessonsLayout} data-detail={Boolean(selected)}>
      <div className={styles.lessonsBrowse}>
        {view === 'calendar' ? <WeeklySchedule key={`${from}:${subscription}`} {...props} location={location} initialDate={from} onSelect={select} externalSelection={selectedId} /> : <DenseSectionPanel title="Upcoming lessons">
          <p style={{ ...typography.bodySmall, color: colors.textSecondary, marginTop: 0 }}>Next 8 weeks · Select a lesson for details and actions.</p>
          <div role="list" aria-label="Upcoming lesson dates">{entries.map((item, index) => <div key={item.id} role="listitem">
            {(index === 0 || entries[index - 1].date.slice(0, 7) !== item.date.slice(0, 7)) && <SectionTitle as="h4" variant="card">{formatScheduleDate(item.date, { month: 'long', year: 'numeric' })}</SectionTitle>}
            <ControlButton kind="row" className={styles.lessonRow} selected={selectedId === item.id} aria-pressed={selectedId === item.id} aria-label={`Select ${item.student.firstName} ${item.program} lesson ${item.date}${item.makeup ? ', makeup lesson' : ''}`} onClick={() => select(item.id)}><span>{formatScheduleDate(item.date, { weekday: 'short', month: 'short', day: 'numeric' })}<br /><span style={{ color: colors.textSecondary }}>{formatScheduleTime(item.time)}</span></span><span>{item.program}{!props.location.studentId && ` · ${item.student.firstName}`}<br /><span style={{ ...typography.bodySmall, color: colors.textSecondary }}>{item.teacher}</span></span><span style={typography.bodySmall}>{item.status === 'Absent' ? 'Cancelled' : item.makeup ? 'Makeup' : item.status}</span></ControlButton>
          </div>)}</div>{!entries.length && <EmptyState title="No lessons in this date range" />}
        </DenseSectionPanel>}
      </div>
      <aside className={styles.lessonDetail} aria-label="Selected lesson">
        {selected ? <><div className={styles.mobileLessonBack}><Button variant="secondary" size="sm" onClick={() => setSelectedId(null)}>Back to lessons</Button></div><DenseSectionPanel title={`${selected.program} lesson`} actions={selected.status === 'Scheduled' ? <div className={styles.toolbar}><Button size="sm" variant="secondary" onClick={() => props.onMove(selected.id)}>Reschedule lesson</Button><Button size="sm" variant="destructive" onClick={() => selected.makeup ? props.onLesson(selected.id) : setConfirmCancel(true)}>Cancel lesson</Button></div> : undefined}>
          <FieldGrid><DetailField label="Student" value={`${selected.student.firstName} ${selected.student.lastName}`} /><DetailField label="Date" value={formatScheduleDate(selected.date, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} /><DetailField label="Time" value={`${formatScheduleTime(selected.time)} · ${selected.duration} min`} /><DetailField label="Instructor" value={selected.teacher} /><DetailField label="Location" value={selected.room || 'Not specified'} /><DetailField label="Status" value={selected.status === 'Absent' ? 'Cancelled' : selected.status} /></FieldGrid>
          {confirmCancel && <div role="alert"><p>{absenceEligible(selected.date, selected.time) ? 'Cancelling this lesson adds a makeup credit.' : 'Less than 24 hours away: no makeup credit will be granted.'} Only this lesson is affected.</p><Button variant="destructive" onClick={() => { if (selected.makeup || !props.onCancelLesson) { props.onLesson(selected.id); return } const message = props.onCancelLesson(selected.id); setError(message || ''); if (!message) setConfirmCancel(false) }}>Confirm cancel lesson</Button><Button variant="secondary" onClick={() => setConfirmCancel(false)}>Keep lesson</Button></div>}
          {error && <p role="alert">{error}</p>}
        </DenseSectionPanel></> : <EmptyState title="Select a lesson" description="Choose a date on the left to see details, move it, or cancel just that lesson." />}
      </aside>
    </div>
  </section>
}