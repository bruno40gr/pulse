'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { colors, shadows } from '@/lib/tokens'

interface SlidePanelProps {
  isOpen: boolean
  onClose: () => void
  width?: string
  children: React.ReactNode
  overlayOpacity?: number
  fullScreen?: boolean
}

export function SlidePanel({
  isOpen,
  onClose,
  width = 'min(75vw, 900px)',
  children,
  overlayOpacity = 0.3,
  fullScreen = false,
}: SlidePanelProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen || !mounted) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, mounted, onClose])

  if (!isOpen || !mounted) return null

  if (fullScreen) {
    return createPortal(
      <div
        className="slide-panel slide-panel--fullscreen"
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100dvw',
          maxWidth: '100dvw',
          minWidth: 0,
          height: '100dvh',
          maxHeight: '100dvh',
          zIndex: 1000,
          background: colors.background,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          contain: 'layout paint',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>,
      document.body,
    )
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: `rgba(0,0,0,${overlayOpacity})`, zIndex: 40, animation: 'fadeIn 0.2s ease-out' }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100vh',
        width, maxWidth: '100dvw', minWidth: 0, boxSizing: 'border-box', background: colors.surface, zIndex: 50,
        boxShadow: shadows.panel,
        display: 'flex', flexDirection: 'column', overflow: 'hidden', overscrollBehavior: 'contain',
        touchAction: 'pan-y',
        animation: 'slideInRight 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
      }} className="slide-panel slide-panel--drawer" role="dialog" aria-modal="true">
        {children}
      </div>
    </>
  )
}