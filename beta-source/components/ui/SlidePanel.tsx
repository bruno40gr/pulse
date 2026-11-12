'use client'

import { createPortal } from 'react-dom'
import { useLayoutEffect, useState, useRef, useEffect } from 'react'
import { colors, shadows, typography } from '@/beta-source/lib/tokens'
import { DialogTitleContext, useDialogLayer } from '@/beta-source/lib/useDialogLayer'
import styles from './SlidePanel.module.css'
import { SlidePanelCloseContext } from './SlidePanelCloseContext'

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

/** Presentation changes never change the portal or the children's React identity. */
export function SlidePanel({ isOpen, onClose, width = 'min(75vw, 900px)', children, overlayOpacity = 0.3, fullScreen = false, ariaLabel, closeOnBackdrop = true, closeOnEscape = true }: SlidePanelProps) {
  const [closing, setClosing] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const requestClose = () => {
    if (closing) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { close.current(); return }
    setClosing(true)
    timer.current = setTimeout(() => { timer.current = null; setClosing(false); close.current() }, 220)
  }
  const { mounted, rootRef, dialogRef, titleId, isTop } = useDialogLayer(isOpen, requestClose, closeOnEscape)
  useLayoutEffect(() => {
    // A focused overflow-menu item can scroll the clipped shell. Reusing that
    // shell at a new width must not carry its horizontal offset into the header.
    const dialog = dialogRef.current
    if (dialog) dialog.scrollLeft = 0
  }, [fullScreen, mounted, dialogRef])
  if (!isOpen || !mounted) return null

  return createPortal(
    <div ref={rootRef} style={{ position: 'fixed', inset: 0, zIndex: 2000, pointerEvents: 'none', fontFamily: typography.fontSans, color: colors.text }}>
      <div role="presentation" onPointerDown={event => {
        if (event.target === event.currentTarget && closeOnBackdrop && isTop()) requestClose()
      }} className={closing ? styles.backdropExit : styles.backdropEnter} style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', background: fullScreen ? colors.background : `rgba(0,0,0,${overlayOpacity})` }} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={ariaLabel} aria-labelledby={ariaLabel ? undefined : titleId} tabIndex={-1}
        className={`slide-panel slide-panel--${fullScreen ? 'fullscreen' : 'drawer'} ${styles.panel} ${closing ? styles.exit : styles.enter}`}
        style={{ position: 'absolute', top: 0, right: 0, width: fullScreen ? '100%' : width, maxWidth: '100%', minWidth: 0, height: '100%', maxHeight: '100%', boxSizing: 'border-box', pointerEvents: 'auto', background: fullScreen ? colors.background : colors.surface, boxShadow: fullScreen ? undefined : shadows.panel, display: 'flex', flexDirection: 'column', overflow: 'clip', overscrollBehavior: 'contain', outline: 'none' }}>
        <DialogTitleContext.Provider value={titleId}><SlidePanelCloseContext.Provider value={requestClose}>{children}</SlidePanelCloseContext.Provider></DialogTitleContext.Provider>
      </div>
    </div>, document.body,
  )
}
