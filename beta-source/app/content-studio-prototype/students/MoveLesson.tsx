'use client'

import { useRescheduleAvailability } from '@/beta-source/app/odeon-demo/CalendarEnrollmentContext'

import { ConfirmActionButton } from './ConfirmActionButton'

import { AccountWorkspace, InlineWorkspaceContext } from './AccountWorkspace'
import styles from './StudentWorkspace.module.css'
import bookingStyles from './CalendarBookingLayout.module.css'
import { useContext, useMemo, useState, type ReactNode } from 'react'
import { ControlButton } from '@/beta-source/components/ui/ControlButton'
import { Button, DenseSectionPanel, DetailField, FieldGrid, Modal, ModalHeader, ModalBody, ModalFooter } from '@/beta-source/components/ui'
import { formatScheduleDate, formatScheduleTime } from '@/beta-source/lib/academy-enrollment-schedule'
import { makeupSlots, reschedulePreviewSubscription, type MakeupPreviewState, type PreviewMakeup } from '@/beta-source/lib/academy-makeup-preview'
import { newLesson, type LessonChoice } from '@/beta-source/lib/academy-staff-enrollment'
import type { FamilyPreviewData } from '@/beta-source/lib/academy-family-preview'
import { previewStudentName } from '@/beta-source/lib/academy-student-preview'
import { spacing, typography } from '@/beta-source/lib/tokens'
import type { ScheduledClassItem } from './ScheduledClass'
import { CalendarBookingLayout } from './CalendarBookingLayout'
import LessonSchedule from '../enrollment/LessonSchedule'
import { familyBookingReferences } from '@/beta-source/lib/family-booking-calendar'

