import { typography, radius, spacing } from '@/lib/tokens'

interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'inactive' | 'member' | 'minor' | 'risk' | 'opportunity' | 'milestone' | 'nudge'
  size?: 'sm' | 'md'
  children: React.ReactNode
  style?: React.CSSProperties
}

// Filled pill variants — identical shape, no borders, consistent across all types.
const variantStyles: Record<string, React.CSSProperties> = {
  success: { background: '#F0FDF4', color: '#16A34A' },
  warning: { background: '#FFFBEB', color: '#D97706' },
  error: { background: '#FEF2F2', color: '#DC2626' },
  info: { background: '#EEF2FF', color: '#4F46E5' },
  neutral: { background: '#F3F4F6', color: '#9CA3AF' },
  inactive: { background: '#F3F4F6', color: '#9CA3AF' },
  member: { background: '#EEF2FF', color: '#4F46E5' },
  minor: { background: '#FFFBEB', color: '#D97706' },
  risk: { background: '#FEF2F2', color: '#DC2626' },
  opportunity: { background: '#EEF2FF', color: '#4F46E5' },
  milestone: { background: '#F0FDF4', color: '#16A34A' },
  nudge: { background: '#FFFBEB', color: '#D97706' },
}

const sizeStyles: Record<'sm' | 'md', React.CSSProperties> = {
  sm: {
    fontSize: '12px',
    padding: '2px 8px',
  },
  md: {
    fontSize: '14px',
    padding: `3px 12px`,
  },
}

export function Badge({ variant = 'neutral', size = 'md', children, style }: BadgeProps) {
  return (
    <span style={{
      ...variantStyles[variant],
      ...sizeStyles[size],
      fontWeight: typography.weightMedium,
      borderRadius: radius.full,
      fontFamily: typography.fontSans,
      display: 'inline-block',
      ...style,
    }}>
      {children}
    </span>
  )
}