'use client'

import { Button, FieldGrid, Input, Select } from '@/beta-source/components/ui'
import { addBillingDays, monthCoverage, validateBillingRanges, type BillingRange } from '@/beta-source/lib/academy-billing'
import { spacing } from '@/beta-source/lib/tokens'

export type CoverageInput = { start: string; duration: string; end: string; periods: { start: string; end: string }[] }
export function coverageInput(start: string): CoverageInput { return { start, duration: '1', end: start + '-01', periods: [] } }
export function resolveCoverage(value: CoverageInput): BillingRange[] {
  if (value.duration === 'custom') return validateBillingRanges([{ start: value.start, end: addBillingDays(value.end, 1) }])
  if (value.duration === 'separate') return validateBillingRanges(value.periods.map(range => ({ start: range.start, end: addBillingDays(range.end, 1) })))
  return [monthCoverage(value.start.slice(0, 7), Number(value.duration))]
}
export function BillingCoverage({ value, onChange, label = 'Coverage' }: { value: CoverageInput; onChange: (value: CoverageInput) => void; label?: string }) {
  const update = (patch: Partial<CoverageInput>) => onChange({ ...value, ...patch })
  return <div style={{ display: 'grid', gap: spacing.md }}>
    <FieldGrid>
      <Input label={`${label} starts`} type={value.duration === 'custom' ? 'date' : 'month'} value={value.duration === 'custom' ? value.start : value.start.slice(0, 7)} onChange={event => update({ start: event.target.value })} />
      <Select label={`${label} duration`} value={value.duration} onChange={event => { const duration = event.target.value; update({ duration, start: duration === 'custom' ? `${value.start.slice(0, 7)}-01` : value.start.slice(0, 7), end: value.end || `${value.start.slice(0, 7)}-01`, periods: duration === 'separate' && !value.periods.length ? [{ start: `${value.start.slice(0, 7)}-01`, end: `${value.start.slice(0, 7)}-01` }] : value.periods }) }}>
        {[1, 3, 6, 12].map(months => <option key={months} value={months}>{months} {months === 1 ? 'month' : 'months'}</option>)}<option value="custom">Custom dates</option><option value="separate">Nonconsecutive periods</option>
      </Select>
    </FieldGrid>
    {value.duration === 'custom' && <Input label={`${label} ends`} type="date" min={value.start} value={value.end} onChange={event => update({ end: event.target.value })} />}
    {value.duration === 'separate' && <div style={{ display: 'grid', gap: spacing.md }}>{value.periods.map((range, index) => <div key={index} style={{ display: 'grid', gap: spacing.sm }}><FieldGrid><Input label={`${label} period ${index + 1} starts`} type="date" value={range.start} onChange={event => update({ periods: value.periods.map((item, position) => position === index ? { ...item, start: event.target.value } : item) })} /><Input label={`${label} period ${index + 1} ends`} type="date" value={range.end} min={range.start} onChange={event => update({ periods: value.periods.map((item, position) => position === index ? { ...item, end: event.target.value } : item) })} /></FieldGrid><Button type="button" variant="ghost" onClick={() => update({ periods: value.periods.filter((_, position) => position !== index) })}>Remove period {index + 1}</Button></div>)}<Button type="button" variant="secondary" onClick={() => update({ periods: [...value.periods, { start: `${value.start.slice(0, 7)}-01`, end: `${value.start.slice(0, 7)}-01` }] })}>Add period</Button></div>}
  </div>
}