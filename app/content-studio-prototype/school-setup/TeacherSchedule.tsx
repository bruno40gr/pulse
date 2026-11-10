'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ControlButton } from '@/components/ui/ControlButton'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { spacing } from '@/lib/tokens'
import { shiftDate, weekStart, formatScheduleDate } from '@/lib/academy-enrollment-schedule'
import { CalendarTimeGrid } from '../enrollment/CalendarTimeGrid'
import { CalendarWeekToolbar } from '../enrollment/CalendarWeekToolbar'
import { teacherAvailabilityForDate, teacherWeekAvailability, teacherDayIndex, validateTeacherExceptions, type TeacherAvailability as Block, type TeacherDateOverride, type TeacherWeekSchedule, type TeacherTimeOff } from './setup-content'
import styles from './teacher-editor.module.css'

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const time = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
const minute = (value: string) => value ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN
function parse<T>(value: string, fallback: T): T { try { return JSON.parse(value) as T } catch { return fallback } }
type Edit = { date: string; block: Block; originalId?: string }

export default function TeacherSchedule({ values, onChange }: { values: Record<string, string>; onChange: (values: Record<string, string>) => void }) {
  const base = parse<Block[]>(values.availability, days.flatMap((day, index) => values.days?.includes(day) ? [{ id: `day-${index}`, day: index, from: minute(values.from || '12:00'), to: minute(values.to || '18:00') }] : []))
  const overrides = parse<TeacherDateOverride[]>(values.availabilityOverrides, [])
  const timeOff = parse<TeacherTimeOff[]>(values.timeOff, [])
  const [week, setWeek] = useState(() => weekStart(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())))
  const dates = Array.from({ length: 7 }, (_, i) => shiftDate(week, i))
  const weeks = parse<TeacherWeekSchedule[]>(values.availabilityWeeks, [])
  const weeklyBase = teacherWeekAvailability(base, weeks, week)
  const [edit, setEdit] = useState<Edit | null>(null)
  const [off, setOff] = useState<TeacherTimeOff | null>(null)
  const offTitle = off && timeOff.some(item => item.id === off.id) ? 'Edit time off' : 'Add time off'
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState<Edit | null>(null)
  const drag = useRef<{ edit: Edit; start: number; mode: 'draw' | 'move' | 'resize' } | null>(null)
  const open = (next: Edit) => { setError(''); setEdit(next) }
  const save = (current: Edit, remove = false) => {
    const block = current.block
    const pool = weeklyBase
    const next = [...pool.filter(item => item.id !== current.originalId), ...(remove ? [] : [block])]
    if (!remove && (!Number.isFinite(block.from) || !Number.isFinite(block.to) || block.from < 360 || block.to > 1320 || block.to <= block.from || next.some(item => item.id !== block.id && item.day === block.day && item.from < block.to && block.from < item.to))) { setError('Choose non-overlapping hours between 6am and 10pm.'); return false }
    onChange({ ...values, availabilityWeeks: JSON.stringify([...weeks.filter(item => item.week !== week), { week, blocks: next }]), availabilityOverrides: JSON.stringify(overrides.filter(item => item.date < week || item.date > dates[6])) })
    setEdit(null); setError(''); return true
  }
  const newOff = (date: string) => { setError(''); setOff({ id: crypto.randomUUID(), sickLeave: false, start: date, end: date, allDay: true, from: 720, to: 780 }) }
  const restore = (date: string) => { onChange({ ...values, availabilityOverrides: JSON.stringify(overrides.filter(item => item.date !== date)) }); setMessage('Weekly availability restored.'); setEdit(null) }
  const position = (element: HTMLElement, y: number) => Math.max(360, Math.min(1320, 360 + Math.round((y - element.getBoundingClientRect().top) / element.getBoundingClientRect().height * 64) * 15))
  return <DenseSectionPanel title="Schedule" headingLevel="h2" actions={<div className={styles.sectionHeader}><Button type="button" variant="secondary" onClick={() => newOff(week)}>Add Time Off</Button><Button type="button" variant="secondary" onClick={() => open({ date: week, block: { id: crypto.randomUUID(), day: 0, from: 720, to: 780 } })}>Add availability</Button></div>} contentStyle={{ display: 'grid', gap: spacing['2xl'] }}>
    <p>Changes apply to this week and carry forward until you edit a later week. Earlier weeks stay unchanged.</p>
    <CalendarWeekToolbar week={week} lastDate={dates[6]} onWeek={date => { setWeek(date); setDraft(null); drag.current = null }} />
    {message && <p role="status">{message}</p>}{error && !edit && !off && <p role="alert">{error}</p>}
    <CalendarTimeGrid dates={dates} times={Array.from({ length: 64 }, (_, i) => time(360 + i * 15))} label="Weekly availability" renderDayHeading={date => <><ControlButton type="button" kind="link" aria-label={`Block ${date} all day`} onClick={() => newOff(date)}>{formatScheduleDate(date, { weekday: 'short', day: 'numeric' })}</ControlButton>{overrides.some(item => item.date === date) && <ControlButton type="button" kind="link" aria-label={`Restore weekly availability ${date}`} onClick={() => restore(date)}>Restore weekly</ControlButton>}</>} renderDay={date => {
      const day = teacherDayIndex(date)
      const visible = teacherAvailabilityForDate(weeklyBase, overrides, timeOff, date)
      const drawn = draft?.date === date ? draft : null
      return <div className={styles.day} aria-label={`${days[day]} availability grid`} onPointerDown={event => {
        if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
        const target = event.target as HTMLElement, id = target.closest('[data-block]')?.getAttribute('data-block')
        const segment = visible.find(item => item.id === id)
        const source = weeklyBase.find(item => item.id === id)
        if (segment && (!source || source.from !== segment.from || source.to !== segment.to)) { setMessage('Edit this week’s availability using Add availability, or edit its time off.'); return }
        const start = position(event.currentTarget, event.clientY)
        const block = source || { id: crypto.randomUUID(), day, from: Math.min(start, 1305), to: Math.min(start + 30, 1320) }
        const next: Edit = { date, block, originalId: source?.id }
        drag.current = { edit: next, start, mode: source ? target.dataset.resize ? 'resize' : 'move' : 'draw' }; setDraft(next); event.currentTarget.setPointerCapture(event.pointerId)
      }} onPointerMove={event => {
        const current = drag.current; if (!current) return
        const end = position(event.currentTarget, event.clientY), delta = end - current.start, original = current.edit.block
        const from = current.mode === 'draw' ? Math.min(current.start, end, 1305) : current.mode === 'move' ? Math.max(360, Math.min(1320 - (original.to - original.from), original.from + delta)) : original.from
        const to = current.mode === 'draw' ? Math.min(1320, Math.max(current.start, end, from + 15)) : current.mode === 'move' ? from + original.to - original.from : Math.max(from + 15, Math.min(1320, original.to + delta))
        setDraft({ ...current.edit, block: { ...original, from, to } })
      }} onPointerUp={() => { if (draft) save(draft); drag.current = null; setDraft(null) }} onPointerCancel={() => { drag.current = null; setDraft(null) }}>
        {[...visible.filter(block => block.id !== drawn?.originalId), ...(drawn ? [drawn.block] : [])].map(block => <div key={block.id} data-block={block.id} className={styles.block} style={{ top: `${(block.from - 360) / 960 * 100}%`, height: `${(block.to - block.from) / 960 * 100}%` }}><ControlButton kind="link" type="button" aria-label={`Edit ${days[day]} availability ${time(block.from)}–${time(block.to)}`} onClick={() => { const source = weeklyBase.find(item => item.id === block.id) || weeklyBase.find(item => block.from >= item.from && block.to <= item.to); if (source) open({ date, block: source, originalId: source.id }) }}>{time(block.from)}–{time(block.to)}</ControlButton><span data-resize="true" className={styles.resize} /></div>)}
        {timeOff.filter(item => item.start <= date && item.end >= date).map(item => <div key={item.id} className={styles.timeOff} style={{ top: `${((item.allDay ? 360 : item.from) - 360) / 960 * 100}%`, height: `${(item.allDay ? 960 : item.to - item.from) / 960 * 100}%` }}><ControlButton kind="link" type="button" aria-label={`Edit time off ${item.sickLeave ? 'Sick leave' : 'Time off'} ${date}`} onClick={() => { setError(''); setOff(item) }}>{item.sickLeave ? 'Sick leave' : 'Time off'}{item.allDay ? ' · All day' : ''}</ControlButton></div>)}
      </div>
    }} />
    <FieldGrid><Select label="Preferred rest break" hint="Separate from meal breaks." value={values.restBreakMinutes || '10'} onChange={event => onChange({ ...values, restBreakMinutes: event.target.value })}><option value="10">10 minutes</option><option value="30">30 minutes</option></Select><Select label="Preferred meal break" value={values.mealBreakMinutes || '30'} onChange={event => onChange({ ...values, mealBreakMinutes: event.target.value })}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></Select></FieldGrid>
    <Modal isOpen={!!edit} onClose={() => setEdit(null)} ariaLabel="Edit availability"><ModalHeader title="Availability" onClose={() => setEdit(null)} />{edit && <><ModalBody><div className={styles.editor}><Input label="Date" type="date" value={edit.date} onChange={event => { if (event.target.value) setEdit({ ...edit, date: event.target.value, originalId: undefined, block: { ...edit.block, id: crypto.randomUUID(), day: teacherDayIndex(event.target.value) } }) }} /><FieldGrid><Input label="Starts" type="time" step={900} value={time(edit.block.from)} onChange={event => setEdit({ ...edit, block: { ...edit.block, from: minute(event.target.value) } })} /><Input label="Ends" type="time" step={900} value={time(edit.block.to)} onChange={event => setEdit({ ...edit, block: { ...edit.block, to: minute(event.target.value) } })} /></FieldGrid>{error && <p role="alert">{error}</p>}</div></ModalBody><ModalFooter leading={edit.originalId ? <Button type="button" variant="ghost" onClick={() => save(edit, true)}>Remove availability</Button> : undefined}><Button type="button" onClick={() => save(edit)}>Save availability</Button></ModalFooter></>}</Modal>
    <Modal isOpen={!!off} onClose={() => setOff(null)} ariaLabel={offTitle}><ModalHeader title={offTitle} onClose={() => setOff(null)} />{off && <><ModalBody><div className={styles.editor}><Checkbox label="Sick leave" checked={off.sickLeave === true} onChange={event => setOff({ ...off, sickLeave: event.target.checked })} /><FieldGrid><Input label="From date" type="date" value={off.start} onChange={event => setOff({ ...off, start: event.target.value })} /><Input label="Through date" type="date" min={off.start} value={off.end} onChange={event => setOff({ ...off, end: event.target.value })} /></FieldGrid><Checkbox label="All day" checked={off.allDay} onChange={event => setOff({ ...off, allDay: event.target.checked })} />{!off.allDay && <FieldGrid><Input label="Time off starts" type="time" value={time(off.from)} onChange={event => setOff({ ...off, from: minute(event.target.value) })} /><Input label="Time off ends" type="time" value={time(off.to)} onChange={event => setOff({ ...off, to: minute(event.target.value) })} /></FieldGrid>}{error && <p role="alert">{error}</p>}</div></ModalBody><ModalFooter leading={timeOff.some(item => item.id === off.id) ? <Button type="button" variant="ghost" onClick={() => { onChange({ ...values, timeOff: JSON.stringify(timeOff.filter(item => item.id !== off.id)) }); setOff(null) }}>Remove time off</Button> : undefined}><Button type="button" onClick={() => { const next = { ...values, timeOff: JSON.stringify([...timeOff.filter(item => item.id !== off.id), off]) }; const invalid = validateTeacherExceptions(next); if (invalid) { setError(invalid); return } onChange(next); setOff(null); setMessage('Time off saved. Existing lessons have not been changed.') }}>Save time off</Button></ModalFooter></>}</Modal>
  </DenseSectionPanel>
}