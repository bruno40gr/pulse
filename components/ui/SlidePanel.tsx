'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { colors, shadows } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'

interface SlidePanelProps {
  isOpen: boolean
  onClose: () => void
  width?: string
  children: React.ReactNode
  overlayOpacity?: number
  fullScreenOnMobile?: boolean
}

export function SlidePanel({ isOpen, onClose, width = 'min(75vw, 900px)', children, overlayOpacity = 0.3, fullScreenOnMobile = false }: SlidePanelProps) {
  const isMobile = useIsMobile()
  const fullScreen = fullScreenOnMobile && isMobile
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Lock background scroll while a panel is open so the page behind
  // (e.g. a wide leads table) can't move or resize the viewport.
  useEffect(() => {
    if (!isOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [isOpen])

  if (!isOpen || !mounted) return null

  const content = (
    <>
      {!fullScreen && (
        <div
          onClick={onClose}
          className={fullScreenOnMobile ? 'slide-panel-overlay slide-panel-overlay--mobile-hidden' : 'slide-panel-overlay'}
          style={{ position: 'fixed', inset: 0, background: `rgba(0,0,0,${overlayOpacity})`, zIndex: 40, animation: 'fadeIn 0.2s ease-out' }}
        />
      )}
      <div
        className={fullScreenOnMobile ? 'slide-panel slide-panel--mobile-full' : 'slide-panel'}
        style={fullScreen ? {
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: colors.surface,
          boxShadow: 'none',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', overscrollBehavior: 'contain',
          touchAction: 'pan-y',
          animation: 'fadeIn 0.2s ease-out',
          maxWidth: '100vw',
          boxSizing: 'border-box',
        } : {
          position: 'fixed',
          zIndex: 50,
          background: colors.surface,
          boxShadow: shadows.panel,
          display: 'flex', flexDirection: 'column', overflow: 'hidden', overscrollBehavior: 'contain',
          touchAction: 'pan-y',
          animation: 'slideInRight 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
          top: 0, right: 0, height: '100vh', width,
          maxWidth: '100vw',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    </>
  )

  // Portal to document.body so no ancestor (transforms, filters, overflow,
  // flex layouts, wide tables) can become the containing block and resize
  // or offset the fixed panel on small viewports.
  return createPortal(content, document.body)
}