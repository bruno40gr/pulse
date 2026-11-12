'use client'

import { useState } from 'react'
import { Button, DenseSectionPanel } from '@/beta-source/components/ui'
import { formatScheduleDate, formatScheduleTime, weekStart } from '@/beta-source/lib/academy-enrollment-schedule'
import { makeupSlots, type MakeupPreviewState } from '@/beta-source/lib/academy-makeup-preview'
import type { FamilyPreviewData } from '@/beta-source/lib/academy-family-preview'
import { projectFamilyMoves, type FamilyMoves } from '@/beta-source/lib/family-reschedule'
import { MoveLesson } from './MoveLesson'
import { ControlButton } from '@/beta-source/components/ui/ControlButton'
import { colors, spacing, typography } from '@/beta-source/lib/tokens'
import { ConfirmActionButton } from './ConfirmActionButton'
import type { ScheduledClassItem } from './ScheduledClass'
import { familyBookingReferences } from '@/beta-source/lib/family-booking-calendar'

export function FamilyReschedule({ items, data, state, accountName, week, onWeek, onBack, onConfirm }: {
  items: ScheduledClassItem[]; data: FamilyPreviewData; state: MakeupPreviewState; accountName: string; week: string
  onWeek: (week: string) => void; onBack: () => void; onConfirm: (moves: FamilyMoves) => string | null
}) {
  const [activeId, setActiveId] = useState(items[0]?.id)
  const [focusVersion, setFocusVersion] = useState(0)
  const [moves, setMoves] = useState<FamilyMoves>({})
  const [error, setError] = useState('')
  const active = items.find(item => item.id === activeId)
  if (!active) return null
  const count = Object.keys(moves).length
  const otherMoves = Object.fromEntries(Object.entries(moves).filter(([id]) => id !== activeId))
  const availability = projectFamilyMoves(data, state, otherMoves)
  const references = familyBookingReferences(data, state, active.student.id, active.id)
  const proposals = familyBookingReferences(availability.data, availability.state, active.student.id)
    .filter(item => Object.hasOwn(otherMoves, item.id.slice('family:'.length)))
    .map(item => ({ ...item, id: `proposed:${item.id}`, proposed: true }))
  const slotData = { ...availability.data, lessons: availability.data.lessons.filter(item => item.id !== activeId) }
  const slotState = { ...availability.state, items: availability.state.items.filter(item => item.id !== activeId) }
  function focusLesson(item: ScheduledClassItem) { setActiveId(item.id); setFocusVersion(value => value + 1); onWeek(weekStart(moves[item.id]?.date || item.date)) }
  function back() { if (!count || window.confirm('Discard the proposed lesson changes?')) onBack() }
  function undo(id: string) { setMoves(current => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id))); setError('') }
  return <section aria-label="Reschedule together" style={{ display: 'grid', gap: 16, minWidth: 0 }}>
    <MoveLesson referenceLessons={[...references, ...proposals]} key={`${activeId}:${focusVersion}`} item={active} data={availability.data} state={availability.state} accountName={accountName} initialDate={week} onWeek={onWeek} onBack={back} rightControls={<div style={{ display: 'grid', gap: spacing.md }}>    <div role="group" aria-label="Lessons to reschedule" style={{ display: 'grid', gap: spacing.sm }}>
      {items.map(item => {
        const proposed = moves[item.id]
        const focused = activeId === item.id
        return <DenseSectionPanel key={item.id} style={{ position: 'relative', borderColor: focused ? colors.link : colors.border, background: focused ? colors.surfaceMuted : colors.surface, boxShadow: focused ? `inset 0 0 0 1px ${colors.link}` : undefined, padding: spacing.md, gap: spacing.md }} title={<strong style={{ ...typography.bodySmall, color: colors.text, fontWeight: typography.weightSemibold }}>{item.student.firstName} · {item.program}</strong>} actions={proposed && <Button variant="ghost" size="sm" style={{ position: 'relative', zIndex: 2 }} onClick={() => undo(item.id)} aria-label={`Clear ${item.student.firstName} change`}>Clear</Button>}>
          <ControlButton kind="row" aria-pressed={focused} onClick={() => focusLesson(item)} aria-label={`Plan ${item.student.firstName} ${item.program}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, zIndex: 1 }} />
          <div style={{ display: 'grid', gap: spacing.md, pointerEvents: 'none' }}>
            <div style={{ display: 'grid', gap: spacing.xs }}>
              <span style={{ ...typography.helper, color: colors.textMuted }}>Original</span>
              <strong style={{ ...typography.bodySmall, fontWeight: typography.weightSemibold, color: colors.text }}>{formatScheduleDate(item.date)} · {formatScheduleTime(item.time)}</strong>
              <span style={{ ...typography.bodySmall, color: colors.textSecondary }}>{item.teacher}</span>
            </div>
            <div style={{ display: 'grid', gap: spacing.xs, borderTop: `1px solid ${colors.border}`, paddingTop: spacing.sm }}>
              <span style={{ ...typography.helper, color: colors.textMuted }}>New time</span>
              {proposed ? <><strong style={{ ...typography.bodySmall, fontWeight: typography.weightSemibold, color: colors.link }}>{formatScheduleDate(proposed.date)} · {formatScheduleTime(proposed.time)}</strong><span style={{ ...typography.bodySmall, color: colors.textSecondary }}>{proposed.teacher}</span></> : <span style={{ ...typography.bodySmall, color: colors.textMuted }}>Unchanged</span>}
            </div>
          </div>
        </DenseSectionPanel>
      })}
    </div>
    <ConfirmActionButton disabled={!count} loadingLabel="Rescheduling lessons" onClick={() => setError(onConfirm(moves) || '')}>Confirm {count} {count === 1 ? 'change' : 'changes'}</ConfirmActionButton>
{error && <p role="alert">{error}</p>}</div>} draftBooking={moves[activeId] || null} onDraftChange={booking => {
      if (!booking || (booking.date === active.date && booking.time === active.time && booking.teacher === active.teacher)) { undo(activeId); return }
      setMoves(current => ({ ...current, [activeId]: booking })); setError('')
    }} availableSlots={date => makeupSlots(slotData, slotState, { id: active.id, lessonId: active.id, studentId: active.student.id, enrollmentId: active.enrollmentId, date: active.date, duration: active.duration, program: active.program, teacher: active.teacher, service: active.enrollment.service }, date, active.program, false)} onMove={() => null} />
  </section>
}