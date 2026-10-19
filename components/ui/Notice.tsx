'use client'

import type { CSSProperties, ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { colors, radius, spacing, typography } from '@/lib/tokens'
import { ControlButton } from './ControlButton'

export type NoticeVariant = 'info' | 'warning' | 'success' | 'error'

interface NoticeProps {
  children: ReactNode
  variant?: NoticeVariant
  title?: string
  style?: CSSProperties
  onDismiss?: () => void
  dismissLabel?: string
}

const variantStyles: Record<NoticeVariant, { background: string; border: string; color: string; icon: typeof Info }> = {
  info: { background: '#F2F7FF', border: '#BFDBFE', color: '#1D4ED8', icon: Info },
  warning: { background: '#FEF7E7', border: '#FDE68A', color: colors.warning, icon: TriangleAlert },
  success: { background: '#F3FBF6', border: '#BBF7D0', color: colors.greenDark, icon: CheckCircle2 },
  error: { background: '#FEF2F2', border: '#FECACA', color: colors.error, icon: AlertCircle },
}

export function Notice({ children, variant = 'info', title, style, onDismiss, dismissLabel = 'Dismiss notification' }: NoticeProps) {
  const config = variantStyles[variant]
  const Icon = config.icon
  const role = variant === 'error' || variant === 'warning' ? 'alert' : variant === 'success' ? 'status' : undefined

  return (
    <div
      role={role}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
        padding: `${spacing.md} ${spacing.lg}`,
        boxSizing: 'border-box',
        minWidth: 0,
        border: `1px solid ${config.border}`,
        borderRadius: radius.lg,
        background: config.background,
        color: colors.text,
        fontFamily: typography.fontSans,
        fontSize: typography.sizeBase,
        lineHeight: 1.5,
        overflowWrap: 'anywhere',
        ...style,
      }}
    >
      <Icon size={20} color={config.color} style={{ flexShrink: 0 }} aria-hidden="true" />
      <div style={{ minWidth: 0, flex: 1 }}>
        {title && <strong style={{ display: 'block', color: config.color, fontSize: typography.sizeMd, marginBottom: spacing.xs }}>{title}</strong>}
        <div>{children}</div>
      </div>
      {onDismiss && <ControlButton kind="close" type="button" aria-label={dismissLabel} onClick={onDismiss} style={{ margin: '-4px -8px -4px 0' }} />}
    </div>
  )
}