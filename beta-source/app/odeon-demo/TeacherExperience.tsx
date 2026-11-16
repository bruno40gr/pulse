'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FamilyPreviewData } from '@/beta-source/lib/academy-family-preview'
import type { AcademyGroup } from '@/beta-source/lib/academy-explorer'
import type { ExplorerEvent } from '@/beta-source/lib/event-explorer'
import type { SetupRecord } from '../content-studio-prototype/school-setup/setup-content'
import { betaAcademyTeachers } from '@/beta-source/lib/beta-academy-schedule'
import { betaCalendarOccurrences, betaShiftDate, betaWeekDates, betaWeekStart, type CalendarOccurrence } from '@/beta-source/lib/beta-academy-calendar'
import { expandPreviewCalendar } from '@/beta-source/lib/academy-makeup-preview'
import { attendanceOutcomes } from '@/beta-source/lib/academy-session'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { SurfacePanel } from '@/components/ui/SurfacePanel'
import { FieldLabel } from '@/components/ui/FieldLabel'
import { FieldValue } from '@/components/ui/FieldValue'
import { Button } from '@/components/ui/Button'
import { ControlButton } from '@/components/ui/ControlButton'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Tabs } from '@/components/ui/Tabs'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { LessonCard } from '../content-studio-prototype/students/LessonCard'
import { LessonStatus } from '../content-studio-prototype/students/LessonStatus'
import TeacherSchedule from '../content-studio-prototype/school-setup/TeacherSchedule'
import TeacherPhoto from '../content-studio-prototype/school-setup/TeacherPhoto'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { NOTE_INK, noteBackground } from '@/lib/dashboard-note-appearance'
import { colors, radius, spacing, typography } from '@/lib/tokens'
import styles from './teacher-experience.module.css'

type Area = 'schedule' | 'tasks' | 'availability' | 'profile'
const longDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
/** Section heading date without a duplicated comma: "Wed Nov 4". */
const dayStamp = (date: string) => shortDate(date).replace(',', '')
function clockLabel(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, '0')}` : ''}${hour >= 12 ? 'pm' : 'am'}`
}
const timeRange = (start: string, end: string) => `${clockLabel(start)}–${clockLabel(end)}`
function parse<T>(value: string | undefined, fallback: T): T { try { return value ? JSON.parse(value) as T : fallback } catch { return fallback } }

/** One three-option attendance control for the schedule and the task queue. */
function AttendanceChoices({ label, value, onChange }: { label: string; value: string; onChange: (outcome: string) => void }) {
  return <div role="group" aria-label={label} style={{ display: 'flex', gap: spacing.xs, flexWrap: 'wrap' }}>{attendanceOutcomes.map(outcome => <ControlButton key={outcome} type="button" kind="tab" selected={value === outcome} aria-pressed={value === outcome} onClick={() => onChange(outcome)}>{outcome}</ControlButton>)}</div>
}

