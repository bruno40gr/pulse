'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { EnrollmentPerson, LessonChoice } from '@/lib/academy-staff-enrollment'
import {
  availableScheduleTeachers, familyAppointments, formatScheduleDate, formatScheduleTime,
  lessonOccursOn, overlap, sampleWeek, scheduleTeachers, scheduleTimes, selectScheduleSlot, shiftDate, weekDates, weekStart,
} from '@/lib/academy-enrollment-schedule'
import styles from './enrollment.module.css'

type CalendarBlock = {
  id: string; time: string; duration: number; label: string; booked: boolean; active?: boolean
  teachers?: readonly { name: string }[]
}

// Overlapping start options get separate lanes; every half hour has the same height.
function placeBlocks(blocks: CalendarBlock[]) {
  const ends: number[] = []
  const placed = [...blocks].sort((a, b) => a.time.localeCompare(b.time) || Number(b.booked) - Number(a.booked)).map(block => {
    const row = (Number(block.time.slice(0, 2)) * 60 + Number(block.time.slice(3)) - 14 * 60) / 30
    let lane = ends.findIndex(end => end <= row)
    if (lane === -1) lane = ends.length
    ends[lane] = row + block.duration / 30
    return { ...block, row, lane }
  })
  return { blocks: placed, lanes: Math.max(1, ends.length) }
}

