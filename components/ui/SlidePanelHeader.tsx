'use client'

import { BackControl } from './BackControl'
import { useContext } from 'react'
import { DialogTitleContext } from '@/lib/useDialogLayer'
import { ControlButton } from '@/components/ui/ControlButton'
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
  const titleId = useContext(DialogTitleContext)
  const detectedMobile = useIsMobile()
  const isMobile = compact ?? detectedMobile

  return (
    <div style={{
      padding: isMobile ? '10px 16px 12px' : '20px 32px',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0, flex: 1 }}>
        {onBack && <BackControl label={backLabel} onClick={onBack} />}
        {avatar && (
          <Avatar
            firstName={avatar.firstName}
            lastName={avatar.lastName}
            size={avatar.size || (isMobile ? 36 : 40)}
            src={avatar.src}
          />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
            <h2 id={titleId} style={{
              fontSize: titleSize || (isMobile ? typography.sizeLg : typography.sizeXl),
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
        <ControlButton kind="close"
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onClose()
          }}
          aria-label="Close"
        />
      </div>
    </div>
  )
}