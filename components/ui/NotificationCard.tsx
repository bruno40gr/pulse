'use client'

import type { CSSProperties, ReactNode } from 'react'
import { colors, spacing, typography } from '@/lib/tokens'
import { CompactMetaCard } from './CompactMetaCard'

export type NotificationTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface NotificationCardProps {
  label: string
  value: ReactNode
  caption?: ReactNode
  tone?: NotificationTone
  fullWidth?: boolean
  style?: CSSProperties
}

// Tone palettes stay deliberately aligned with Badge/CompactMetaCard tokens so a
// notification reads the same wherever it appears (Leads, Funding, Contacts).
const toneStyles: Record<NotificationTone, { border: string; background: string; value: string }> = {
  neutral: { border: colors.border, background: colors.surface, value: colors.text },
  info: { border: colors.teal, background: '#F0FBFD', value: colors.tealDark },
  success: { border: colors.success, background: '#F2F9F5', value: colors.greenDark },
  warning: { border: colors.yellow, background: '#FEF3C7', value: colors.warning },
  danger: { border: colors.error, background: '#FEF2F2', value: colors.error },
}

export function NotificationCard({ label, value, caption, tone = 'neutral', fullWidth = false, style }: NotificationCardProps) {
  const palette = toneStyles[tone]
  const emphasized = tone === 'warning' || tone === 'danger'

  return (
    <CompactMetaCard
      fullWidth={fullWidth}
      align="start"
      style={{
        minHeight: `calc(${typography.sizeLg} + ${spacing['3xl']})`,
        padding: spacing.lg,
        background: palette.background,
        borderColor: palette.border,
        ...style,
      }}
    >
      <div style={{ minWidth: 0, width: '100%' }}>
        <div style={labelStyle}>{label}</div>
        <div style={{ ...valueStyle, color: palette.value, fontWeight: emphasized ? typography.weightBold : typography.weightSemibold }}>{value}</div>
        {caption && <div style={captionStyle}>{caption}</div>}
      </div>
    </CompactMetaCard>
  )
}

const labelStyle: CSSProperties = { color: colors.textMuted, fontFamily: typography.fontSans, fontSize: typography.sizeXs, fontWeight: typography.weightMedium }
const valueStyle: CSSProperties = { fontFamily: typography.fontSans, fontSize: typography.sizeLg, marginTop: spacing.xs, lineHeight: 1.2 }
const captionStyle: CSSProperties = { color: colors.textSecondary, fontFamily: typography.fontSans, fontSize: typography.sizeXs, marginTop: spacing.md, paddingTop: spacing.sm, borderTop: `1px solid ${colors.borderLight}` }