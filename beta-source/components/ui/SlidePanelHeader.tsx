'use client'

import { BackControl } from './BackControl'
import { useContext } from 'react'
import { DialogTitleContext } from '@/beta-source/lib/useDialogLayer'
import { ControlButton } from '@/beta-source/components/ui/ControlButton'
import { colors, typography, spacing } from '@/beta-source/lib/tokens'
import { ProfileIdentity } from './ProfileIdentity'
import { useIsMobile } from '@/beta-source/lib/useMediaQuery'
import { SlidePanelCloseContext } from './SlidePanelCloseContext'

interface SlidePanelHeaderProps {
  title: string
  profileTransition?: boolean
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
  headingLevel?: 'h1' | 'h2'
}

export function SlidePanelHeader({
  title,
  profileTransition = false,
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
  headingLevel: Heading = 'h2',
}: SlidePanelHeaderProps) {
  const titleId = useContext(DialogTitleContext)
  const requestClose = useContext(SlidePanelCloseContext)
  const detectedMobile = useIsMobile()
  const isMobile = compact ?? detectedMobile

  return (
    <div style={{
      // The 48px Close target needs 2px less per side than the workspace's 44px Back target.
      padding: isMobile ? '10px 16px' : '20px 24px',
      borderBottom: `1px solid ${colors.borderLight}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      flexShrink: 0,
      minHeight: isMobile ? '68px' : '88px',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      background: colors.surface,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0, flex: 1 }}>
        {onBack && <BackControl label={backLabel} onClick={onBack} />}
        <ProfileIdentity title={title} subtitle={subtitle} avatar={avatar ? { ...avatar, size: avatar.size || (isMobile ? 36 : 40) } : undefined} titleSize={titleSize} titleId={titleId} headingLevel={Heading} animate={profileTransition} badge={badge}>
          {titleBadge}
        </ProfileIdentity>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexShrink: 0 }}>
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
            ;(requestClose || onClose)()
          }}
          aria-label="Close"
        />
      </div>
    </div>
  )
}