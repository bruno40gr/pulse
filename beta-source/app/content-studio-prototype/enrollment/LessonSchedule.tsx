'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { CalendarBookingBlock } from './CalendarBookingBlock'
import { BookableSlot } from '@/beta-source/app/odeon-demo/BookableSlot'
import { CalendarTimeGrid } from './CalendarTimeGrid'
import { CalendarWeekToolbar } from './CalendarWeekToolbar'
import type { EnrollmentPerson, LessonChoice } from '@/beta-source/lib/academy-staff-enrollment'
import {
  availableScheduleTeachers, familyAppointments, formatScheduleDate, formatScheduleTime,
  lessonOccursOn, overlap, sampleWeek, selectScheduleSlot, shiftDate, weekDates, weekStart,
} from '@/beta-source/lib/academy-enrollment-schedule'
import { placeCalendarBlocks as placeBlocks } from '@/beta-source/lib/academy-calendar-layout'
import styles from './enrollment.module.css'
import { calendarStudentStyle } from '@/lib/calendar-appearance'

type CalendarBlock = {
  id: string; time: string; duration: number; label: string; booked: boolean; active?: boolean; blocksAvailability?: boolean; lines?: string[]; proposed?: boolean
  teachers?: readonly { name: string }[]; studentId?: string; unavailable?: boolean
}

