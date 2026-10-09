'use client'


import { ControlButton } from '@/components/ui/ControlButton'
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
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

const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ isOpen, onClose, size = 'md', children, closeOnBackdrop = true, closeOnEscape = true, ariaLabel, style }: ModalProps) {
  const [mounted, setMounted] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!isOpen || !mounted) return
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = dialogRef.current
    const firstFocusable = dialog?.querySelector<HTMLElement>(focusableSelector)
    window.setTimeout(() => (firstFocusable || dialog)?.focus(), 0)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape && onClose) {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      returnFocusRef.current?.focus()
    }
  }, [closeOnEscape, isOpen, mounted, onClose])

  if (!isOpen || !mounted) return null

  return createPortal(
    <div
      role="presentation"
      style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: spacing.lg, background: 'rgba(20, 30, 34, 0.48)', backdropFilter: 'blur(2px)', animation: 'fadeIn 0.16s ease-out' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && closeOnBackdrop && onClose) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        style={{ width: `min(100%, ${widths[size]})`, maxHeight: 'min(90dvh, 900px)', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: radius['2xl'], background: colors.surface, border: `1px solid ${colors.border}`, boxShadow: shadows.xl, fontFamily: typography.fontSans, outline: 'none', ...style }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function ModalHeader({ title, description, onClose, icon, badge }: ModalHeaderProps) {
  const titleId = useId()
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.lg, padding: `${spacing.xl} ${spacing['2xl']}`, borderBottom: `1px solid ${colors.borderLight}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md, minWidth: 0 }}>
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
        <ControlButton kind="toggle" type="button" onClick={onClose} aria-label="Close" style={{ width: 32, flexShrink: 0 }}>
          <X size={19} aria-hidden="true" />
        </ControlButton>
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