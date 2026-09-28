'use client'

import type { CSSProperties, ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { colors, radius, spacing, typography } from '@/lib/tokens'

export type NoticeVariant = 'info' | 'warning' | 'success' | 'error'

interface NoticeProps {
  children: ReactNode
  variant?: NoticeVariant
  title?: string
  style?: CSSProperties
}

const variantStyles: Record<NoticeVariant, { background: string; border: string; color: string; icon: typeof Info }> = {
  info: { background: '#F2F7FF', border: '#BFDBFE', color: '#1D4ED8', icon: Info },
  warning: { background: '#FEF7E7', border: '#FDE68A', color: colors.warning, icon: TriangleAlert },
  success: { background: '#F3FBF6', border: '#BBF7D0', color: colors.greenDark, icon: CheckCircle2 },
  error: { background: '#FEF2F2', border: '#FECACA', color: colors.error, icon: AlertCircle },
}

export function Notice({ children, variant = 'info', title, style }: NoticeProps) {
  const config = variantStyles[variant]
  const Icon = config.icon
  const role = variant === 'error' ? 'alert' : variant === 'success' ? 'status' : undefined

  return (
    <div
      role={role}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing.sm,
        padding: spacing.md,
        border: `1px solid ${config.border}`,
        borderRadius: radius.lg,
        background: config.background,
        color: colors.text,
        fontFamily: typography.fontSans,
        fontSize: typography.sizeSm,
        lineHeight: 1.5,
        ...style,
      }}
    >
      <Icon size={17} color={config.color} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
      <div style={{ minWidth: 0 }}>
        {title && <strong style={{ display: 'block', color: config.color, marginBottom: 2 }}>{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  )
}