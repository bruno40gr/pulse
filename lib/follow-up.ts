import { colors } from '@/lib/tokens'

export type FollowUpUrgency = 'none' | 'future' | 'today' | 'overdue'

export interface FollowUpTone {
  urgency: FollowUpUrgency
  label: string
  color: string
  background: string
  borderColor: string
}

export function getFollowUpTone(value: string | null | undefined, now = new Date()): FollowUpTone {
  if (!value) {
    return {
      urgency: 'none',
      label: '',
      color: colors.textSecondary,
      background: colors.surface,
      borderColor: colors.border,
    }
  }

  const dueDate = new Date(value)
  if (Number.isNaN(dueDate.getTime())) {
    return {
      urgency: 'none',
      label: '',
      color: colors.textSecondary,
      background: colors.surface,
      borderColor: colors.border,
    }
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime()

  if (startOfDueDate < startOfToday) {
    return {
      urgency: 'overdue',
      label: 'Overdue',
      color: colors.error,
      background: '#FEF2F2',
      borderColor: colors.error,
    }
  }

  if (startOfDueDate === startOfToday) {
    return {
      urgency: 'today',
      label: 'Due today',
      color: colors.warning,
      background: '#FEF3C7',
      borderColor: '#D97706',
    }
  }

  return {
    urgency: 'future',
    label: '',
    color: colors.textSecondary,
    background: colors.surface,
    borderColor: colors.border,
  }
}
