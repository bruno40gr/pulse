import { Badge, Button, DenseSectionPanel, FieldValue } from '@/beta-source/components/ui'
import { SectionTitle } from '@/beta-source/components/ui/SectionTitle'
import { Repeat2 } from 'lucide-react'
import { formatScheduleDate, formatScheduleTime } from '@/beta-source/lib/academy-enrollment-schedule'
import { colors, spacing, typography } from '@/beta-source/lib/tokens'
import { LessonStatus } from './LessonStatus'
import { previewCalendarLessons } from '@/beta-source/lib/academy-makeup-preview'

export type ScheduledClassItem = ReturnType<typeof previewCalendarLessons>[number]
export function ScheduledClass({ item, next, showStudent, onCancel, onMove }: { item: ScheduledClassItem; next?: boolean; showStudent?: boolean; onCancel: (id: string) => void; onMove: (id: string) => void }) {
  return <DenseSectionPanel title={<div><SectionTitle as="h4" variant="card">{formatScheduleDate(item.date, { weekday: 'short', month: 'short', day: 'numeric' })}</SectionTitle><div style={{ ...typography.bodySmall, color: colors.textSecondary }}>{next ? 'Next class' : 'Upcoming class'}</div></div>} tone="muted" actions={item.status === 'Scheduled' ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: spacing.xs }}><Button variant="secondary" size="sm" aria-label={`Reschedule ${item.student.firstName} ${item.program} lesson ${item.date}`} onClick={() => onMove(item.id)}>Reschedule lesson</Button><Button variant="secondary" size="sm" aria-label={`Cancel ${item.student.firstName} ${item.program} lesson ${item.date}`} onClick={() => onCancel(item.id)}>Cancel lesson</Button></div> : undefined} style={{ flex: '0 0 300px', width: '100%', maxWidth: 300, minHeight: 224, gap: spacing.sm }} contentStyle={{ display: 'flex', flexDirection: 'column', flex: 1, gap: spacing.sm }}>
    <FieldValue>{formatScheduleTime(item.time)} · {item.duration} min</FieldValue>
    <div style={typography.body}>{showStudent && `${item.student.firstName} · `}{item.program} · {item.enrollment.service}</div>
    <div style={{ ...typography.body, color: colors.textSecondary }}>{item.teacher}</div>
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: 'auto' }}>{item.makeup && <Badge size="sm" variant="neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs }}><Repeat2 size={14} aria-hidden="true" />Makeup lesson</Badge>}<LessonStatus status={item.status} /></div>
  </DenseSectionPanel>
}