'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Notice } from '@/components/ui/Notice'
import { CalendarTimeGrid } from '../enrollment/CalendarTimeGrid'
import { shiftDate, formatScheduleDate } from '@/beta-source/lib/academy-enrollment-schedule'
import { availabilityError, type AvailabilityBlock, type ProgramTask } from '@/beta-source/lib/academy-program-proposals'
import styles from './explorer.module.css'

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
const time = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
/** Uses the teacher scheduler's shared calendar surface, without teacher-only controls. */
export default function ProgramAvailability({ task, onSubmit }: { task: ProgramTask; onSubmit: (blocks: AvailabilityBlock[]) => void }) {
  const [blocks, setBlocks] = useState(task.blocks)
  const [edit, setEdit] = useState<AvailabilityBlock | null>(null)
  const [error, setError] = useState('')
  const dates = Array.from({ length: 7 }, (_, index) => shiftDate(task.week, index))
  const add = (date = task.week, from = '16:00') => setEdit({ id: crypto.randomUUID(), date, from, to: time(Math.min(1320, minutes(from) + 60)) })
  return <div className={styles.stack}>
    <p>Week of {formatScheduleDate(task.week)}. Add times when this student can attend.{task.proposalId.startsWith('band:') ? '' : ' This response belongs only to this proposal.'}</p>
    {error && <Notice variant="error">{error}</Notice>}
    <div className={styles.inlineActions}><Button variant="secondary" onClick={() => add()}>Add available time</Button><Button onClick={() => { const problem = availabilityError(blocks, task.week); if (problem) { setError(problem); return } try { onSubmit(blocks); setError('') } catch (cause) { setError((cause as Error).message) } }}>Submit availability</Button></div>
    <CalendarTimeGrid dates={dates} times={Array.from({ length: 32 }, (_, index) => time(360 + index * 30))} label="Student availability calendar" renderDay={date => <div className={styles.availabilityDay} onDoubleClick={event => { const rect = event.currentTarget.getBoundingClientRect(); add(date, time(Math.min(1260, 360 + Math.floor((event.clientY - rect.top) / rect.height * 32) * 30))) }}>
      {Array.from({ length: 32 }, (_, index) => <button type="button" key={index} className={styles.availabilitySlot} aria-label={`Add availability ${date} ${time(360 + index * 30)}`} onClick={() => add(date, time(360 + index * 30))} />)}
      {blocks.filter(block => block.date === date).map(block => <button type="button" key={block.id} className={styles.availabilityBlock} style={{ top: `${(minutes(block.from) - 360) / 960 * 100}%`, height: `${(minutes(block.to) - minutes(block.from)) / 960 * 100}%` }} onClick={() => setEdit(block)}>{block.from}–{block.to}</button>)}
    </div>} />
    {blocks.map(block => <div className={styles.inlineActions} key={block.id}><span>{formatScheduleDate(block.date)} · {block.from}–{block.to}</span><Button variant="ghost" onClick={() => setEdit(block)}>Edit time</Button></div>)}
    <Modal isOpen={!!edit} onClose={() => setEdit(null)} ariaLabel="Available time"><ModalHeader title="Available time" onClose={() => setEdit(null)} />{edit && <><ModalBody><div className={styles.stack}><Input label="Availability date" type="date" min={task.week} max={dates[6]} value={edit.date} onChange={event => setEdit({ ...edit, date: event.target.value })} /><FieldGrid><Input label="Available from" type="time" step={900} value={edit.from} onChange={event => setEdit({ ...edit, from: event.target.value })} /><Input label="Available until" type="time" step={900} value={edit.to} onChange={event => setEdit({ ...edit, to: event.target.value })} /></FieldGrid>{error && <Notice variant="error">{error}</Notice>}</div></ModalBody><ModalFooter leading={blocks.some(block => block.id === edit.id) ? <Button variant="ghost" onClick={() => { setBlocks(blocks.filter(block => block.id !== edit.id)); setEdit(null); setError('') }}>Remove time</Button> : undefined}><Button onClick={() => { const next = [...blocks.filter(block => block.id !== edit.id), edit]; const problem = availabilityError(next, task.week); if (problem) { setError(problem); return } setBlocks(next); setEdit(null); setError('') }}>Save time</Button></ModalFooter></>}</Modal>
  </div>
}