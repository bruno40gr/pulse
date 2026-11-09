import { CalendarCheck, CalendarClock, CalendarSync, CalendarX, CircleMinus } from 'lucide-react'
import { Badge } from '@/components/ui'
import { spacing } from '@/lib/tokens'

export function LessonStatus({ status }: { status: string }) {
  const scheduled = status === 'Scheduled' || status === 'Booked'
  const awaiting = status === 'Awaiting scheduling'
  const rescheduled = status === 'Rescheduled'
  const cancelled = status === 'Cancelled' || status === 'Absent'
  const Icon = scheduled ? CalendarCheck : awaiting ? CalendarClock : rescheduled ? CalendarSync : cancelled ? CalendarX : CircleMinus
  const variant = scheduled ? 'success' : awaiting ? 'warning' : rescheduled ? 'info' : 'neutral'
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: spacing.xs }}>
    <Badge variant={variant} size="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: spacing.xs }}>
      <Icon size={14} aria-hidden="true" />{cancelled ? 'Cancelled' : status}
    </Badge>
  </div>
}