'use client'

import { CreditCard } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Button, DenseSectionPanel, DetailField, EmptyState, FieldGrid, FieldValue, SectionTitle, SlidePanel, SlidePanelHeader, StatusBadge } from '@/components/ui'
import { OverflowMenu } from '@/components/ui/OverflowMenu'
import { formatScheduleTime } from '@/lib/academy-enrollment-schedule'
import { previewStudentName } from '@/lib/academy-student-preview'
import { accountPayers } from '@/lib/academy-family-preview'
import { colors, spacing, typography } from '@/lib/tokens'
import { getStaffAvatarUrl } from '@/lib/staff-avatars'
import { getActiveTenantId } from '@/lib/tenant'
import { useIsMobile } from '@/lib/useMediaQuery'
import { PROFILE_PANEL_WIDTH } from '@/lib/conversation-display'
import type { WorkspaceSectionProps } from './WorkspaceSections'
import { ControlButton } from '@/components/ui/ControlButton'

export function AccountSubscriptions({ students, location, onManage, data, account, onNavigate, selectable = false, previewV3, hideHeader = false }: WorkspaceSectionProps & { selectable?: boolean; hideHeader?: boolean }) {
  const [instructor, setInstructor] = useState<string | null>(null)
  const isMobile = useIsMobile()
  const tenantId = getActiveTenantId()
  const subscriptions = students.flatMap(student => student.enrollments.map(enrollment => ({ student, enrollment })))
  const payers = accountPayers(data, account)
  return <>
    <section aria-label="Current subscriptions" style={ { display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
      {students.map(student => <section key={student.id} aria-label={`${previewStudentName(student)} subscriptions`}><DenseSectionPanel title={hideHeader ? undefined : location.studentId ? 'Subscriptions' : previewStudentName(student)} headingLevel="h2" style={hideHeader ? { padding: 0, border: 'none' } : undefined} contentStyle={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }} actions={!hideHeader && location.view !== 'parent' ? <Button size="md" variant={previewV3 ? 'primary' : 'secondary'} onClick={() => onManage({ kind: 'enrollment', studentId: student.id })}>Add subscription</Button> : undefined}>
      {student.enrollments.map(enrollment => {
        const payer = payers.find(item => item.id === enrollment.payerId)
        const last4 = enrollment.paymentMethod.match(/(\d{4})\s*$/)?.[1]
        return <DenseSectionPanel key={enrollment.id} style={{ gap: 0, ...(selectable && location.enrollmentId === enrollment.id ? { borderColor: colors.tealDark } : {}) }} title={<div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: spacing.sm }}><SectionTitle as="h3" variant="card" style={{ marginBottom: 0 }}>{selectable ? <ControlButton kind="toggle" selected={location.enrollmentId === enrollment.id} aria-pressed={location.enrollmentId === enrollment.id} aria-label={`Show ${student.firstName} ${enrollment.program} lessons`} onClick={() => onNavigate({ enrollmentId: location.enrollmentId === enrollment.id ? '' : enrollment.id })}>{enrollment.program} • {enrollment.duration} min</ControlButton> : `${enrollment.program} • ${enrollment.duration} min`}</SectionTitle><StatusBadge status={enrollment.lifecycle || enrollment.status} label={enrollment.lifecycle === 'frozen' ? 'Frozen' : enrollment.lifecycle === 'cancelled' ? 'Cancelled' : enrollment.status === 'active' ? 'Active' : 'Pending'} /></div>} actions={location.view !== 'parent' ? <OverflowMenu label={`${student.firstName} ${enrollment.program} subscription actions`} items={[{ label: 'Manage subscription', onSelect: () => onManage({ kind: 'subscription', enrollmentId: enrollment.id }) }]} /> : undefined}>
        <FieldValue style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
        <SectionTitle as="h4" variant="card" style={{ marginBottom: 0 }}>Level {enrollment.level}</SectionTitle>
        <div>{enrollment.day}s at {formatScheduleTime(enrollment.time).replace(':00', '').replace(' ', '')}</div>
          <a href={`#instructor-${encodeURIComponent(enrollment.teacher)}`} aria-label={`View ${enrollment.teacher} profile`} onClick={event => { event.preventDefault(); setInstructor(enrollment.teacher) }} style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.sm, color: colors.link, minWidth: 0, overflowWrap: 'anywhere' }}>
            <Avatar firstName={enrollment.teacher.split(' ')[0]} lastName={enrollment.teacher.split(' ').slice(1).join(' ')} size={28} src={getStaffAvatarUrl(tenantId, enrollment.teacher)} />
            <span>{enrollment.teacher}</span>
          </a>
        <div style={{ ...typography.bodySmall, color: colors.text, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          {last4 && <span aria-label={/visa/i.test(enrollment.paymentMethod) ? 'Visa card' : 'Credit card'} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 28, flexShrink: 0, border: `1px solid ${colors.border}`, borderRadius: 4, background: colors.surfaceMuted }}>{/visa/i.test(enrollment.paymentMethod) ? <strong style={{ color: '#1a237e', fontSize: 12, fontStyle: 'italic' }}>VISA</strong> : <CreditCard size={22} aria-hidden="true" />}</span>}
          <span>Paid by {payer ? payer.name.split(' ')[0] : 'Unassigned'} {last4 ? `with ***${last4}` : '· No card on file'}</span></div>
        </FieldValue>
      </DenseSectionPanel>
      })}
      {!student.enrollments.length && <EmptyState title="No current subscriptions" />}
      </DenseSectionPanel></section>)}
      {!subscriptions.length && <EmptyState title="No current subscriptions" />}
    </section>
    {instructor && <SlidePanel isOpen onClose={() => setInstructor(null)} width={PROFILE_PANEL_WIDTH} fullScreen={isMobile}>
      <SlidePanelHeader title={instructor} subtitle="Instructor profile · Local preview" avatar={{ firstName: instructor.split(' ')[0], lastName: instructor.split(' ').slice(1).join(' '), src: getStaffAvatarUrl(tenantId, instructor) }} onClose={() => setInstructor(null)} onBack={() => setInstructor(null)} backLabel="Back to account" />
      <div style={{ padding: spacing.lg, overflowY: 'auto' }}>
        <DenseSectionPanel title="Instructor profile"><FieldGrid><DetailField label="Name" value={instructor} /><DetailField label="Programs in this account" value={[...new Set(subscriptions.filter(item => item.enrollment.teacher === instructor).map(item => item.enrollment.program))].join(', ')} /></FieldGrid><p style={{ color: colors.textMuted }}>Fictional preview profile. Contact information and a live staff record are not connected.</p></DenseSectionPanel>
      </div>
    </SlidePanel>}
  </>
}