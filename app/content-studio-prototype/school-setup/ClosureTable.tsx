'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { Checkbox } from '@/components/ui/Checkbox'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { ControlButton } from '@/components/ui/ControlButton'
import { Trash2 } from 'lucide-react'
import { spacing } from '@/lib/tokens'
import type { SetupRecord } from './setup-content'

type Closure = { id: string; name: string; start: string; end: string; location: string }
const iso = (date: Date) => date.toISOString().slice(0, 10)
// Opt-in US federal presets, not a school's mandatory holiday calendar.
export function holidayPresets(year: number) {
  const nth = (month: number, day: number, count: number) => 1 + (day - new Date(Date.UTC(year, month, 1)).getUTCDay() + 7) % 7 + (count - 1) * 7
  const fixed = (month: number, day: number) => new Date(Date.UTC(year, month, day))
  const memorial = fixed(5, 0); memorial.setUTCDate(memorial.getUTCDate() - (memorial.getUTCDay() + 6) % 7)
  return [
    ["New Year's Day", fixed(0, 1)], ['Martin Luther King Jr. Day', fixed(0, nth(0, 1, 3))], ["Washington's Birthday", fixed(1, nth(1, 1, 3))], ['Memorial Day', memorial], ['Juneteenth', fixed(5, 19)], ['Independence Day', fixed(6, 4)], ['Labor Day', fixed(8, nth(8, 1, 1))], ['Columbus Day', fixed(9, nth(9, 1, 2))], ['Veterans Day', fixed(10, 11)], ['Thanksgiving', fixed(10, nth(10, 4, 4))], ['Christmas Day', fixed(11, 25)],
  ].map(([name, value]) => {
    const actual = value as Date, observed = new Date(actual)
    if (actual.getUTCDay() === 6) observed.setUTCDate(actual.getUTCDate() - 1)
    if (actual.getUTCDay() === 0) observed.setUTCDate(actual.getUTCDate() + 1)
    return { name: String(name), actual: iso(actual), observed: iso(observed) }
  })
}

export default function ClosureTable({ values, locations, onChange }: { values: Record<string, string>; locations: SetupRecord[]; onChange: (value: string) => void }) {
  let rows: Closure[] = []
  try { rows = values.closures ? JSON.parse(values.closures) : values.closure ? [{ id: 'legacy', name: values.closure, start: values.start, end: values.end, location: 'all' }] : [] } catch { /* Empty legacy configuration. */ }
  const [year, setYear] = useState('2027'), [preset, setPreset] = useState('0'), [location, setLocation] = useState('all'), [observed, setObserved] = useState(true)
  const write = (next: Closure[]) => onChange(JSON.stringify(next.map(({ id, name, start, end, location }) => ({ id, name, start, end, location }))))
  const add = (name = '', date = '') => write([...rows, { id: crypto.randomUUID(), name, start: date, end: date, location }])
  const update = (id: string, key: keyof Closure, value: string) => write(rows.map(row => row.id === id ? { ...row, [key]: value } : row))
  return <section aria-label="School closures" style={{ display: 'grid', gap: spacing.lg }}>
    <SectionTitle>Days off & closures</SectionTitle>
    <FieldGrid><Select label="Holiday year" value={year} onChange={event => setYear(event.target.value)}>{['2026', '2027', '2028'].map(value => <option key={value}>{value}</option>)}</Select><Select label="US federal holiday" value={preset} onChange={event => setPreset(event.target.value)}>{holidayPresets(Number(year)).map((holiday, index) => <option value={index} key={holiday.name}>{holiday.name}</option>)}</Select></FieldGrid><FieldGrid columns={1}><Select label="Closure location" value={location} onChange={event => setLocation(event.target.value)}><option value="all">All locations</option>{locations.map(item => <option key={item.id} value={item.id}>{item.values.name}</option>)}</Select></FieldGrid>
    <Checkbox label="Use observed dates for weekend holidays" checked={observed} onChange={event => setObserved(event.target.checked)} />
    <p><Button type="button" variant="secondary" onClick={() => { const holiday = holidayPresets(Number(year))[Number(preset)]; add(holiday.name, observed ? holiday.observed : holiday.actual) }}>Add holiday</Button> <Button type="button" variant="secondary" onClick={() => add()}>Add custom closure</Button></p>
    {rows.map((row, index) => <DenseSectionPanel key={row.id} contentStyle={{ display: 'grid', gap: spacing['2xl'] }} title={row.name || `Closure ${index + 1}`} actions={<ControlButton type="button" kind="icon" aria-label={`Remove closure ${index + 1}`} onClick={() => write(rows.filter(item => item.id !== row.id))}><Trash2 size={16} /></ControlButton>}>
      <FieldGrid columns={1}><Input label={`Closure ${index + 1} name`} value={row.name} onChange={event => update(row.id, 'name', event.target.value)} /></FieldGrid>
      <FieldGrid><Input label={`Closure ${index + 1} from`} type="date" value={row.start} onChange={event => update(row.id, 'start', event.target.value)} /><Input label={`Closure ${index + 1} through`} type="date" value={row.end} onChange={event => update(row.id, 'end', event.target.value)} /></FieldGrid>
      <FieldGrid columns={1}><Select label={`Closure ${index + 1} location`} value={row.location} onChange={event => update(row.id, 'location', event.target.value)}><option value="all">All locations</option>{locations.map(item => <option key={item.id} value={item.id}>{item.values.name}</option>)}</Select></FieldGrid>
    </DenseSectionPanel>)}
  </section>
}