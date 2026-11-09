'use client'

import { ConfirmActionButton } from './ConfirmActionButton'

import { useState } from 'react'
import { Button, DenseSectionPanel, DetailField, FieldGrid, Select } from '@/components/ui'
import { absenceEligible, type AbsenceRecord } from '@/lib/academy-makeup-preview'
import { formatScheduleDate, formatScheduleTime } from '@/lib/academy-enrollment-schedule'
import { spacing, typography } from '@/lib/tokens'
import { SectionHeader, SectionHeading } from './SectionHeader'
import type { WorkspaceOccurrence } from './WorkspaceSections'

export function LessonPreview({ lesson, parent, absence, onCancel, onSchedule, onBack }: { onBack: () => void; lesson: WorkspaceOccurrence; parent: boolean; absence?: AbsenceRecord; onCancel: (grantLate: boolean) => string | null; onSchedule: (id: string) => void }) {
  const [grantLate, setGrantLate] = useState(false)
  const [error, setError] = useState('')
  const eligible = absenceEligible(lesson.date, lesson.time)
  return <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
    <SectionHeader onBack={onBack} backLabel="Back to lessons"><SectionHeading>Cancel lesson</SectionHeading></SectionHeader>
    <DenseSectionPanel title="Lesson" actions={!absence && lesson.status === 'Scheduled' ? <ConfirmActionButton variant="destructive" onClick={() => setError(onCancel(grantLate) || '')}>Cancel lesson</ConfirmActionButton> : undefined}>
      {!absence && <p style={{ ...typography.body, marginTop: 0 }}>{eligible || grantLate ? 'Cancelling returns a makeup credit.' : 'Cancelling this lesson will forfeit the makeup credit because it is less than 24 hours away.'}</p>}
      <FieldGrid>
      <DetailField label="Date" value={formatScheduleDate(lesson.date, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} />
      <DetailField label="Time" value={`${formatScheduleTime(lesson.time)} · ${lesson.enrollment.duration} min`} />
      <DetailField label="Teacher for this lesson" value={lesson.teacher} /><DetailField label="Room" value={lesson.room} />
      <DetailField label="Status" value={lesson.status} /><DetailField label="Makeup" value={absence ? absence.makeupId ? 'Added' : 'Not granted' : eligible || grantLate ? 'Eligible' : 'Under 24 hours'} />
    </FieldGrid>{!parent && !eligible && !absence && <div style={{ marginTop: spacing.lg }}><Select label="Makeup exception" value={grantLate ? 'grant' : 'none'} onChange={event => setGrantLate(event.target.value === 'grant')}><option value="none">No exception</option><option value="grant">Grant makeup</option></Select></div>}</DenseSectionPanel>
    {absence && <DenseSectionPanel title="Lesson cancelled" actions={absence.makeupId ? <Button onClick={() => onSchedule(absence.makeupId!)}>Schedule makeup</Button> : undefined}><DetailField label="Makeup" value={absence.makeupId ? 'Available' : 'Not granted'} /></DenseSectionPanel>}
    {error && <div role="alert" style={typography.bodySmall}>{error}</div>}
  </div>
}