/** Sample teacher workspace. Edits are local until live teacher identity and storage exist. */
export default function TeacherExperience({ data, groups, events, setup, today, onSetup, sample = false }: { data: FamilyPreviewData; groups: readonly AcademyGroup[]; events: readonly ExplorerEvent[]; setup: Record<string, SetupRecord[]>; today: string; onSetup?: (setup: Record<string, SetupRecord[]>) => void; sample?: boolean }) {
  const teachers = useMemo(() => betaAcademyTeachers(setup), [setup])
  const [teacherId, setTeacherId] = useState(teachers[0]?.id || '')
  const teacher = teachers.find(item => item.id === teacherId)
  const [canChooseTeacher, setCanChooseTeacher] = useState(sample)
  useEffect(() => {
    if (sample) { setCanChooseTeacher(true); return }
    const controller = new AbortController()
    fetch('/api/account/me', { cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) return; const result = await response.json(); setCanChooseTeacher(result.roleKey === 'owner') })
      .catch(() => {})
    return () => controller.abort()
  }, [sample])
  const [range, setRange] = useState<'Day' | 'Week'>('Day')
  const [date, setDate] = useState(today)
  const [area, setArea] = useState<Area>('schedule')
  const [attendance, setAttendance] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [savedNotes, setSavedNotes] = useState<Record<string, string>>({})
  const [recipient, setRecipient] = useState('')
  const [lessonAction, setLessonAction] = useState<{ sessionId: string; kind: 'notes' | 'message'; participantId?: string } | null>(null)
  const [channel, setChannel] = useState<'sms' | 'email'>('sms')
  const [message, setMessage] = useState('')
  const [drafts, setDrafts] = useState<{ teacherId: string; sessionId: string; recipient: string; channel: 'sms' | 'email'; text: string }[]>([])
  const [notice, setNotice] = useState('')
  const dates = useMemo(() => range === 'Day' ? [date] : betaWeekDates(betaWeekStart(date)), [date, range])
  const expanded = useMemo(() => expandPreviewCalendar(data, dates[dates.length - 1]), [data, dates])
  const sessions = betaCalendarOccurrences(expanded, groups, events, dates)
    .filter(item => item.teacherIds?.includes(teacherId) || item.teacherId === teacherId || item.teacherName === teacher?.name)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
  const participants = sessions.flatMap(session => (session.participantLessonIds || []).flatMap(id => {
    const lesson = expanded.lessons.find(item => item.id === id)
    const student = expanded.students.find(item => item.enrollments.some(enrollment => enrollment.id === lesson?.enrollmentId))
    return lesson && student ? [{ id, lesson, student, session }] : []
  }))
  const actionable = participants.filter(item => item.session.status !== 'Cancelled')
  const attendanceDone = (item: typeof participants[number]) => Boolean(attendance[item.id] || item.lesson.attendance)
  const notesDone = (item: typeof participants[number]) => Boolean(savedNotes[item.id])
  const pendingAttendance = actionable.filter(item => !attendanceDone(item))
  const pendingNotes = actionable.filter(item => !notesDone(item))
  const todo = actionable.filter(item => !attendanceDone(item) || !notesDone(item))
  const studentIds = new Set(sessions.filter(item => item.status !== 'Cancelled').flatMap(item => item.studentIds))
  const students = expanded.students.filter(student => studentIds.has(student.id))
  const mentioned = useMemo(() => teacher ? expanded.students.flatMap(student => student.notes.filter(note => note.mentions?.includes(teacher.name) || note.text.includes(`@${teacher.name}`)).map(note => ({ note, student }))) : [], [expanded.students, teacher])
  const activeSession = sessions.find(session => session.id === lessonAction?.sessionId)
  const activeParticipants = participants.filter(item => item.session.id === activeSession?.id && (!lessonAction?.participantId || item.id === lessonAction.participantId))
  const accounts = data.accounts.filter(account => activeSession?.studentIds.some(id => account.studentIds.includes(id)))
  function openAction(sessionId: string, kind: 'notes' | 'message', participantId?: string) {
    const session = sessions.find(item => item.id === sessionId)
    setRecipient(data.accounts.find(account => session?.studentIds.some(id => account.studentIds.includes(id)))?.id || '')
    setMessage(''); setChannel('sms'); setLessonAction({ sessionId, kind, participantId })
  }
  function updateTeacher(patch: Record<string, string>) {
    onSetup?.({ ...setup, teachers: (setup.teachers || []).map(record => record.id === teacherId ? { ...record, values: { ...record.values, ...patch } } : record) })
  }
  const summary = [{ label: 'Sessions', value: sessions.filter(item => item.status !== 'Cancelled').length }, { label: 'Students', value: students.length }, { label: 'Attendance to mark', value: pendingAttendance.length }, { label: 'Lesson notes to add', value: pendingNotes.length }]

  function sessionCard(session: CalendarOccurrence) {
    const cancelled = session.status === 'Cancelled'
    const rescheduled = Boolean(session.originalDate && session.originalDate !== session.date)
    const owners = participants.filter(item => item.session.id === session.id)
    const marked = owners.map(item => attendance[item.id] || item.lesson.attendance || '')
    const value = marked.length && marked.every(item => item === marked[0]) ? marked[0] : ''
    const badge = cancelled ? 'Cancelled' : rescheduled ? 'Rescheduled' : session.status
    return <LessonCard key={`${session.id}:${session.date}`} cancelled={cancelled}
      title={timeRange(session.start, session.end)}
      subtitle={session.studentNames.join(', ') || 'No students assigned'}
      actions={!cancelled ? <AttendanceChoices label={`Attendance for ${session.studentNames.join(', ') || 'this lesson'}`} value={value} onChange={outcome => setAttendance(current => { const next = { ...current }; owners.forEach(item => { next[item.id] = outcome }); return next })} /> : undefined}
      metadata={<><span className={styles.muted}>{session.title} · {session.room || 'Room unassigned'}</span>{badge !== 'Scheduled' && badge !== 'Booked' && <LessonStatus status={badge} />}</>} />
  }

  return <PageContainer>
    <div data-teacher-experience className={styles.workspace} style={{ '--teacher-border': colors.border, '--teacher-muted': colors.textSecondary } as React.CSSProperties}>
      <PageHeader title="My teaching day" subtitle="Your schedule, students and follow-through in one place." />
      <div className={styles.controls}>
        {canChooseTeacher && <Select label="Preview teacher" value={teacherId} onChange={event => { setTeacherId(event.target.value); setLessonAction(null); setRecipient(''); setMessage(''); setNotice('') }}>{teachers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>}
        <Tabs ariaLabel="Teaching range" variant="prominent" activeKey={range} onChange={setRange} items={[{ key: 'Day', label: 'Day' }, { key: 'Week', label: 'Week' }]} />
        {range === 'Day' ? <div className={styles.dateControls}>
          <Button variant="secondary" onClick={() => setDate(today)}>Today</Button>
          <div style={{ width: 158 }}><Input type="date" aria-label="Teaching date" value={date} onChange={event => { if (event.target.value) setDate(event.target.value) }} /></div>
        </div> : <div className={styles.dateControls}>
          <ControlButton kind="icon" aria-label="Previous week" onClick={() => setDate(betaShiftDate(date, -7))}><ChevronLeft size={18} /></ControlButton>
          <Button variant="secondary" onClick={() => setDate(today)}>This week</Button>
          <strong>{`Week of ${shortDate(betaWeekStart(date))}`}</strong>
          <ControlButton kind="icon" aria-label="Next week" onClick={() => setDate(betaShiftDate(date, 7))}><ChevronRight size={18} /></ControlButton>
        </div>}
      </div>
      <div aria-label="Teaching summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: spacing.md }}>{summary.map(item => <SurfacePanel key={item.label} appearance="flat" padding={spacing.lg}><FieldLabel>{item.label}</FieldLabel><FieldValue style={typography.h1}>{item.value}</FieldValue></SurfacePanel>)}</div>
      {notice && <p role="status" className={styles.muted}>{notice}</p>}
      <div className={styles.tabs}><Tabs<Area> ariaLabel="Teacher workspace" activeKey={area} onChange={setArea} items={[{ key: 'schedule', label: 'Schedule' }, { key: 'tasks', label: 'To do', count: todo.length }, { key: 'availability', label: 'Availability' }, { key: 'profile', label: 'Profile' }]} /></div>
      {area === 'schedule' && <div className={styles.columns}>
        {range === 'Day' ? <DenseSectionPanel title={date === today ? `Today, ${dayStamp(date)}` : longDate(date)}>
          {!sessions.length && <p className={styles.muted}>No sessions in this period.</p>}
          <div className={styles.list}>{sessions.map(sessionCard)}</div>
        </DenseSectionPanel> : dates.filter(day => sessions.some(session => session.date === day)).map(day => <DenseSectionPanel key={day} title={day === today ? `Today, ${dayStamp(day)}` : longDate(day)}><div className={styles.list}>{sessions.filter(session => session.date === day).map(sessionCard)}</div></DenseSectionPanel>)}
        <DenseSectionPanel title="Student roster"><div className={styles.list}>{students.map(student => {
          const next = actionable.find(item => item.student.id === student.id)
          return <div key={student.id} className={styles.roster}><div><strong>{student.firstName} {student.lastName}</strong><p className={styles.muted}>{student.enrollments.filter(item => item.teacherId === teacherId || item.teacher === teacher?.name).map(item => item.program).join(' · ')}</p></div><div style={{ display: 'flex', gap: spacing.xs, flexWrap: 'wrap' }}><Button size="sm" variant="secondary" disabled={!next} onClick={() => next && openAction(next.session.id, 'notes', next.id)}>Add note</Button><Button size="sm" variant="secondary" disabled={!next} onClick={() => next && openAction(next.session.id, 'message')}>Send message</Button></div></div>
        })}{!students.length && <p className={styles.muted}>No students in this period.</p>}</div></DenseSectionPanel>
      </div>}
      {area === 'tasks' && <>
        <DenseSectionPanel title="Attendance & lesson notes">
          {!todo.length && <p className={styles.muted}>Nothing to do in this period.</p>}
          <div className={styles.list}>{todo.map(item => <article key={item.id} className={styles.task}>
            <div><h3 className={styles.title}>{item.student.firstName} {item.student.lastName}</h3><p className={styles.muted}>{shortDate(item.session.date)} · {timeRange(item.session.start, item.session.end)} · {item.session.title}</p></div>
            {!attendanceDone(item) && <AttendanceChoices label={`Attendance for ${item.student.firstName} ${item.student.lastName}`} value={attendance[item.id] || item.lesson.attendance || ''} onChange={outcome => setAttendance(current => ({ ...current, [item.id]: outcome }))} />}
            {!notesDone(item) && <div><Button size="sm" variant="secondary" onClick={() => openAction(item.session.id, 'notes', item.id)}>Leave notes</Button></div>}
          </article>)}</div>
        </DenseSectionPanel>
        <DenseSectionPanel title="Sticky notes mentioning you">
          {mentioned.length ? <div className={styles.list}>{mentioned.map(({ note, student }) => <div key={note.id} style={{ background: noteBackground('yellow', Boolean(note.completed_at)), color: NOTE_INK, borderRadius: radius.md, padding: spacing.md }}><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{note.text}</p><span className={styles.muted}>{student.firstName} {student.lastName} · {note.actor_name}</span></div>)}</div> : <p className={styles.muted}>No sticky notes mention you in this period.</p>}
        </DenseSectionPanel>
      </>}
      {area === 'availability' && (teacher ? <TeacherSchedule values={teacher.values} onChange={updateTeacher} readOnly /> : <DenseSectionPanel title="Availability"><p className={styles.muted}>No teacher selected.</p></DenseSectionPanel>)}
      {area === 'profile' && (teacher ? <TeacherProfile key={teacherId} teacher={teacher} services={setup.services || []} onSave={updateTeacher} /> : <DenseSectionPanel title="Profile"><p className={styles.muted}>Choose a teacher to edit their profile.</p></DenseSectionPanel>)}
      <Modal isOpen={Boolean(activeSession && lessonAction)} onClose={() => setLessonAction(null)} ariaLabel={lessonAction?.kind === 'notes' ? 'Leave notes' : 'Message family'}>
        <ModalHeader title={lessonAction?.kind === 'notes' ? 'Leave notes' : 'Message family'} onClose={() => setLessonAction(null)} />
        <ModalBody><div className={styles.list}>
          {activeSession && <p className={styles.muted}>{shortDate(activeSession.date)} · {timeRange(activeSession.start, activeSession.end)} · {activeSession.title}</p>}
          {lessonAction?.kind === 'notes' && activeParticipants.map(item => <div key={item.id} className={styles.list}><Textarea label={`Lesson note for ${item.student.firstName} ${item.student.lastName}`} value={notes[item.id] || ''} onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))} /><Button disabled={!notes[item.id]?.trim()} onClick={() => { setSavedNotes(current => ({ ...current, [item.id]: notes[item.id].trim() })); setNotice('Lesson note saved in this sample only.') }}>Save note</Button>{savedNotes[item.id] && <p role="status">Saved · not published</p>}</div>)}
          {lessonAction?.kind === 'message' && <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs }} role="group" aria-label="Message channel">{(['sms', 'email'] as const).map(kind => <ControlButton key={kind} kind="toggle" aria-pressed={channel === kind} selected={channel === kind} onClick={() => setChannel(kind)}>{kind === 'sms' ? 'SMS' : 'Email'}</ControlButton>)}</div>
            <Select label="Family" value={recipient} onChange={event => setRecipient(event.target.value)}><option value="">Choose a family from this lesson</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.holderName} · {account.name}</option>)}</Select>
            <Textarea label={`${channel === 'sms' ? 'SMS' : 'Email'} draft`} value={message} onChange={event => setMessage(event.target.value)} placeholder="Write a lesson follow-up or scheduling question…" />
            <Button disabled={!accounts.some(account => account.id === recipient) || !message.trim()} onClick={() => { if (!activeSession) return; setDrafts(current => [...current, { teacherId, sessionId: activeSession.id, recipient, channel, text: message.trim() }]); setMessage('') }}>Save draft</Button>
            {drafts.filter(draft => draft.teacherId === teacherId && draft.sessionId === activeSession?.id).map((draft, index) => <article key={index} className={styles.roster}><strong>{data.accounts.find(account => account.id === draft.recipient)?.holderName} · {draft.channel === 'sms' ? 'SMS' : 'Email'}</strong><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{draft.text}</p><span className={styles.muted}>Draft · not sent</span></article>)}
          </>}
        </div></ModalBody>
        <ModalFooter><Button onClick={() => setLessonAction(null)}>Done</Button></ModalFooter>
      </Modal>
    </div>
  </PageContainer>
}

