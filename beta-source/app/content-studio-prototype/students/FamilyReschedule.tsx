'use client'

import { useState } from 'react'
import { Button, DenseSectionPanel } from '@/beta-source/components/ui'
import { formatScheduleDate, formatScheduleTime } from '@/beta-source/lib/academy-enrollment-schedule'
import { makeupSlots, type MakeupPreviewState } from '@/beta-source/lib/academy-makeup-preview'
import type { FamilyPreviewData } from '@/beta-source/lib/academy-family-preview'
import { projectFamilyMoves, type FamilyMoves } from '@/beta-source/lib/family-reschedule'
import { MoveLesson } from './MoveLesson'
import { ControlButton } from '@/beta-source/components/ui/ControlButton'
import { colors, spacing, typography } from '@/beta-source/lib/tokens'
import { ConfirmActionButton } from './ConfirmActionButton'
import type { ScheduledClassItem } from './ScheduledClass'

export function FamilyReschedule({ items, data, state, accountName, week, onWeek, onBack, onConfirm }: {
  items: ScheduledClassItem[]; data: FamilyPreviewData; state: MakeupPreviewState; accountName: string; week: string
  onWeek: (week: string) => void; onBack: () => void; onConfirm: (moves: FamilyMoves) => string | null
}) {
  const [activeId, setActiveId] = useState(items[0]?.id)
  const [moves, setMoves] = useState<FamilyMoves>({})
  const [error, setError] = useState('')
  const active = items.find(item => item.id === activeId)
  if (!active) return null
  const count = Object.keys(moves).length
  const otherMoves = Object.fromEntries(Object.entries(moves).filter(([id]) => id !== activeId))
  const availability = projectFamilyMoves(data, state, otherMoves)
  const slotData = { ...availability.data, lessons: availability.data.lessons.filter(item => item.id !== activeId) }
  const slotState = { ...availability.state, items: availability.state.items.filter(item => item.id !== activeId) }
  function back() { if (!count || window.confirm('Discard the proposed lesson changes?')) onBack() }
  function undo(id: string) { setMoves(current => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id))); setError('') }
  return <section aria-label="Reschedule together" style={{ display: 'grid', gap: 16, minWidth: 0 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}><Button variant="secondary" onClick={back}>Back to schedule</Button><strong>Reschedule together · {items.length} selected</strong></div>
    <MoveLesson key={activeId} item={active} data={availability.data} state={availability.state} accountName={accountName} initialDate={week} onWeek={onWeek} onBack={back} rightControls={<div style={{ display: 'grid', gap: spacing.md }}>    <div role="group" aria-label="Lessons to reschedule" style={{ display: 'grid', gap: spacing.sm }}>
      {items.map(item => { const proposed = moves[item.id]; return <DenseSectionPanel key={item.id} style={{ borderColor: activeId === item.id ? colors.link : colors.border, background: activeId === item.id ? colors.surfaceMuted : colors.surface, boxShadow: activeId === item.id ? `inset 0 0 0 1px ${colors.link}` : undefined, padding: spacing.md, gap: spacing.sm }} title={<ControlButton kind="row" aria-pressed={activeId === item.id} onClick={() => setActiveId(item.id)} aria-label={`Plan ${item.student.firstName} ${item.program}`} style={{ width: '100%', justifyContent: 'flex-start', padding: 0, textAlign: 'left', fontWeight: typography.weightSemibold }}>{item.student.firstName} · {item.program}</ControlButton>}>
        <p>Original: {formatScheduleDate(item.date)} · {formatScheduleTime(item.time)} · {item.teacher}</p>
        <p>{proposed ? `Proposed: ${formatScheduleDate(proposed.date)} · ${formatScheduleTime(proposed.time)} · ${proposed.teacher}` : 'Unchanged'}</p>
        {proposed && <Button variant="ghost" onClick={() => undo(item.id)} aria-label={`Undo ${item.student.firstName} change`}>Undo change</Button>}
      </DenseSectionPanel> })}
    </div>
    <ConfirmActionButton disabled={!count} loadingLabel="Rescheduling lessons" onClick={() => setError(onConfirm(moves) || '')}>Confirm {count} {count === 1 ? 'change' : 'changes'}</ConfirmActionButton>
{error && <p role="alert">{error}</p>}</div>} draftBooking={moves[activeId] || null} onDraftChange={booking => {
      if (!booking || (booking.date === active.date && booking.time === active.time && booking.teacher === active.teacher)) { undo(activeId); return }
      setMoves(current => ({ ...current, [activeId]: booking })); setError('')
    }} availableSlots={date => makeupSlots(slotData, slotState, { id: active.id, lessonId: active.id, studentId: active.student.id, enrollmentId: active.enrollmentId, date: active.date, duration: active.duration, program: active.program, teacher: active.teacher, service: active.enrollment.service }, date, active.program, false)} onMove={() => null} />
  </section>
}