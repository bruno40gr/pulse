'use client'

import { useMemo, useState } from 'react'
import type { FamilyPreviewData } from '@/beta-source/lib/academy-family-preview'
import type { AcademyGroup } from '@/beta-source/lib/academy-explorer'
import type { ExplorerEvent } from '@/beta-source/lib/event-explorer'
import type { SetupRecord } from '../content-studio-prototype/school-setup/setup-content'
import { betaAcademyTeachers } from '@/beta-source/lib/beta-academy-schedule'
import { betaCalendarOccurrences, betaShiftDate, betaWeekDates, betaWeekStart } from '@/beta-source/lib/beta-academy-calendar'
import { expandPreviewCalendar } from '@/beta-source/lib/academy-makeup-preview'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { Button } from '@/components/ui/Button'
import { ControlButton } from '@/components/ui/ControlButton'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Tabs } from '@/components/ui/Tabs'
import { Notice } from '@/components/ui/Notice'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { LessonCard } from '../content-studio-prototype/students/LessonCard'
import { LessonStatus } from '../content-studio-prototype/students/LessonStatus'
import { formatScheduleDate, formatScheduleTime } from '@/beta-source/lib/academy-enrollment-schedule'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { colors, spacing, typography } from '@/lib/tokens'
import styles from './teacher-experience.module.css'

type Area = 'schedule' | 'tasks' | 'availability'
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })

