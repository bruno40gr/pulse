'use client'

import { createPortal } from 'react-dom'
import { createContext, useState } from 'react'
import { colors, shadows, typography } from '@/lib/tokens'
import { DialogTitleContext, useDialogLayer } from '@/lib/useDialogLayer'

interface SlidePanelProps {
  isOpen: boolean
  onClose: () => void
  width?: string
  children: React.ReactNode
  overlayOpacity?: number
  fullScreen?: boolean
  ariaLabel?: string
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
}

/** A workspace inside a drawer can expand that same dialog, never create a second one. */
export const SlidePanelWidthContext = createContext<((width: string | undefined) => void) | null>(null)

/** Presentation changes never change the portal or the children's React identity. */
export function SlidePanel({ isOpen, onClose, width = 'min(75vw, 900px)', children, overlayOpacity = 0.3, fullScreen = false, ariaLabel, closeOnBackdrop = true, closeOnEscape = true }: SlidePanelProps) {
  const [workspaceWidth, setWorkspaceWidth] = useState<string>()
  const { mounted, rootRef, dialogRef, titleId, isTop } = useDialogLayer(isOpen, onClose, closeOnEscape)
  if (!isOpen || !mounted) return null

  return createPortal(
    <div ref={rootRef} style={{ position: 'fixed', inset: 0, zIndex: 2000, pointerEvents: 'none', fontFamily: typography.fontSans, color: colors.text }}>
      <div role="presentation" onPointerDown={event => {
        if (event.target === event.currentTarget && closeOnBackdrop && isTop()) onClose()
      }} style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', background: fullScreen ? colors.background : `rgba(0,0,0,${overlayOpacity})` }} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={ariaLabel} aria-labelledby={ariaLabel ? undefined : titleId} tabIndex={-1}
        className={`slide-panel slide-panel--${fullScreen ? 'fullscreen' : 'drawer'}`}
        style={{ position: 'absolute', top: 0, right: 0, width: fullScreen ? '100dvw' : workspaceWidth || width, maxWidth: '100dvw', minWidth: 0, height: '100dvh', maxHeight: '100dvh', boxSizing: 'border-box', pointerEvents: 'auto', background: fullScreen ? colors.background : colors.surface, boxShadow: fullScreen ? undefined : shadows.panel, display: 'flex', flexDirection: 'column', overflow: 'hidden', overscrollBehavior: 'contain', outline: 'none' }}>
        <SlidePanelWidthContext.Provider value={setWorkspaceWidth}><DialogTitleContext.Provider value={titleId}>{children}</DialogTitleContext.Provider></SlidePanelWidthContext.Provider>
      </div>
    </div>, document.body,
  )
}
