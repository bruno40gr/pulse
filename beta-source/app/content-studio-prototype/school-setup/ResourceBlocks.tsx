'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { CalendarFilter } from '../../odeon-demo/CalendarFilters'
import CalendarBookingModal from '../../odeon-demo/CalendarBookingModal'
import { configuredBlocks, roomRecords, saveCalendarBooking, type BookingContext, type CalendarBooking } from '@/beta-source/lib/academy-calendar-booking'
import type { SetupRecord } from './setup-content'
import { spacing } from '@/lib/tokens'

export default function ResourceBlocks({ setup, context, onChange }: { setup: Record<string, SetupRecord[]>; context?: BookingContext; onChange: (records: SetupRecord[]) => void }) {
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const blocks = configuredBlocks(setup)
  const rooms = roomRecords(setup)
  const options = [...setup.teachers.map(teacher => ({ id: teacher.id, name: teacher.values.name })), ...rooms.map(room => ({ id: room.id, name: room.name }))]
  const save = (booking: CalendarBooking) => {
    if (booking.kind !== 'block') return 'Choose Block / unavailable in setup. Create lessons and service bookings from the calendar.'
    if (!context) return 'Open the connected academy demo to create blocks.'
    try { saveCalendarBooking({ ...context, setup }, booking) } catch (error) { return error instanceof Error ? error.message : 'Unable to save block.' }
    onChange([...(setup.resourceBlocks || []), { id: booking.id, values: { name: booking.title, booking: JSON.stringify(booking) } }]); setAdding(false); return null
  }
  return <DenseSectionPanel title="Teacher & room blocks" headingLevel="h2" actions={context ? <Button variant="secondary" onClick={() => setAdding(true)}>Add unavailable time</Button> : undefined} contentStyle={{ display: 'grid', gap: spacing.md }}>
    <p>Hard blocks prevent all bookings. Public-only exclusions keep staff-managed times available. Repeating blocks apply through their end date. Add time off from each teacher’s schedule; use these blocks for rooms or combined resource exclusions.</p>
    <CalendarFilter label="Resources" options={options} value={selected} onChange={setSelected} />
    {blocks.filter(block => !selected.length || selected.includes(block.teacherId) || selected.includes(block.roomId)).map(block => <div key={block.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.md }}><div><strong>{block.title}</strong><div>{block.date} · {block.time} · {block.duration} min{block.repeat === 'weekly' ? ` · weekly through ${block.until}` : ''}</div><div>{setup.teachers.find(teacher => teacher.id === block.teacherId)?.values.name} {rooms.find(room => room.id === block.roomId)?.name} · {block.publicOnly ? 'Public booking exclusion' : 'Hard block'}</div></div><Button variant="ghost" onClick={() => onChange((setup.resourceBlocks || []).filter(record => record.id !== block.id))}>Remove block</Button></div>)}
    {!blocks.length && <p>No additional resource blocks. Teacher availability and time off still apply.</p>}
    {adding && context && <CalendarBookingModal blockOnly initial={{ date: new Date().toLocaleDateString('en-CA'), time: '12:00', duration: 30 }} context={context} onClose={() => setAdding(false)} onSave={save} />}
  </DenseSectionPanel>
}