export default function LessonSchedule({ lesson, lessons, student, students = [], calendarStudentIds, manager, onChange, onSelectLesson, availability, initialDate, compactCopy = false, teacherPreference = '', referenceLessons = [], replacementMode = false, onWeek, toolbarActions, detailedReplacementSlots = false, chooseTeacherOnClick = false }: {
  lesson: LessonChoice; lessons: readonly LessonChoice[]; student: EnrollmentPerson | null
  students?: readonly EnrollmentPerson[]; manager: EnrollmentPerson | null; onChange: (value: Partial<LessonChoice>) => void
  calendarStudentIds?: readonly string[]
  onSelectLesson?: (id: string) => void
  availability?: (date: string, time: string, lesson: LessonChoice) => readonly { name: string }[]
  initialDate?: string
  teacherPreference?: string
  compactCopy?: boolean
  referenceLessons?: readonly { id: string; studentId?: string; date: string; time: string; duration: number; label: string; blocksAvailability?: boolean; lines?: string[]; proposed?: boolean }[]
  replacementMode?: boolean
  chooseTeacherOnClick?: boolean
  detailedReplacementSlots?: boolean
  toolbarActions?: ReactNode
  onWeek?: (week: string) => void
}) {
  const [week, setWeek] = useState(() => weekStart(initialDate || lesson.start || sampleWeek))
  const [choice, setChoice] = useState<{ date: string; time: string; editing?: boolean } | null>(null)
  useEffect(() => {
    if (!choice) return
    const dismiss = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-booking-menu]')) setChoice(null)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); setChoice(null) } }
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('keydown', escape, true)
    }
  }, [choice])
  const dates = referenceLessons.some(item => item.date === shiftDate(week, 6)) ? Array.from({ length: 7 }, (_, index) => shiftDate(week, index)) : weekDates(week)
  const family = replacementMode ? [] : [...new Map([student, ...students].flatMap(person => familyAppointments(person, manager)).map(event => [event.id, event])).values()]

  const name = (id?: string) => { const person = students.find(item => item.id === id) || (student?.id === id ? student : null); return person ? `${person.firstName} ${person.lastName}` : 'Student' }
  // Union, never replace: a sibling outside the passed roster must still get its own colour.
  const colorIds = [...(calendarStudentIds || []), student?.id || '', ...students.map(person => person.id), ...referenceLessons.map(item => item.studentId || ''), ...lessons.map(item => item.studentId || '')]
  const availableTeachers = (date: string, time: string) => availability ? availability(date, time, lesson) : availableScheduleTeachers(lesson, date, time, student, lessons)
  const matchesPreference = (teacher: { name: string }) => !teacherPreference || teacher.name === teacherPreference
  const choices = choice ? availableTeachers(choice.date, choice.time).filter(teacher => choice.editing || matchesPreference(teacher)) : []
  // A calendar proposal can start before the legacy 2pm sample grid.
  const firstMinute = Math.min(14 * 60, ...lessons.filter(item => item.time).map(item => Number(item.time.slice(0, 2)) * 60 + Number(item.time.slice(3))))
  const lastMinute = Math.max(19 * 60, ...lessons.filter(item => item.time).map(item => Number(item.time.slice(0, 2)) * 60 + Number(item.time.slice(3)) + Number(item.duration)))
  const gridTimes = Array.from({ length: (lastMinute - firstMinute) / 15 }, (_, index) => {
    const minute = firstMinute + index * 15
    return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
  })

  return <div className={`${styles.schedule} ${replacementMode ? styles.replacementCalendar : ''}`} style={calendarStudentStyle(lesson.studentId || student?.id || '', colorIds)} data-replacement-calendar={replacementMode ? '' : undefined}>
    <div className={styles.calendarColumn}><CalendarWeekToolbar week={week} lastDate={dates[dates.length - 1]} onWeek={date => { setWeek(date); onWeek?.(date); setChoice(null) }}>{toolbarActions}</CalendarWeekToolbar>
    {!compactCopy && lesson.service !== 'Private' && <p className={styles.teacherNote}>{lesson.service === 'Group' ? 'Fictional scheduled group sessions only. Places and capacity are not managed in this demo.' : 'Fictional semi-private times. Partner matching and shared enrollment are not managed in this demo.'}</p>}
    <CalendarTimeGrid dates={dates} times={gridTimes} label="Available lesson times" renderDay={date => {
          const planned = lessons.filter(item => lessonOccursOn(item, date))
          const existing = family.filter(event => event.date === date)
          const booked: CalendarBlock[] = [
            ...referenceLessons.filter(item => item.date === date).map(item => ({ ...item, booked: true })),
            ...planned.map(item => ({ id: item.id, time: item.time, duration: Number(item.duration), label: item.id === lesson.id ? name(item.studentId || student?.id) : `${name(item.studentId || student?.id)}, ${item.instrument} with ${item.teacher.split(' ')[0]}`, lines: [item.instrument, name(item.studentId || student?.id), `${item.time} · ${item.teacher}`], booked: true, active: item.id === lesson.id })),
            ...existing.map(event => ({ id: event.id, studentId: event.studentId, time: event.time, duration: event.duration, label: `${event.studentName}, ${event.instrument} with ${event.teacher.split(' ')[0]}`, booked: true })),
          ]
          const open: CalendarBlock[] = []
          for (const time of gridTimes) {
            if ([...booked, ...open].some(item => item.blocksAvailability !== false && overlap(time, Number(lesson.duration), item.time, item.duration))) continue
            const available = availableTeachers(date, time).filter(matchesPreference)
            if (available.length) open.push({ id: `open-${time}`, time, duration: Number(lesson.duration), label: `${formatScheduleDate(date, { weekday: 'long', month: 'short', day: 'numeric' })} ${formatScheduleTime(time)}, ${available.length} ${available.length === 1 ? 'teacher' : 'teachers'} available`, booked: false, teachers: available })
          }
          // Blank cells are ambiguous; show the times this lesson cannot move to.
          const unavailable: CalendarBlock[] = replacementMode ? gridTimes.flatMap(time => [time]).filter(time => ![...booked, ...open].some(item => overlap(time, 15, item.time, item.duration))).map(time => ({ id: `unavailable-${time}`, time, duration: 15, label: `Not available at ${formatScheduleTime(time)}`, booked: false, unavailable: true })) : []
          const layout = placeBlocks([...booked, ...open, ...unavailable], firstMinute)
          return <div className={styles.daySlots} style={{ gridTemplateRows: `repeat(${gridTimes.length}, var(--calendar-slot-height))`, gridTemplateColumns: `repeat(${layout.lanes}, minmax(0, 1fr))` }}>
            {layout.blocks.map(block => {
              const personId = block.studentId || lessons.find(item => item.id === block.id)?.studentId || student?.id || ''
              const position = { gridRow: `${block.row + 1} / span ${block.duration / 15}`, gridColumn: block.lane + 1, ...calendarStudentStyle(personId, colorIds) }
              const label = `${block.label}, ${formatScheduleDate(date)}, ${formatScheduleTime(block.time)}–${formatScheduleTime(endTime(block.time, String(block.duration)))}`
              if (block.unavailable) return <div key={block.id} className={styles.unavailableSlot} style={position} title={block.label} aria-label={block.label} data-unavailable-slot="" />
              if (block.booked) {
                const interactive = (!replacementMode && block.active) || (onSelectLesson && planned.some(item => item.id === block.id))
                const editing = block.active && choice?.editing && choice.date === date
                const booking = interactive
                  ? <CalendarBookingBlock interactive className={`${styles.bookedSlot} ${block.lines ? styles.scheduleDetails : ''} ${detailedReplacementSlots ? styles.detailedSlot : ''} ${block.active ? styles.activeBookedSlot : ''}`} style={position} aria-label={label} title={block.lines?.join(' · ') || label} aria-pressed={block.active} aria-expanded={block.active ? Boolean(editing) : undefined} onClick={() => { setChoice(block.active && !editing ? { date, time: block.time, editing: true } : null); onSelectLesson?.(block.id) }}>{block.lines ? block.lines.map((line, index) => <span key={index}>{line}</span>) : block.label}</CalendarBookingBlock>
                  : <CalendarBookingBlock className={`${styles.bookedSlot} ${detailedReplacementSlots ? styles.detailedSlot : ''} ${block.active ? replacementMode ? styles.replacementSlot : styles.activeBookedSlot : replacementMode ? block.proposed ? styles.replacementSlot : styles.familyReferenceSlot : ''}`} style={position} aria-label={label} title={label} data-calendar-time={block.time} data-calendar-date={date} data-family-reference={block.lines ? '' : undefined} data-proposed-reference={block.proposed ? '' : undefined} data-selected-replacement={replacementMode && block.active ? '' : undefined}>{replacementMode && block.active ? detailedReplacementSlots ? <><span>{lesson.instrument}</span><span>{lesson.teacher}</span><span>{formatScheduleTime(block.time).replace(' ', '')}</span></> : `${formatScheduleTime(block.time)} · ${lesson.teacher}` : detailedReplacementSlots && block.lines ? block.lines.map((line, index) => <span key={index}>{line}</span>) : block.label}</CalendarBookingBlock>
                return <div key={block.id} className={styles.bookedCell} style={position} data-booking-menu={editing ? '' : undefined}>{booking}{editing && <div className={styles.bookingPopover} role="group" aria-label="Change teacher">
                  <strong>Change teacher</strong>
                  {choices.map(teacher => <button key={teacher.name} type="button" aria-pressed={teacher.name === lesson.teacher} onClick={() => { onChange({ teacher: teacher.name }); setChoice(null) }}>{teacher.name}</button>)}
                  <button className={styles.clearSlot} type="button" onClick={() => { onChange({ teacher: '', start: '', time: '', day: '' }); setChoice(null) }}>Clear time slot</button>
                </div>}</div>
              }
              const choosing = !choice?.editing && choice?.date === date && choice.time === block.time
              return <div key={block.id} className={styles.slotOption} style={position} data-booking-menu={choosing ? '' : undefined}>
                <BookableSlot
                  title={lesson.instrument}
                  when={`${formatScheduleDate(date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${formatScheduleTime(block.time)}`}
                  teachers={(block.teachers || availableTeachers(date, block.time)).map(teacher => teacher.name)}
                  selectedTeacher={choosing ? lesson.teacher : undefined}
                  picked={choosing}
                  teacherLabel={`Teachers at ${formatScheduleTime(block.time)}`}
                  style={position}
                  onPick={() => {
                    if (block.teachers?.length === 1 && !chooseTeacherOnClick) { onChange(selectScheduleSlot(lesson, date, block.time, block.teachers[0].name)); setChoice(null) } else setChoice(choosing ? null : { date, time: block.time })
                  }}
                  onChooseTeacher={teacher => { onChange(selectScheduleSlot(lesson, date, block.time, teacher)); setChoice(null) }} />
              </div>
            })}
          </div>
        }} />
    {!compactCopy && <p className={styles.calendarTimezone}>America/Los_Angeles · Each grid unit is 15 minutes. Blocks show their full duration. Available windows do not overlap; selecting one keeps it in place.</p>}
    </div>
  </div>
}

function endTime(time: string, duration: string) {
  const total = Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) + Number(duration)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
