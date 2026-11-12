'use client'

import { useState } from 'react'
import { Button, DetailField, FieldGrid, Input, Notice, Select } from '@/beta-source/components/ui'
import { addBillingDays, billingScheduleWarnings, previewBillingSchedule, type BillingSchedule } from '@/beta-source/lib/academy-billing'
import { spacing } from '@/beta-source/lib/tokens'
import { BillingCoverage, coverageInput, resolveCoverage } from './BillingCoverage'

export function BillingScheduleEditor({ value, onChange, subscriptionIds, subscriptionLabels = {} }: { value: BillingSchedule; onChange: (value: BillingSchedule) => void; subscriptionIds: string[]; subscriptionLabels?: Record<string, string> }) {
  const [customCoverage, setCustomCoverage] = useState(() => coverageInput(value.start.slice(0, 7)))
  const [customIssue, setCustomIssue] = useState(value.start)
  const [error, setError] = useState('')
  const update = (patch: Partial<BillingSchedule>) => onChange({ ...value, ...patch })
  let rows: ReturnType<typeof previewBillingSchedule> = [], validation = ''
  try { rows = previewBillingSchedule(value, subscriptionIds) } catch (error) { validation = error instanceof Error ? error.message : 'Check schedule.' }
  return <div style={{ display: 'grid', gap: spacing.lg }}>
    <FieldGrid><Input label="Repeating coverage starts" type="month" value={value.start.slice(0, 7)} onChange={event => update({ start: `${event.target.value}-01` })} /><Input label="Months per invoice" type="number" min={1} max={24} value={value.coverageMonths} onChange={event => update({ coverageMonths: Number(event.target.value) })} /></FieldGrid>
    <FieldGrid><Input label="Generate every (months)" type="number" min={1} max={24} value={value.cadenceMonths} onChange={event => update({ cadenceMonths: Number(event.target.value) })} /><Input label="Days before coverage starts" type="number" min={0} max={365} value={value.advanceDays} onChange={event => update({ advanceDays: Number(event.target.value) })} /></FieldGrid>
    <FieldGrid><Input label="Schedule payment terms (days)" type="number" min={0} max={365} value={value.paymentDays} onChange={event => update({ paymentDays: Number(event.target.value) })} /><Select label="Generation" value={value.mode} onChange={event => update({ mode: event.target.value as BillingSchedule['mode'] })}><option value="manual">Manual approval</option><option value="automatic">Automatic · simulated</option></Select></FieldGrid>
    <FieldGrid><Input label="Last service date (optional)" type="date" min={value.start} value={value.end || ''} onChange={event => update({ end: event.target.value || undefined })} /><Input label="Number of invoices (optional)" type="number" min={1} max={120} value={value.occurrences ?? ''} onChange={event => update({ occurrences: event.target.value ? Number(event.target.value) : undefined })} /></FieldGrid>
    <details><summary>Subscription schedule overrides</summary><div style={{ display: 'grid', gap: spacing.md, marginTop: spacing.md }}>{subscriptionIds.map(id => <FieldGrid key={id}><Input label={`${subscriptionLabels[id] || "Subscription"} · start offset (months)`} type="number" min={0} max={24} value={value.overrides?.[id]?.offsetMonths || 0} onChange={event => update({ overrides: { ...value.overrides, [id]: { offsetMonths: Number(event.target.value), coverageMonths: value.overrides?.[id]?.coverageMonths || value.coverageMonths } } })} /><Input label={`${subscriptionLabels[id] || "Subscription"} · coverage months`} type="number" min={1} max={24} value={value.overrides?.[id]?.coverageMonths || value.coverageMonths} onChange={event => update({ overrides: { ...value.overrides, [id]: { offsetMonths: value.overrides?.[id]?.offsetMonths || 0, coverageMonths: Number(event.target.value) } } })} /></FieldGrid>)}</div></details>
    <details><summary>Custom schedule</summary><div style={{ display: 'grid', gap: spacing.md, marginTop: spacing.md }}>
      <Notice>Custom invoices run first. Repeating coverage then starts on the date above.</Notice>
      {value.custom.map((row, index) => <div key={index}><DetailField label={`Custom invoice ${index + 1} · ${row.issueDate}`} value={row.selections[0]?.ranges.map(range => `${range.start} – ${addBillingDays(range.end, -1)}`).join(', ')} /><Button type="button" variant="ghost" onClick={() => update({ custom: value.custom.filter((_, position) => position !== index) })}>Remove custom invoice {index + 1}</Button></div>)}
      <Input label="Custom invoice issue date" type="date" value={customIssue} onChange={event => setCustomIssue(event.target.value)} />
      <BillingCoverage label="Custom invoice coverage" value={customCoverage} onChange={setCustomCoverage} />
      <Button type="button" variant="secondary" onClick={() => { try { const selections = subscriptionIds.map(subscriptionId => ({ subscriptionId, ranges: resolveCoverage(customCoverage) })); if (!selections.length) throw new Error('Choose subscriptions first.'); update({ custom: [...value.custom, { issueDate: customIssue, selections }] }); setError('') } catch (error) { setError(error instanceof Error ? error.message : 'Check custom coverage.') } }}>Add custom invoice</Button>
      {error && <Notice variant="error">{error}</Notice>}
    </div></details>
    <div aria-label="Schedule preview" style={{ display: 'grid', gap: spacing.md }}>
      {rows.map((row, index) => <DetailField key={row.key} label={`Invoice ${index + 1} · issue ${row.issueDate} · due ${row.dueDate}`} value={[...new Set(row.selections.flatMap(item => item.ranges.map(range => `${range.start} – ${addBillingDays(range.end, -1)}`)))].join(', ')} />)}
      {billingScheduleWarnings(rows).map(warning => <Notice key={warning} variant="warning">{warning}</Notice>)}
      {validation && <Notice>{validation}</Notice>}
      {!rows.length && !validation && <Notice>No invoices fit the schedule’s end conditions.</Notice>}
    </div>
  </div>
}