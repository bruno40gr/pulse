import type { CSSProperties } from 'react'
import { Badge } from './Badge'

interface StatusBadgeProps {
  status: string
  label?: string
  size?: 'sm' | 'md'
  style?: CSSProperties
}

const blueStyle: CSSProperties = {
  background: '#EFF6FF',
  color: '#1D4ED8',
  border: '1px solid #2563EB',
}

function getStatusStyle(status: string): CSSProperties | undefined {
  const normalized = status.toLowerCase()

  if (normalized === 'active' || normalized === 'member' || normalized === 'booked') return blueStyle
  if (normalized === 'new') {
    return { background: '#FFF0F4', color: '#FF0044', border: '1px solid #FF0044' }
  }
  if (normalized === 'contacted' || normalized === 'pending') {
    return { background: '#FEF3C7', color: '#92400E', border: '1px solid #D97706' }
  }
  if (normalized === 'processing' || normalized === 'hired' || normalized === 'won') {
    return { background: '#F0FDF4', color: '#15803D', border: '1px solid #16A34A' }
  }
  if (['ghosted', 'ghosted_us', 'lost', 'rejected', 'withdrew', 'spam'].includes(normalized)) {
    return { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #DC2626' }
  }
  return undefined
}

function getStatusVariant(status: string) {
  const normalized = status.toLowerCase()
  if (normalized === 'inactive' || normalized === 'sunset') return 'inactive' as const
  if (normalized === 'lead') return 'info' as const
  return 'neutral' as const
}

export function StatusBadge({ status, label, size = 'sm', style }: StatusBadgeProps) {
  return (
    <Badge size={size} variant={getStatusVariant(status)} style={{ ...getStatusStyle(status), ...style }}>
      {label ?? status}
    </Badge>
  )
}
