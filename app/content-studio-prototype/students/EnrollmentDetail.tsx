'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'
import type { PreviewEnrollment, PreviewStudent } from '@/lib/academy-student-preview'
import { formatScheduleTime } from '@/lib/academy-enrollment-schedule'
import { colors, spacing, typography } from '@/lib/tokens'
import type { WorkspaceSectionProps } from './WorkspaceSections'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { previewCalendarLessons } from '@/lib/academy-makeup-preview'
import { ScheduledClass } from './ScheduledClass'
import styles from './LessonCards.module.css'

export function EnrollmentDetail(props: WorkspaceSectionProps & { owner: PreviewStudent; enrollment: PreviewEnrollment }) {
  const { owner, enrollment, location, onLesson, onMove } = props
  const [offset, setOffset] = useState(0)
  const timeline = previewCalendarLessons(props.data, props.makeups, { ...location, studentId: owner.id, enrollmentId: enrollment.id, teacher: '' })
  const start = Math.min(offset, Math.max(0, timeline.length - 3))
  return <article style={{ borderBottom: `1px solid ${colors.borderLight}`, paddingBottom: spacing.lg }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: spacing.sm }}>
      <div><SectionTitle as="h3" variant="card">{location.studentId ? enrollment.program : `${owner.firstName} · ${enrollment.program}`}</SectionTitle>
        <div style={{ ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs }}>{enrollment.service} · {enrollment.duration} min · {enrollment.day} at {formatScheduleTime(enrollment.time)} · {enrollment.teacher}</div>
      </div>
    </div>
    <div className={styles.timeline} role="region" aria-label={`${owner.firstName} ${enrollment.program} lesson timeline`} tabIndex={0} style={{ gap: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm }}>
      {timeline.slice(start, start + 3).map((item, index) => <ScheduledClass key={item.id} item={item} next={start === 0 && index === 0} onCancel={onLesson} onMove={onMove} />)}
      {!timeline.length && <span style={typography.bodySmall}>No lessons</span>}
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.sm }}>
      <span style={{ ...typography.bodySmall, color: colors.textSecondary }}>{timeline.length ? `Classes ${start + 1}–${Math.min(start + 3, timeline.length)}` : ''}</span>
      <Button variant="secondary" size="sm" aria-label={`Previous ${enrollment.program} classes`} disabled={start === 0} onClick={() => setOffset(Math.max(0, start - 3))}>Previous</Button>
      <Button variant="secondary" size="sm" aria-label={`Next ${enrollment.program} classes`} disabled={start + 3 >= timeline.length} onClick={() => setOffset(start + 3)}>Next</Button>
    </div>
  </article>
}