export default function LessonSchedule({ lesson, lessons, student, students = [], manager, onChange, onSelectLesson }: {
  lesson: LessonChoice; lessons: readonly LessonChoice[]; student: EnrollmentPerson | null
  students?: readonly EnrollmentPerson[]; manager: EnrollmentPerson | null; onChange: (value: Partial<LessonChoice>) => void
  onSelectLesson?: (id: string) => void
}) {
  const [week, setWeek] = useState(() => weekStart(lesson.start || sampleWeek))
  const [excludedTeachers, setExcludedTeachers] = useState<string[]>([])
  const [choice, setChoice] = useState<{ date: string; time: string; editing?: boolean } | null>(null)
  const dates = weekDates(week)
  const family = [...new Map([student, ...students].flatMap(person => familyAppointments(person, manager)).map(event => [event.id, event])).values()]
  const teachers = scheduleTeachers.filter(teacher => teacher.instruments.some(instrument => instrument === lesson.instrument))
  const name = (id?: string) => { const person = students.find(item => item.id === id) || (student?.id === id ? student : null); return person ? `${person.firstName} ${person.lastName}` : 'Student' }
  const familyDates = [...new Set([...family.map(event => event.date), ...lessons.flatMap(item => dates.filter(date => lessonOccursOn(item, date)))])].filter(date => dates.includes(date)).sort()
  const familyIds = new Set([...students.map(person => person.id), ...(student ? [student.id] : []), ...family.map(event => event.studentId)])
  const choices = choice ? availableScheduleTeachers(lesson, choice.date, choice.time, student, lessons).filter(teacher => choice.editing || !excludedTeachers.includes(teacher.name)) : []

  return <div className={styles.schedule}>
    {lesson.teacher && lesson.start && lesson.time && <section className={styles.bookingActions} aria-label="Selected booking">
      <span>{formatScheduleDate(lesson.start)} · {formatScheduleTime(lesson.time)} · {lesson.teacher}</span>
      <Button type="button" variant="ghost" onClick={() => setChoice({ date: lesson.start, time: lesson.time, editing: true })}>Change teacher</Button>
      <Button type="button" variant="ghost" onClick={() => { onChange({ teacher: '', start: '', time: '', day: '' }); setChoice(null) }}>Clear time</Button>
      {choice?.editing && <div className={styles.editTeachers} role="group" aria-label="Change teacher">{choices.map(teacher => <button key={teacher.name} type="button" aria-pressed={teacher.name === lesson.teacher} onClick={() => { onChange({ teacher: teacher.name }); setChoice(null) }}>{teacher.name}</button>)}<Button type="button" variant="ghost" onClick={() => setChoice(null)}>Cancel</Button></div>}
    </section>}
    <section className={styles.teacherPreference} aria-label="Teacher preference"><h3>Teacher preference</h3><div className={styles.teacherFilters} role="group" aria-label="Teachers">{teachers.map(teacher => <label key={teacher.name}><input type="checkbox" checked={!excludedTeachers.includes(teacher.name)} onChange={event => { setExcludedTeachers(current => event.target.checked ? current.filter(name => name !== teacher.name) : [...current, teacher.name]); setChoice(null) }} />{teacher.name}</label>)}</div></section>
    <div className={styles.weekToolbar}>
      <Button type="button" variant="ghost" aria-label="Previous week" onClick={() => { setWeek(shiftDate(week, -7)); setChoice(null) }}><ChevronLeft size={17} /></Button>
      <strong>{formatScheduleDate(dates[0])}–{formatScheduleDate(dates[4], { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
      <Button type="button" variant="ghost" aria-label="Next week" onClick={() => { setWeek(shiftDate(week, 7)); setChoice(null) }}><ChevronRight size={17} /></Button>
    </div>
    <div className={styles.calendarScroll} tabIndex={0} role="region" aria-label="Available lesson times">
      <div className={styles.timeGrid}>
        <div className={styles.timeAxis}><div className={styles.dayHeading}>Time</div>{scheduleTimes.map(time => <div key={time} className={styles.timeLabel}>{formatScheduleTime(time)}</div>)}</div>
        {dates.map(date => {
          const planned = lessons.filter(item => lessonOccursOn(item, date))
          const existing = family.filter(event => event.date === date)
          const booked: CalendarBlock[] = [
            ...planned.map(item => ({ id: item.id, time: item.time, duration: Number(item.duration), label: item.id === lesson.id ? name(item.studentId || student?.id) : `${name(item.studentId || student?.id)}, ${item.instrument} with ${item.teacher.split(' ')[0]}`, booked: true, active: item.id === lesson.id })),
            ...existing.map(event => ({ id: event.id, time: event.time, duration: event.duration, label: `${event.studentName}, ${event.instrument} with ${event.teacher.split(' ')[0]}`, booked: true })),
          ]
          const open: CalendarBlock[] = scheduleTimes.flatMap(time => {
            // A booked lesson replaces its start option rather than adding another block.
            if (planned.some(item => item.id === lesson.id && overlap(time, Number(lesson.duration), item.time, Number(item.duration)))) return []
            const available = availableScheduleTeachers(lesson, date, time, student, lessons).filter(teacher => !excludedTeachers.includes(teacher.name))
            return available.length ? [{ id: `open-${time}`, time, duration: Number(lesson.duration), label: `${formatScheduleDate(date, { weekday: 'long', month: 'short', day: 'numeric' })} ${formatScheduleTime(time)}, ${available.length} ${available.length === 1 ? 'teacher' : 'teachers'} available`, booked: false, teachers: available }] : []
          })
          const layout = placeBlocks([...booked, ...open])
          return <div key={date} className={styles.dayColumn}><div className={styles.dayHeading}><span>{formatScheduleDate(date, { weekday: 'short' })}</span><strong>{formatScheduleDate(date, { day: 'numeric' })}</strong></div><div className={styles.daySlots} style={{ gridTemplateColumns: `repeat(${layout.lanes}, minmax(0, 1fr))` }}>
            {layout.blocks.map(block => {
              const position = { gridRow: `${block.row + 1} / span ${block.duration / 30}`, gridColumn: block.lane + 1 }
              const label = `${block.label}, ${formatScheduleDate(date)}, ${formatScheduleTime(block.time)}–${formatScheduleTime(endTime(block.time, String(block.duration)))}`
              if (block.booked) return onSelectLesson && planned.some(item => item.id === block.id)
                ? <button key={block.id} type="button" className={`${styles.bookedSlot} ${block.active ? styles.activeBookedSlot : ''}`} style={position} aria-label={label} aria-pressed={block.active} onClick={() => { setChoice(block.active ? { date: lesson.start, time: lesson.time, editing: true } : null); onSelectLesson(block.id) }}>{block.label}</button>
                : <div key={block.id} className={`${styles.bookedSlot} ${block.active ? styles.activeBookedSlot : ''}`} style={position} aria-label={label}>{block.label}</div>
              const choosing = !choice?.editing && choice?.date === date && choice.time === block.time
              return <div key={block.id} className={styles.slotOption} style={position}>
                <button type="button" className={`${styles.openSlot} ${block.duration === 60 ? styles.longLesson : styles.shortLesson}`} aria-label={block.label} aria-pressed={choosing} aria-expanded={block.teachers && block.teachers.length > 1 ? choosing : undefined} onClick={() => {
                  if (block.teachers?.length === 1) { onChange(selectScheduleSlot(lesson, date, block.time, block.teachers[0].name)); setChoice(null) }
                  else setChoice(choosing ? null : { date, time: block.time })
                }}><span>{formatScheduleTime(block.time)}–{formatScheduleTime(endTime(block.time, String(block.duration)))}</span><span>{block.duration} min · {block.teachers?.length} {block.teachers?.length === 1 ? 'teacher' : 'teachers'}</span></button>
                {choosing && <div className={styles.inlineTeachers} role="group" aria-label={`Teachers at ${formatScheduleTime(block.time)}`}>{choices.map(teacher => <button key={teacher.name} type="button" onClick={() => { onChange(selectScheduleSlot(lesson, date, block.time, teacher.name)); setChoice(null) }}>{teacher.name}</button>)}</div>}
              </div>
            })}
          </div></div>
        })}
      </div>
    </div>
    <p className={styles.calendarTimezone}>America/Los_Angeles</p>
    {familyIds.size > 1 && familyDates.length > 0 && <section className={styles.familySchedule} aria-label="Family lessons this week"><h3>Family lessons this week</h3>
      {familyDates.map(date => <div key={date}><h4>{formatScheduleDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}</h4>
        {[...family.filter(event => event.date === date).map(event => ({ id: event.id, time: event.time, text: `${event.studentName} · ${event.instrument} with ${event.teacher}` })), ...lessons.filter(item => lessonOccursOn(item, date)).map(item => ({ id: item.id, time: item.time, text: `${name(item.studentId || student?.id)} · ${item.instrument} with ${item.teacher}` }))].sort((a, b) => a.time.localeCompare(b.time)).map(event => <p key={event.id}><strong>{formatScheduleTime(event.time)}</strong><span>{event.text}</span></p>)}
      </div>)}
    </section>}
  </div>
}

function endTime(time: string, duration: string) {
  const total = Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) + Number(duration)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