export function MoveLesson({ item, data, state, onBack, onMove, accountName, profileSubtitle, initialDate, onWeek, recurring = false, onRecurring, availableSlots, draftBooking, onDraftChange, rightControls, referenceLessons: calendarReferences }: { referenceLessons?: ReturnType<typeof familyBookingReferences>; rightControls?: ReactNode; draftBooking?: NonNullable<PreviewMakeup['booking']> | null; onDraftChange?: (booking: NonNullable<PreviewMakeup['booking']> | null) => void; availableSlots?: (date: string) => ReturnType<typeof makeupSlots>; recurring?: boolean; onRecurring?: (booking: NonNullable<PreviewMakeup['booking']>) => string | null; onWeek?: (week: string) => void; initialDate?: string; accountName?: string; profileSubtitle?: string; item: ScheduledClassItem; data: FamilyPreviewData; state: MakeupPreviewState; onBack: () => void; onMove: (booking: NonNullable<PreviewMakeup['booking']>) => string | null }) {
  const resolveSlots = useRescheduleAvailability()
  const inline = useContext(InlineWorkspaceContext)
  const [localSelected, setSelected] = useState<NonNullable<PreviewMakeup['booking']> | null>(null)
  const selected = onDraftChange ? draftBooking || null : localSelected
  function select(value: NonNullable<PreviewMakeup['booking']> | null) { setSelected(value); onDraftChange?.(value) }
  const [error, setError] = useState('')
  const [sameTeacher, setSameTeacher] = useState(true)
  const [confirmRecurring, setConfirmRecurring] = useState(false)
  function confirm() {
    if (!selected) return
    if (!recurring || !onRecurring) { setError(onMove(selected) || ''); return }
    const account = data.accounts.find(value => value.studentIds.includes(item.student.id))
    try {
      reschedulePreviewSubscription(data, state, account?.id || '', item.id, selected, resolveSlots)
      setError(''); setConfirmRecurring(true)
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to change recurring schedule.') }
  }
  const makeup: PreviewMakeup = { id: item.id, lessonId: item.id, studentId: item.student.id, enrollmentId: item.enrollmentId, date: item.date, program: item.program, duration: item.duration, teacher: item.teacher, service: item.enrollment.service }
  const lesson: LessonChoice = { ...newLesson(item.id), studentId: item.student.id, service: item.enrollment.service as LessonChoice['service'], instrument: item.program, duration: String(item.duration), frequency: 'À-la-carte', start: selected?.date || '', time: selected?.time || '', teacher: selected?.teacher || '' }
  const availableData = { ...data, lessons: data.lessons.filter(value => value.id !== item.id) }
  const availableState = { ...state, items: state.items.filter(value => value.id !== item.id) }
  const slots = new Map<string, ReturnType<typeof makeupSlots>>()
  const weekStart = initialDate || item.date
  const timeChoices = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(`${weekStart}T12:00:00Z`)
      date.setUTCDate(date.getUTCDate() + index)
      return date.toISOString().slice(0, 10)
    })
    return days.map(date => {
      const found = availableSlots ? availableSlots(date) : resolveSlots({ ...data, lessons: data.lessons.filter(value => value.id !== item.id) }, { ...state, items: state.items.filter(value => value.id !== item.id) }, makeup, date, item.program, false)
      const usable = found.filter(slot => (!sameTeacher || slot.teacher === item.teacher) && !(date === item.date && slot.time === item.time))
      const times = [...new Set(usable.map(slot => slot.time))].sort()
      return { date, times: times.map(time => ({ time, teachers: [...new Set(usable.filter(slot => slot.time === time).map(slot => slot.teacher))] })) }
    }).filter(day => day.times.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- derived data/state change every render; only the week and teacher filter refetch.
  }, [weekStart, sameTeacher, item.id, item.program, item.teacher, availableSlots])
  const referenceLessons = calendarReferences || familyBookingReferences(data, state, item.student.id, item.id)
  const availableTimesPanel = <>
    {timeChoices.length > 0 && <DenseSectionPanel title="Available times" headingLevel="h2" contentStyle={{ display: 'grid', gap: spacing.md }}>
      <p style={typography.bodySmall}>Only times that fit this lesson length and the school rules are listed.</p>
      {timeChoices.map(day => <div key={day.date}>
        <strong style={typography.label}>{formatScheduleDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs }}>
          {day.times.map(slot => <ControlButton key={slot.time} type="button" kind="toggle" aria-pressed={selected?.date === day.date && selected?.time === slot.time} onClick={() => { select({ date: day.date, time: slot.time, teacher: sameTeacher ? item.teacher : slot.teachers[0], program: item.program }); setError('') }}>{formatScheduleTime(slot.time)}</ControlButton>)}
        </div>
      </div>)}
    </DenseSectionPanel>}
    {!timeChoices.length && <DenseSectionPanel title="Available times"><p style={typography.bodySmall}>No other time fits this week under the school rules. Try the next week, or allow another instructor.</p></DenseSectionPanel>}
  </>
  const calendar = <LessonSchedule calendarStudentIds={data.accounts.find(account => account.studentIds.includes(item.student.id))?.studentIds} referenceLessons={referenceLessons} toolbarActions={inline ? <><label className={bookingStyles.checkbox}><input type="checkbox" checked={sameTeacher} onChange={event => { setSameTeacher(event.target.checked); select(null); setError('') }} />Same teacher</label></> : undefined} onWeek={onWeek} lesson={lesson} lessons={inline && selected ? [lesson] : []} replacementMode={inline} detailedReplacementSlots={inline} chooseTeacherOnClick={inline && !sameTeacher} teacherPreference={inline ? sameTeacher ? item.teacher : '' : ''} student={{ ...item.student, activeTeacher: false }} manager={null} initialDate={initialDate || item.date} compactCopy availability={(date, time) => { if (date === item.date && time === item.time) return []; if (!slots.has(date)) slots.set(date, availableSlots ? availableSlots(date) : resolveSlots(availableData, availableState, makeup, date, item.program, false)); return slots.get(date)!.filter(value => value.time === time).map(value => ({ name: value.teacher })) }} onChange={patch => { const next = { ...lesson, ...patch }; select(next.start && next.time && next.teacher ? { date: next.start, time: next.time, teacher: next.teacher, program: item.program } : null); setError('') }} />
  if (inline) return <AccountWorkspace backLabel="Back to schedule" profileSubtitle={profileSubtitle} title={recurring ? 'Choose the new recurring time' : 'Choose a new time'} accountName={accountName || previewStudentName(item.student)} onBack={onBack}>
    <CalendarBookingLayout level={item.enrollment.level} rightControls={rightControls} hideConfirm={Boolean(onDraftChange)} moving studentName={previewStudentName(item.student)} makeup={makeup} program={item.program} sameTeacher={sameTeacher} onSameTeacher={value => { setSameTeacher(value); select(null); setError('') }} teacher="" onTeacher={() => {}} selected={selected} onConfirm={confirm} error={error}>
      {calendar}
    </CalendarBookingLayout>
    <Modal isOpen={confirmRecurring} onClose={() => setConfirmRecurring(false)} size="sm" ariaLabel="Confirm recurring schedule change">
      <ModalHeader title="Change the subscription schedule?" onClose={() => setConfirmRecurring(false)} />
      <ModalBody>{selected && <><p>This will update {previewStudentName(item.student)}’s {item.program} subscription and all upcoming regular lessons from {formatScheduleDate(item.date, { month: 'short', day: 'numeric', year: 'numeric' })}.</p><p><strong>{formatScheduleDate(selected.date, { weekday: 'long' })} at {formatScheduleTime(selected.time)} with {selected.teacher}</strong>, starting {formatScheduleDate(selected.date)}.</p><p>Past lessons, cancellations, makeup bookings and invoices will stay unchanged.</p></>}</ModalBody>
      <ModalFooter><Button variant="secondary" onClick={() => setConfirmRecurring(false)}>Keep current schedule</Button><ConfirmActionButton onClick={() => { if (selected && onRecurring) { const message = onRecurring(selected); if (message) { setError(message); setConfirmRecurring(false) } } }}>Confirm subscription change</ConfirmActionButton></ModalFooter>
    </Modal>
  </AccountWorkspace>
  return <AccountWorkspace profileSubtitle={profileSubtitle} title="Reschedule lesson" accountName={accountName || previewStudentName(item.student)} onBack={onBack}>
    <div data-inline-calendar="" className={styles.calendarTaskLayout}>
    <aside className={styles.stack} style={{ gap: spacing.lg }}>
    <DenseSectionPanel title="Only this lesson changes"><FieldGrid><DetailField label="Current lesson" value={`${item.program} · ${formatScheduleDate(item.date)} · ${formatScheduleTime(item.time)}`} /><DetailField label="Instructor" value={item.teacher} /></FieldGrid><p style={typography.bodySmall}>The recurring subscription stays unchanged.</p></DenseSectionPanel>
    {availableTimesPanel}
    {selected && <DenseSectionPanel title="New lesson time" actions={<ConfirmActionButton onClick={() => setError(onMove(selected) || '')}>Reschedule this lesson</ConfirmActionButton>}><FieldGrid><DetailField label="Date / time" value={`${formatScheduleDate(selected.date)} · ${formatScheduleTime(selected.time)}`} /><DetailField label="Instructor" value={selected.teacher} /></FieldGrid></DenseSectionPanel>}
    {error && <p role="alert">{error}</p>}
    </aside>
    <div className={styles.calendarTaskCanvas}>{calendar}</div>
    </div>
  </AccountWorkspace>
}