/** Design-only teacher surface. All edits are component-local and reset on exit. */
export default function TeacherExperience({ data, groups, events, setup, today }: { data: FamilyPreviewData; groups: readonly AcademyGroup[]; events: readonly ExplorerEvent[]; setup: Record<string, SetupRecord[]>; today: string }) {
  const teachers = useMemo(() => betaAcademyTeachers(setup), [setup])
  const [teacherId, setTeacherId] = useState(teachers[0]?.id || '')
  const teacher = teachers.find(item => item.id === teacherId)
  const [date, setDate] = useState(today)
  const [range, setRange] = useState<'Day' | 'Week'>('Day')
  const [area, setArea] = useState<Area>('schedule')
  const [attendance, setAttendance] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [savedNotes, setSavedNotes] = useState<Record<string, string>>({})
  const [recipient, setRecipient] = useState('')
  const [lessonAction, setLessonAction] = useState<{ sessionId: string; kind: 'attendance' | 'notes' | 'message' } | null>(null)
  const [channel, setChannel] = useState<'sms' | 'email'>('sms')
  const [message, setMessage] = useState('')
  const [drafts, setDrafts] = useState<{ teacherId: string; sessionId: string; recipient: string; channel: 'sms' | 'email'; text: string }[]>([])
  const [availability, setAvailability] = useState({ day: 'Monday', from: '15:00', to: '19:00', note: '' })
  const [requests, setRequests] = useState<{ teacherId: string; text: string }[]>([])
  const [notice, setNotice] = useState('')
  const dates = range === 'Day' ? [date] : betaWeekDates(betaWeekStart(date))
  const through = dates[dates.length - 1]
  const expanded = useMemo(() => expandPreviewCalendar(data, through), [data, through])
  const sessions = betaCalendarOccurrences(expanded, groups, events, dates).filter(item => item.status !== 'Cancelled' && (item.teacherIds?.includes(teacherId) || item.teacherId === teacherId || item.teacherName === teacher?.name))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
  const participants = sessions.flatMap(session => (session.participantLessonIds || []).flatMap(id => {
    const lesson = expanded.lessons.find(item => item.id === id)
    const student = expanded.students.find(item => item.enrollments.some(enrollment => enrollment.id === lesson?.enrollmentId))
    return lesson && student ? [{ id, lesson, student, session }] : []
  }))
  const studentIds = new Set(sessions.flatMap(session => session.studentIds))
  const students = expanded.students.filter(student => studentIds.has(student.id))
  const activeSession = sessions.find(session => session.id === lessonAction?.sessionId)
  const activeParticipants = participants.filter(item => item.session.id === activeSession?.id)
  const accounts = data.accounts.filter(account => activeSession?.studentIds.some(id => account.studentIds.includes(id)))
  const actionTitle = lessonAction?.kind === 'attendance' ? 'Take attendance' : lessonAction?.kind === 'notes' ? 'Leave notes' : 'Message family'
  function openAction(sessionId: string, kind: 'attendance' | 'notes' | 'message') {
    const session = sessions.find(item => item.id === sessionId)
    setRecipient(data.accounts.find(account => session?.studentIds.some(id => account.studentIds.includes(id)))?.id || '')
    setMessage(''); setChannel('sms'); setLessonAction({ sessionId, kind })
  }
  const pendingAttendance = participants.filter(item => !(attendance[item.id] || item.lesson.attendance))
  const pendingNotes = participants.filter(item => !savedNotes[item.id])

  return <PageContainer>
    <div data-teacher-experience className={styles.workspace} style={{ '--teacher-border': colors.border, '--teacher-muted': colors.textSecondary } as React.CSSProperties}>
      <PageHeader title="My teaching day" subtitle="Your schedule, students and follow-through in one place." />
      <Notice variant="info">Teacher experience · Sample-only mockup. Choose a teacher to preview. Actions are temporary, reset when you leave, and never change attendance, publish availability or send messages.</Notice>
      <div className={styles.controls}>
        <Select label="Preview teacher" value={teacherId} onChange={event => { setTeacherId(event.target.value); setLessonAction(null); setRecipient(''); setMessage(''); setNotice('') }}>{teachers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <div className={styles.dateControls}>
          <ControlButton kind="icon" aria-label="Previous teaching day" onClick={() => setDate(betaShiftDate(date, range === 'Day' ? -1 : -7))}><ChevronLeft size={18} /></ControlButton>
          <Input type="date" aria-label="Teaching date" value={date} onChange={event => { if (event.target.value) setDate(event.target.value) }} />
          <ControlButton kind="icon" aria-label="Next teaching day" onClick={() => setDate(betaShiftDate(date, range === 'Day' ? 1 : 7))}><ChevronRight size={18} /></ControlButton>
          <Button variant="secondary" onClick={() => setDate(today)}>Today</Button>
        </div>
        <Tabs ariaLabel="Teaching range" variant="prominent" activeKey={range} onChange={setRange} items={[{ key: 'Day', label: 'Day' }, { key: 'Week', label: 'Week' }]} />
      </div>
      <div className={styles.summary} aria-label="Teaching summary">
        <span><strong>{sessions.length}</strong> sessions</span><span><strong>{students.length}</strong> students</span><span><strong>{pendingAttendance.length}</strong> attendance to mark</span><span><strong>{pendingNotes.length}</strong> lesson notes to add</span>
      </div>
      <div className={styles.tabs}><Tabs<Area> ariaLabel="Teacher workspace" activeKey={area} onChange={setArea} items={[{ key: 'schedule', label: 'Schedule' }, { key: 'tasks', label: 'To do', count: pendingAttendance.length + pendingNotes.length }, { key: 'availability', label: 'Availability' }]} /></div>
      {notice && <Notice variant="info" onDismiss={() => setNotice('')}>{notice}</Notice>}
      {area === 'schedule' && <div className={styles.columns}>
        <DenseSectionPanel title={range === 'Day' ? dateLabel(date) : 'This week'}>
          {!sessions.length && <p>No sessions for this teacher in this period. Choose another day or Week.</p>}
          <div className={styles.list}>{sessions.map(session => <LessonCard key={`${session.id}:${session.date}`}
            title={`${formatScheduleDate(session.date, { weekday: 'long', month: 'short', day: 'numeric' })} · ${formatScheduleTime(session.start)}–${formatScheduleTime(session.end)}`}
            subtitle={`${session.studentNames.join(', ') || 'No students assigned'} · ${session.title}`}
            actions={<><Button size="sm" variant="secondary" disabled={!participants.some(item => item.session.id === session.id)} onClick={() => openAction(session.id, 'attendance')}>Take attendance</Button><Button size="sm" variant="secondary" disabled={!participants.some(item => item.session.id === session.id)} onClick={() => openAction(session.id, 'notes')}>Leave notes</Button><Button size="sm" variant="secondary" disabled={!data.accounts.some(account => session.studentIds.some(id => account.studentIds.includes(id)))} onClick={() => openAction(session.id, 'message')}>Message family</Button></>}
            metadata={<><span className={styles.muted}>{session.teacherName} · {session.room || 'Room unassigned'}</span><LessonStatus status={session.status} /></>}
          />)}</div>
        </DenseSectionPanel>
        <DenseSectionPanel title="Student roster"><div className={styles.list}>{students.map(student => <div key={student.id} className={styles.roster}><strong>{student.firstName} {student.lastName}</strong><p className={styles.muted}>{student.enrollments.filter(item => item.teacherId === teacherId || item.teacher === teacher?.name).map(item => item.program).join(' · ')}</p></div>)}{!students.length && <p>No students in this period.</p>}</div></DenseSectionPanel>
      </div>}
      {area === 'tasks' && <DenseSectionPanel title="Attendance & lesson notes">
        <p className={styles.muted}>Sample task queue for the selected period, not an overdue assessment. Notes here are not published to a family or saved to a student record.</p>
        <div className={styles.list}>{participants.map(item => <article key={item.id} className={styles.task}>
          <div><h3 className={styles.title}>{item.student.firstName} {item.student.lastName}</h3><p className={styles.muted}>{dateLabel(item.session.date)} · {item.session.start} · {item.session.title}</p></div>
          <Select label={`Attendance for ${item.student.firstName} ${item.student.lastName}`} value={attendance[item.id] || item.lesson.attendance || ''} onChange={event => setAttendance(current => ({ ...current, [item.id]: event.target.value }))}><option value="">Not marked</option><option>Present</option><option>No-show</option><option>Excused absence</option></Select>
          <Textarea label={`Lesson note for ${item.student.firstName} ${item.student.lastName}`} placeholder="Progress, what to practise, and next lesson…" value={notes[item.id] || ''} onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))} />
          <div><Button disabled={!notes[item.id]?.trim()} onClick={() => { setSavedNotes(current => ({ ...current, [item.id]: notes[item.id].trim() })); setNotice('Lesson note saved in this mockup only.') }}>Save sample note</Button>{savedNotes[item.id] && <p role="status">Sample note saved · not published</p>}</div>
        </article>)}{!participants.length && <p>No lesson tasks in this period.</p>}</div>
      </DenseSectionPanel>}
      <Modal isOpen={Boolean(activeSession && lessonAction)} onClose={() => setLessonAction(null)} ariaLabel={actionTitle}>
        <ModalHeader title={actionTitle} onClose={() => setLessonAction(null)} />
        <ModalBody><div className={styles.list}>
          {activeSession && <p className={styles.muted}>{dateLabel(activeSession.date)} · {activeSession.start} · {activeSession.title} · {activeSession.studentNames.join(', ')}</p>}
          {lessonAction?.kind === 'attendance' && activeParticipants.map(item => <Select key={item.id} label={`Attendance for ${item.student.firstName} ${item.student.lastName}`} value={attendance[item.id] || item.lesson.attendance || ''} onChange={event => setAttendance(current => ({ ...current, [item.id]: event.target.value }))}><option value="">Not marked</option><option>Present</option><option>No-show</option><option>Excused absence</option></Select>)}
          {lessonAction?.kind === 'notes' && activeParticipants.map(item => <div key={item.id} className={styles.list}><Textarea label={`Lesson note for ${item.student.firstName} ${item.student.lastName}`} value={notes[item.id] || ''} onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))} /><Button disabled={!notes[item.id]?.trim()} onClick={() => setSavedNotes(current => ({ ...current, [item.id]: notes[item.id].trim() }))}>Save sample note</Button>{savedNotes[item.id] && <p role="status">Sample note saved · not published</p>}</div>)}
          {lessonAction?.kind === 'message' && <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs }} role="group" aria-label="Message channel">{(['sms', 'email'] as const).map(kind => <ControlButton key={kind} kind="toggle" aria-pressed={channel === kind} selected={channel === kind} onClick={() => setChannel(kind)}>{kind === 'sms' ? 'SMS' : 'Email'}</ControlButton>)}</div>
            <Select label="Family" value={recipient} onChange={event => setRecipient(event.target.value)}><option value="">Choose a family from this lesson</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.holderName} · {account.name}</option>)}</Select>
            <Textarea label={`${channel === 'sms' ? 'SMS' : 'Email'} draft`} value={message} onChange={event => setMessage(event.target.value)} placeholder="Write a lesson follow-up or scheduling question…" />
            <Button disabled={!accounts.some(account => account.id === recipient) || !message.trim()} onClick={() => { if (!activeSession) return; setDrafts(current => [...current, { teacherId, sessionId: activeSession.id, recipient, channel, text: message.trim() }]); setMessage('') }}>Save sample draft</Button>
            {drafts.filter(draft => draft.teacherId === teacherId && draft.sessionId === activeSession?.id).map((draft, index) => <article key={index} className={styles.roster}><strong>{data.accounts.find(account => account.id === draft.recipient)?.holderName} · {draft.channel === 'sms' ? 'SMS' : 'Email'}</strong><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{draft.text}</p><span className={styles.muted}>Mockup draft · not sent</span></article>)}
            <p className={styles.muted}>Sample only. Live inbox and sending are not connected.</p>
          </>}
        </div></ModalBody>
        <ModalFooter><Button onClick={() => setLessonAction(null)}>Done</Button></ModalFooter>
      </Modal>
      {area === 'availability' && <div className={styles.columns}>
        <DenseSectionPanel title="Current teaching hours"><p className={styles.muted}>Read from school setup. Changes below are proposals only.</p><div className={styles.list}>{teacher?.blocks.map((block, index) => <div key={index} className={styles.roster}><strong>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][block.day]}</strong><p>{`${String(Math.floor(block.from / 60)).padStart(2, '0')}:${String(block.from % 60).padStart(2, '0')}–${String(Math.floor(block.to / 60)).padStart(2, '0')}:${String(block.to % 60).padStart(2, '0')}`}</p></div>)}</div></DenseSectionPanel>
        <DenseSectionPanel title="Propose availability">
          <div className={styles.list}><Select label="Weekday" value={availability.day} onChange={event => setAvailability(current => ({ ...current, day: event.target.value }))}>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => <option key={day}>{day}</option>)}</Select>
            <FieldGrid><Input label="Available from" type="time" value={availability.from} onChange={event => setAvailability(current => ({ ...current, from: event.target.value }))} /><Input label="Available until" type="time" value={availability.to} onChange={event => setAvailability(current => ({ ...current, to: event.target.value }))} /></FieldGrid>
            <Textarea label="Availability note" value={availability.note} onChange={event => setAvailability(current => ({ ...current, note: event.target.value }))} placeholder="Effective date, one-off exception, or context for the office…" />
            <Button onClick={() => { if (!availability.from || !availability.to || availability.from >= availability.to) { setNotice('Choose an end time after the start time.'); return } setRequests(current => [...current, { teacherId, text: `${availability.day} ${availability.from}–${availability.to}${availability.note.trim() ? ` · ${availability.note.trim()}` : ''}` }]); setNotice('Availability proposal saved in the mockup only. School hours are unchanged.') }}>Save sample proposal</Button>
            {requests.filter(request => request.teacherId === teacherId).map((request, index) => <p key={index} role="status">{request.text} · Not submitted</p>)}
          </div>
        </DenseSectionPanel>
      </div>}
      <p style={{ color: colors.textSecondary, fontSize: typography.sizeSm, margin: `${spacing.sm} 0` }}>Design preview only · Live teacher access must use server-enforced assignment and family permissions, not this preview selector.</p>
    </div>
  </PageContainer>
}