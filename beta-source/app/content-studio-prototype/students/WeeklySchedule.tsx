'use client'

import { useState } from 'react'
import { Button, DenseSectionPanel, DetailField, EmptyState, FieldGrid } from '@/beta-source/components/ui'
import { formatScheduleDate, formatScheduleTime, shiftDate, weekStart } from '@/beta-source/lib/academy-enrollment-schedule'
import { placeCalendarBlocks } from '@/beta-source/lib/academy-calendar-layout'
import { makeupPreviewNow, previewCalendarLessons, type PreviewMakeup } from '@/beta-source/lib/academy-makeup-preview'
import type { FamilyPreviewData } from '@/beta-source/lib/academy-family-preview'
import { previewStudentName, type WorkspaceLocation } from '@/beta-source/lib/academy-student-preview'
import { spacing, typography } from '@/beta-source/lib/tokens'
import styles from '../enrollment/enrollment.module.css'
import { CalendarTimeGrid } from '../enrollment/CalendarTimeGrid'
import { CalendarTeacherFilter } from '../enrollment/CalendarTeacherFilter'
import { CalendarWeekToolbar } from '../enrollment/CalendarWeekToolbar'
import { OverflowMenu } from '@/beta-source/components/ui/OverflowMenu'
import workspaceStyles from './StudentWorkspace.module.css'