function TeacherProfile({ teacher, services, onSave }: { teacher: ReturnType<typeof betaAcademyTeachers>[number]; services: SetupRecord[]; onSave: (patch: Record<string, string>) => void }) {
  const [draft, setDraft] = useState({ name: teacher.values.name || '', email: teacher.values.email || '', photo: teacher.values.photo || '' })
  const [skills, setSkills] = useState(() => parse<{ serviceId?: string; maxLevel?: number }[]>(teacher.values.assignments, []))
  const serviceName = (id?: string) => services.find(service => service.id === id)?.values.name || 'Service unavailable'
  return <DenseSectionPanel title="Profile" actions={<Button onClick={() => onSave({ name: draft.name, email: draft.email, photo: draft.photo, assignments: JSON.stringify(skills) })}>Save profile</Button>}>
    <div className={styles.list}>
      <TeacherPhoto value={draft.photo} onChange={photo => setDraft(current => ({ ...current, photo }))} />
      <FieldGrid><Input label="Name" value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} /><Input label="Email" type="email" value={draft.email} onChange={event => setDraft(current => ({ ...current, email: event.target.value }))} /></FieldGrid>
      <h3 className={styles.title}>Teaching skills by level</h3>
      {skills.length ? skills.map((skill, index) => <div key={`${skill.serviceId}:${index}`} className={styles.roster}><strong>{serviceName(skill.serviceId)}</strong><Select label={`Level for ${serviceName(skill.serviceId)}`} value={String(skill.maxLevel || 1)} onChange={event => setSkills(current => current.map((item, position) => position === index ? { ...item, maxLevel: Number(event.target.value) } : item))}>{[1, 2, 3].map(level => <option key={level} value={level}>Level {level}</option>)}</Select></div>) : <p className={styles.muted}>No teaching skills configured yet.</p>}
    </div>
  </DenseSectionPanel>
}
