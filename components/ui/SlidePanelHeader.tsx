'use client'
import { colors, typography, spacing } from '@/lib/tokens'
import { Avatar } from '@/components/ui/Avatar'
import { useIsMobile } from '@/lib/useMediaQuery'

interface SlidePanelHeaderProps {
  title: string
  titleBadge?: React.ReactNode
  subtitle?: string
  avatar?: { firstName: string; lastName: string; size?: number; src?: string }
  onClose: () => void
  onBack?: () => void
  backLabel?: string
  actions?: React.ReactNode
  toast?: string
  badge?: React.ReactNode
  titleSize?: string
  compact?: boolean
}

export function SlidePanelHeader({
  title,
  titleBadge,
  subtitle,
  avatar,
  onClose,
  onBack,
  backLabel = 'Back',
  actions,
  toast,
  badge,
  titleSize,
  compact,
}: SlidePanelHeaderProps) {
  const detectedMobile = useIsMobile()
  const isMobile = compact ?? detectedMobile

  if (isMobile) {
    return (
      <div style={{
        padding: '10px 16px 12px',
        borderBottom: `1px solid ${colors.borderLight}`,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.sm,
        flexShrink: 0,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        background: colors.surface,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0, minHeight: '28px' }}>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={backLabel}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: colors.textSecondary,
                fontSize: typography.sizeSm,
                fontFamily: typography.fontSans,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 0',
              }}
            >
              ← {backLabel}
            </button>
          ) : <span />}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 }}>
            {toast && <span style={{ fontSize: typography.sizeSm, color: colors.textMuted, fontFamily: typography.fontSans, overflowWrap: 'anywhere' }}>{toast}</span>}
            {actions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'transparent', border: 'none', fontSize: '22px', cursor: 'pointer', color: colors.textSecondary, lineHeight: 1, padding: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0, width: '100%' }}>
          {avatar && <Avatar firstName={avatar.firstName} lastName={avatar.lastName} size={36} src={avatar.src} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
              <h2 style={{ fontSize: typography.sizeLg, fontWeight: typography.weightSemibold, margin: 0, color: colors.text, fontFamily: typography.fontSans, lineHeight: 1.2, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{title}</h2>
              {titleBadge}
            </div>
            {subtitle && <div style={{ fontSize: typography.sizeSm, color: colors.textSecondary, marginTop: '2px', fontFamily: typography.fontSans, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{subtitle}</div>}
            {badge && <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>{badge}</div>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      padding: '20px 32px',
      borderBottom: `1px solid ${colors.borderLight}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      flexShrink: 0,
      minHeight: '72px',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      background: colors.surface,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, minWidth: 0, flex: 1 }}>
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
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
            <h2 style={{
              fontSize: titleSize || typography.sizeXl,
              fontWeight: typography.weightSemibold,
              margin: 0,
              color: colors.text,
              fontFamily: typography.fontSans,
              lineHeight: 1.2,
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}>
              {title}
            </h2>
            {titleBadge}
          </div>
          {subtitle && (
            <div style={{
              fontSize: typography.sizeSm,
              color: colors.textSecondary,
              marginTop: '2px',
              fontFamily: typography.fontSans,
              whiteSpace: 'normal',
              overflowWrap: 'anywhere',
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
          aria-label="Close"
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: colors.textSecondary,
            lineHeight: 1,
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}