export function WeeklySchedule({ data, makeups, location, initialDate, onEnsure, onLesson, onMove, onSelect, externalSelection, taskLayout = false, compact = false, week: controlledWeek, onWeek }: { data: FamilyPreviewData; makeups: PreviewMakeup[]; location: WorkspaceLocation; initialDate?: string; onEnsure: (through: string) => void; onLesson: (id: string) => void; onMove: (id: string) => void; onSelect?: (id: string) => void; externalSelection?: string | null; taskLayout?: boolean; compact?: boolean; week?: string; onWeek?: (week: string) => void }) {
  const [localWeek, setWeek] = useState(() => weekStart(initialDate || makeupPreviewNow.slice(0, 10)))
  const week = controlledWeek || localWeek
  const [localSelectedId, setSelectedId] = useState<string | null>(null)
  const [actionsId, setActionsId] = useState<string | null>(null)
  const [hiddenTeachers, setHiddenTeachers] = useState<string[]>([])
  const selectedId = externalSelection === undefined ? localSelectedId : externalSelection
  const lessons = previewCalendarLessons(data, makeups, { ...location, teacher: '' })
  const fullWeek = Array.from({ length: 7 }, (_, index) => shiftDate(week, index))
  const weekEntries = lessons.filter(item => fullWeek.includes(item.date))
  // Always show Saturday, and never conceal scheduled Sunday lessons.
  const dates = taskLayout && !weekEntries.some(item => fullWeek.indexOf(item.date) === 6) ? fullWeek.slice(0, 6) : fullWeek
  const teachers = [...new Set(lessons.map(item => item.teacher))].sort()
  const entries = weekEntries.filter(item => !taskLayout || !hiddenTeachers.includes(item.teacher))
  const selected = entries.find(item => item.id === selectedId)
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  const start = Math.min(14 * 60, ...entries.map(item => Math.floor(minutes(item.time) / 60) * 60))
  const end = Math.max(19 * 60, ...entries.map(item => Math.ceil((minutes(item.time) + item.duration) / 60) * 60))
  const rows = (end - start) / 15
  const time = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
  function navigate(next: string) { setActionsId(null); setWeek(next); onWeek?.(next); setSelectedId(null); onEnsure(shiftDate(next, 6)) }
  const details = selected && !onSelect ? <DenseSectionPanel title={`${selected.program}${selected.makeup ? ' · Makeup lesson' : ''}`} actions={selected.status === 'Scheduled' ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}><Button variant="secondary" aria-label={`Reschedule ${selected.student.firstName} ${selected.program} lesson ${selected.date}`} onClick={() => onMove(selected.id)}>Reschedule lesson</Button><Button variant="secondary" aria-label={`Cancel ${selected.student.firstName} ${selected.program} lesson ${selected.date}`} onClick={() => onLesson(selected.id)}>Cancel lesson</Button></div> : undefined}>
    <FieldGrid><DetailField label="Student" value={previewStudentName(selected.student)} /><DetailField label="Date / time" value={`${formatScheduleDate(selected.date)} · ${formatScheduleTime(selected.time)}`} /><DetailField label="Teacher" value={selected.teacher} /><DetailField label="Status" value={selected.status} /></FieldGrid>
  </DenseSectionPanel> : null
  return <section data-inline-calendar={taskLayout && !compact ? '' : undefined} aria-label="Combined weekly schedule" className={taskLayout && !compact ? workspaceStyles.calendarTaskLayout : undefined} style={{ minWidth: 0 }}>
    {taskLayout && !compact && <aside aria-label="Calendar details" className={workspaceStyles.stack} style={{ gap: spacing.lg }}>
      <DenseSectionPanel title="Lessons"><FieldGrid><DetailField label="Subscriptions" value={location.enrollmentId ? 'Selected subscription' : 'All subscriptions'} /><DetailField label="This week" value={`${entries.length} ${entries.length === 1 ? 'lesson' : 'lessons'}`} /></FieldGrid></DenseSectionPanel>
      {details || <DenseSectionPanel title="Select a lesson"><p style={{ ...typography.bodySmall, margin: 0 }}>Choose a lesson in the calendar to review its details, move it or cancel it.</p></DenseSectionPanel>}
    </aside>}
    <div className={taskLayout ? workspaceStyles.calendarTaskCanvas : undefined}>
    <div className={taskLayout ? workspaceStyles.calendarToolbar : undefined}>
    {(!compact || location.view === 'parent') && <CalendarWeekToolbar week={week} lastDate={dates[dates.length - 1]} onWeek={navigate}>
      {!taskLayout && <Button variant="secondary" onClick={() => navigate(weekStart(makeupPreviewNow.slice(0, 10)))}>Today</Button>}
    </CalendarWeekToolbar>}
    {taskLayout && <CalendarTeacherFilter teachers={teachers} hidden={hiddenTeachers} onChange={hidden => { setHiddenTeachers(hidden); setSelectedId(null) }} />}
    </div>
    {!taskLayout && !compact && <p style={typography.bodySmall}>{location.enrollmentId ? 'Selected subscription' : 'All subscriptions'} · Scroll horizontally to see the full week on smaller screens.</p>}
    <CalendarTimeGrid dates={dates} times={Array.from({ length: rows }, (_, index) => time(start + index * 15))} label="Weekly lesson calendar" renderDay={date => {
        const layout = placeCalendarBlocks(entries.filter(item => item.date === date).map(item => ({ ...item, booked: true })), start)
        return <div className={styles.daySlots} style={{ gridTemplateRows: `repeat(${rows}, var(--calendar-slot-height))`, gridTemplateColumns: `repeat(${layout.lanes}, minmax(0, 1fr))` }}>
          {layout.blocks.map(item => <div key={item.id} style={{ gridRow: `${item.row + 1} / span ${item.duration / 15}`, gridColumn: item.lane + 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: actionsId === item.id ? 5 : undefined }}><button type="button" className={styles.bookedSlot} aria-label={`Select ${item.student.firstName} ${item.program} lesson ${item.date}${item.makeup ? ', makeup lesson' : ''}`} title={`${previewStudentName(item.student)} · ${item.program} · ${formatScheduleTime(item.time)} · ${item.duration} min · ${item.teacher} · ${item.status}`} aria-pressed={selectedId === item.id} onClick={() => { setSelectedId(item.id); if (compact && item.status === 'Scheduled') setActionsId(actionsId === item.id ? null : item.id); onSelect?.(item.id) }} style={{ gridRow: `${item.row + 1} / span ${item.duration / 15}`, gridColumn: item.lane + 1, cursor: 'pointer', outline: selectedId === item.id ? '2px solid currentColor' : undefined, borderStyle: item.makeup ? 'dashed' : 'solid', display: 'flex', flexDirection: 'column', gap: 4, paddingRight: compact ? 44 : undefined, width: '100%', flex: 1 }}>
            {taskLayout ? <><strong>{item.program}{!location.studentId ? ` · ${item.student.firstName}` : ''}</strong><span>{formatScheduleTime(item.time)}{item.makeup ? ' · Makeup' : ''}{item.status !== 'Scheduled' ? ` · ${item.status}` : ''}</span></> : <>
            <span>{formatScheduleTime(item.time)} · {item.duration} min</span><strong>{item.program}</strong>{!location.studentId && <span>{item.student.firstName}</span>}<span>{item.teacher}</span>{item.makeup && <span>Makeup lesson</span>}{item.status !== 'Scheduled' && <span>{item.status}</span>}
            </>}
          </button>{compact && item.status === 'Scheduled' && <div role="group" aria-label="Lesson actions" style={{ position: 'absolute', top: 0, right: 0, zIndex: 4 }}><OverflowMenu expanded={actionsId === item.id} onExpandedChange={open => setActionsId(open ? item.id : null)} label={`${item.student.firstName} ${item.program} lesson ${item.date} actions`} items={[{ label: 'Reschedule lesson', onSelect: () => onMove(item.id) }, { label: 'Cancel lesson', onSelect: () => onLesson(item.id) }]} /></div>}</div>)}
        </div>
      }} />
    {!taskLayout && !compact && <p style={typography.bodySmall}>America/Los_Angeles · Select a lesson for details and actions. Today uses the preview date, {formatScheduleDate(makeupPreviewNow.slice(0, 10))}.</p>}
    {!entries.length && <EmptyState title={weekEntries.length ? 'No lessons match the selected teachers' : 'No upcoming lessons this week'} />}
    {!taskLayout && !compact && details}
    </div>
  </section>
}