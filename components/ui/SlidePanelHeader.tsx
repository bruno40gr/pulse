'use client'
import { colors, typography, spacing } from '@/lib/tokens'
import { Avatar } from '@/components/ui/Avatar'

interface SlidePanelHeaderProps {
  title: string
  subtitle?: string
  avatar?: { firstName: string; lastName: string; size?: number; src?: string }
  onClose: () => void
  onBack?: () => void
  backLabel?: string
  actions?: React.ReactNode
  toast?: string
  badge?: React.ReactNode
  titleSize?: string
}

const HEADER_PADDING: React.CSSProperties = {
  padding: '20px 32px',
}

export function SlidePanelHeader({
  title,
  subtitle,
  avatar,
  onClose,
  onBack,
  backLabel = 'Back',
  actions,
  toast,
  badge,
  titleSize,
}: SlidePanelHeaderProps) {
  return (
    <div style={{
      ...HEADER_PADDING,
      borderBottom: `1px solid ${colors.borderLight}`,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      flexShrink: 0,
      minHeight: '72px',
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, minWidth: 0 }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: colors.textSecondary,
              fontSize: typography.sizeSm,
              fontFamily: typography.fontSans,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: 0,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            ← {backLabel}
          </button>
        )}
        {avatar && (
          <Avatar
            firstName={avatar.firstName}
            lastName={avatar.lastName}
            size={avatar.size || 40}
            src={avatar.src}
          />
        )}
        <div style={{ minWidth: 0 }}>
          <h2 style={{
            fontSize: titleSize || typography.sizeXl,
            fontWeight: typography.weightSemibold,
            margin: 0,
            color: colors.text,
            fontFamily: typography.fontSans,
            lineHeight: 1.2,
          }}>
            {title}
          </h2>
          {subtitle && (
            <div style={{
              fontSize: typography.sizeSm,
              color: colors.textSecondary,
              marginTop: '2px',
              fontFamily: typography.fontSans,
            }}>
              {subtitle}
            </div>
          )}
          {badge && (
            <div style={{
              marginTop: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}>
              {badge}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexShrink: 0, paddingTop: '2px' }}>
        {toast && (
          <span style={{ fontSize: typography.sizeSm, color: colors.textMuted, fontFamily: typography.fontSans }}>
            {toast}
          </span>
        )}
        {actions}
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: colors.textSecondary,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}