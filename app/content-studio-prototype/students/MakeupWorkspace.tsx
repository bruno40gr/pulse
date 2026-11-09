'use client'

import { AccountWorkspace, InlineWorkspaceContext } from './AccountWorkspace'
import styles from './StudentWorkspace.module.css'
import bookingStyles from './CalendarBookingLayout.module.css'
import { useContext, useState, type ReactNode } from 'react'
import { Button, DenseSectionPanel, DetailField, FieldGrid, Select } from '@/components/ui'
import { formatScheduleDate, formatScheduleTime } from '@/lib/academy-enrollment-schedule'
import { enrollmentGroupPrograms, enrollmentInstruments, newLesson, type LessonChoice } from '@/lib/academy-staff-enrollment'
import { makeupSlots, type MakeupPreviewState, type PreviewMakeup } from '@/lib/academy-makeup-preview'
import type { FamilyPreviewData } from '@/lib/academy-family-preview'
import { previewStudentName } from '@/lib/academy-student-preview'
import { CalendarBookingLayout } from './CalendarBookingLayout'
import LessonSchedule from '../enrollment/LessonSchedule'
import { spacing, typography } from '@/lib/tokens'

export function MakeupWorkspace({ data, state, makeup, onBack, onBook, accountName, profileSubtitle, availableSlots, sidebar }: { sidebar?: ReactNode; availableSlots?: (date: string) => ReturnType<typeof makeupSlots>; accountName?: string; profileSubtitle?: string; data: FamilyPreviewData; state: MakeupPreviewState; makeup: PreviewMakeup; onBack: () => void; onBook: (booking: NonNullable<PreviewMakeup['booking']>) => string | null }) {
  const inline = useContext(InlineWorkspaceContext)
  const [program, setProgram] = useState(makeup.program)
  const [sameTeacher, setSameTeacher] = useState(true)
  const [teacher, setTeacher] = useState('')
  const [selected, setSelected] = useState<NonNullable<PreviewMakeup['booking']> | null>(null)
  const [error, setError] = useState('')
  const student = data.students.find(item => item.id === makeup.studentId)!
  const lesson: LessonChoice = { ...newLesson(makeup.id), studentId: student.id, service: makeup.service as LessonChoice['service'], instrument: program, duration: String(makeup.duration), frequency: 'À-la-carte', start: selected?.date || '', time: selected?.time || '', teacher: selected?.teacher || '' }
  const person = { ...student, activeTeacher: false }
  const daySlots = new Map<string, ReturnType<typeof makeupSlots>>()
  const availability = (date: string, time: string) => {
    if (!daySlots.has(date)) daySlots.set(date, availableSlots ? availableSlots(date).filter(slot => !sameTeacher || slot.teacher === makeup.teacher) : makeupSlots(data, state, makeup, date, program, sameTeacher))
    return daySlots.get(date)!.filter(slot => slot.time === time && (!inline || sameTeacher || !teacher || slot.teacher === teacher)).map(slot => ({ name: slot.teacher }))
  }
  if (inline) return <AccountWorkspace profileSubtitle={profileSubtitle} title={`Schedule ${makeup.program} makeup · ${makeup.duration} min`} accountName={accountName || previewStudentName(student)} onBack={onBack}>
    <CalendarBookingLayout booking studentName={previewStudentName(student)} sidebar={sidebar} makeup={makeup} program={program} sameTeacher={sameTeacher} onSameTeacher={value => { setSameTeacher(value); setSelected(null); setError('') }} teacher={teacher} onTeacher={value => { setTeacher(value); setSelected(null); setError('') }} selected={selected} onConfirm={() => { if (selected) setError(onBook(selected) || '') }} error={error}>
      <LessonSchedule toolbarActions={<label className={bookingStyles.checkbox}><input type="checkbox" checked={sameTeacher} onChange={event => { setSameTeacher(event.target.checked); setTeacher(''); setSelected(null); setError('') }} />Same teacher</label>} detailedReplacementSlots chooseTeacherOnClick={!sameTeacher} lesson={lesson} lessons={selected ? [lesson] : []} replacementMode student={person} manager={null} initialDate="2026-11-09" compactCopy teacherPreference={sameTeacher ? makeup.teacher : teacher} availability={availability} onChange={patch => { const next = { ...lesson, ...patch }; setSelected(next.start && next.time && next.teacher ? { date: next.start, time: next.time, teacher: next.teacher, program } : null); setError('') }} />
    </CalendarBookingLayout>
  </AccountWorkspace>
  return <AccountWorkspace profileSubtitle={profileSubtitle} title="Schedule makeup" accountName={accountName || previewStudentName(student)} onBack={onBack}>
    <div data-inline-calendar="" className={styles.calendarTaskLayout}>
    <aside className={styles.stack} style={{ gap: spacing.lg }}>
      <DenseSectionPanel title="Makeup" headingLevel="h2"><FieldGrid><DetailField label="Original lesson" value={`${formatScheduleDate(makeup.date)} · ${makeup.program}`} /><DetailField label="Duration" value={`${makeup.duration} minutes · ${makeup.service}`} /></FieldGrid></DenseSectionPanel>
      <DenseSectionPanel title="Find a time" headingLevel="h2">
        <FieldGrid>
          <Select label="Instrument / program" value={program} onChange={event => { setProgram(event.target.value); setSelected(null) }}>{(makeup.service === 'Group' ? enrollmentGroupPrograms : enrollmentInstruments).map(item => <option key={item}>{item}</option>)}</Select>
          <Select label="Teacher preference" value={sameTeacher ? 'same' : 'any'} onChange={event => { setSameTeacher(event.target.value === 'same'); setSelected(null) }}><option value="same">Same teacher · {makeup.teacher}</option><option value="any">Any suitable teacher</option></Select>
        </FieldGrid>
      </DenseSectionPanel>
      {selected && <DenseSectionPanel title="Replacement lesson" headingLevel="h2" actions={<Button onClick={() => setError(onBook(selected) || '')}>Book makeup</Button>}><FieldGrid><DetailField label="Date / time" value={`${formatScheduleDate(selected.date)} · ${formatScheduleTime(selected.time)}`} /><DetailField label="Teacher / program" value={`${selected.teacher} · ${selected.program}`} /></FieldGrid></DenseSectionPanel>}
      {error && <div role="alert" style={typography.bodySmall}>{error}</div>}
    </aside>
    <div className={styles.calendarTaskCanvas}>
      <LessonSchedule key={`${program}:${sameTeacher}`} lesson={lesson} lessons={selected ? [lesson] : []} student={person} manager={null} initialDate="2026-11-09" compactCopy availability={availability} onChange={patch => { const next = { ...lesson, ...patch }; if (!next.start || !next.time || !next.teacher) setSelected(null); else setSelected({ date: next.start, time: next.time, teacher: next.teacher, program }); setError('') }} />
    </div>
    </div>
  </AccountWorkspace>
}
