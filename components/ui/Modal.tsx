'use client'


import { BackControl } from './BackControl'
import { ControlButton } from '@/components/ui/ControlButton'
import { useContext, useId, type CSSProperties, type ReactNode } from 'react'
import { DialogTitleContext, useDialogLayer } from '@/lib/useDialogLayer'
import { createPortal } from 'react-dom'
import { colors, radius, shadows, spacing, typography } from '@/lib/tokens'

export type ModalSize = 'sm' | 'md' | 'lg' | 'wide' | 'notifications'

interface ModalProps {
  isOpen: boolean
  onClose?: () => void
  size?: ModalSize
  children: ReactNode
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  ariaLabel?: string
  style?: CSSProperties
}

interface ModalHeaderProps {
  title: string
  onBack?: () => void
  backLabel?: string
  description?: ReactNode
  onClose?: () => void
  icon?: ReactNode
  badge?: ReactNode
}

const widths: Record<ModalSize, string> = {
  sm: '440px',
  notifications: '616px',
  md: '560px',
  lg: '720px',
  wide: '1120px',
}

export function Modal({ isOpen, onClose, size = 'md', children, closeOnBackdrop = true, closeOnEscape = true, ariaLabel, style }: ModalProps) {
  const { mounted, rootRef, dialogRef, titleId, isTop } = useDialogLayer(isOpen, onClose, closeOnEscape)

  if (!isOpen || !mounted) return null

  return createPortal(
    <div
      ref={rootRef}
      role="presentation"
      style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: spacing.lg, background: 'rgba(20, 30, 34, 0.48)', backdropFilter: 'blur(2px)', animation: 'fadeIn 0.16s ease-out' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && closeOnBackdrop && onClose && isTop()) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : titleId}
        tabIndex={-1}
        style={{ width: `min(100%, ${widths[size]})`, maxHeight: 'min(90dvh, 900px)', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: radius['2xl'], background: colors.surface, border: `1px solid ${colors.border}`, boxShadow: shadows.xl, fontFamily: typography.fontSans, outline: 'none', ...style }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <DialogTitleContext.Provider value={titleId}>{children}</DialogTitleContext.Provider>
      </div>
    </div>,
    document.body,
  )
}

export function ModalHeader({ title, description, onClose, icon, badge, onBack, backLabel = 'Back' }: ModalHeaderProps) {
  const ownId = useId()
  const titleId = useContext(DialogTitleContext) || ownId
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.lg, padding: `${spacing.xl} ${spacing['2xl']}`, borderBottom: `1px solid ${colors.borderLight}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, minWidth: 0 }}>
        {onBack && <BackControl label={backLabel} onClick={onBack} />}
        {icon && <div style={{ display: 'flex', color: colors.textSecondary, flexShrink: 0, marginTop: 2 }}>{icon}</div>}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
            <h2 id={titleId} style={{ ...typography.h2, margin: 0, color: colors.text, overflowWrap: 'anywhere' }}>{title}</h2>
            {badge}
          </div>
          {description && <div style={{ ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs }}>{description}</div>}
        </div>
      </div>
      {onClose && (
        <ControlButton kind="close" type="button" onClick={onClose} aria-label="Close" />
      )}
    </div>
  )
}

export function ModalBody({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: spacing['2xl'], ...style }}>{children}</div>
}

export function ModalFooter({ children, leading, style }: { children: ReactNode; leading?: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap', padding: `${spacing.lg} ${spacing['2xl']}`, borderTop: `1px solid ${colors.borderLight}`, background: colors.surface, flexShrink: 0, ...style }}>
      {leading && <div style={{ marginRight: 'auto', minWidth: 0 }}>{leading}</div>}
      {children}
    </div>
  )
}