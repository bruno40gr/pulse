'use client'

import { useState } from 'react'
import { Button, DenseSectionPanel, DetailField, Notice } from '@/components/ui'
import { addBillingDays, billingScheduleWarnings, previewBillingSchedule } from '@/lib/academy-billing'
import { invoiceTotal, quoteFlexibleInvoice, type FamilyAction, type FamilyPreviewData } from '@/lib/academy-family-preview'
import { previewMoney } from '@/lib/academy-student-preview'
import { spacing } from '@/lib/tokens'
import { BillingScheduleEditor } from './BillingScheduleEditor'
import type { BillingSchedule } from '@/lib/academy-billing'

export function BillingArrangements({ data, accountId, onApply }: { data: FamilyPreviewData; accountId: string; onApply: (action: FamilyAction) => string | null }) {
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<{ id: string; schedule: BillingSchedule } | null>(null)
  const arrangements = (data.billingArrangements || []).filter(item => item.accountId === accountId)
  if (!arrangements.length) return null
  return <section aria-label="Billing schedules" style={{ display: 'grid', gap: spacing.lg }}>
    {arrangements.map(arrangement => {
      const rows = previewBillingSchedule(arrangement.schedule, arrangement.subscriptionIds, 120)
      const pending = rows.filter(row => !arrangement.generatedKeys.includes(row.key))
      const next = pending[0]
      let total = '', quoteError = '', conflicts = 0
      if (next) try {
        const quote = quoteFlexibleInvoice(data, { accountId, id: 'schedule-preview', requestKey: 'schedule-preview', payerId: arrangement.payerId, selections: next.selections, date: next.issueDate, due: next.dueDate, proration: arrangement.proration, fullBillingMonths: arrangement.fullBillingMonths })
        total = previewMoney(invoiceTotal(quote.invoice), 'USD'); conflicts = quote.conflicts.length
      } catch (error) { quoteError = error instanceof Error ? error.message : 'Check subscription pricing.' }
      return <DenseSectionPanel key={arrangement.id} title={`Billing schedule · ${arrangement.status}`} actions={<div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>{arrangement.status !== 'cancelled' && <><Button variant="secondary" type="button" onClick={() => setError(onApply({ kind: 'billing-arrangement-state', accountId, id: arrangement.id, status: arrangement.status === 'active' ? 'paused' : 'active' }) || '')}>{arrangement.status === 'active' ? 'Pause schedule' : 'Resume schedule'}</Button><Button variant="ghost" type="button" onClick={() => setError(onApply({ kind: 'billing-arrangement-state', accountId, id: arrangement.id, status: 'cancelled' }) || '')}>Cancel schedule</Button></>}</div>}>
        <div style={{ display: 'grid', gap: spacing.md }}>
          <DetailField label="Cadence" value={`${arrangement.schedule.coverageMonths} months of service · every ${arrangement.schedule.cadenceMonths} months · ${arrangement.schedule.advanceDays} days in advance`} />
          {arrangement.status !== 'cancelled' && <details><summary onClick={() => { if (editing?.id !== arrangement.id) setEditing({ id: arrangement.id, schedule: arrangement.schedule }) }}>Edit future invoices</summary>{editing?.id === arrangement.id && <div style={{ display: 'grid', gap: spacing.md, marginTop: spacing.md }}><BillingScheduleEditor value={editing.schedule} onChange={schedule => setEditing({ id: arrangement.id, schedule })} subscriptionIds={arrangement.subscriptionIds} subscriptionLabels={Object.fromEntries(data.students.flatMap(student => student.enrollments.map(enrollment => [enrollment.id, `${student.firstName} · ${enrollment.program}`])))} /><Button type="button" variant="secondary" onClick={() => { const message = onApply({ kind: 'update-billing-arrangement', accountId, id: arrangement.id, schedule: editing.schedule }); setError(message || ''); if (!message) setEditing(null) }}>Save schedule changes</Button></div>}</details>}
          <Notice>Local simulation · {arrangement.schedule.mode === 'automatic' ? 'Automatic generation is configured but no background job runs.' : 'Manual approval required.'}</Notice>
          <details><summary>Upcoming invoices</summary><div style={{ display: 'grid', gap: spacing.md, marginTop: spacing.md }}>{pending.slice(0, 6).map(row => <DetailField key={row.key} label={`Issue ${row.issueDate} · due ${row.dueDate}`} value={[...new Set(row.selections.flatMap(item => item.ranges.map(range => `${range.start} – ${addBillingDays(range.end, -1)}`)))].join(', ')} />)}{billingScheduleWarnings(rows).map(warning => <Notice key={warning} variant="warning">{warning}</Notice>)}</div></details>
          {next && <DetailField label="Next invoice estimate" value={quoteError || `${total}${conflicts ? ' · existing coverage excluded' : ''}`} />}
          {!next && <Notice>Schedule complete.</Notice>}
          {arrangement.status === 'active' && next && <Button type="button" variant="secondary" onClick={() => setError(onApply({ kind: 'generate-billing-arrangement', accountId, id: arrangement.id, key: next.key }) || '')}>Simulate next invoice</Button>}
        </div>
      </DenseSectionPanel>
    })}
    {error && <Notice variant="error">{error}</Notice>}
  </section>
}