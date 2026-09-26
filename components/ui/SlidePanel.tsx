'use client'
import { useEffect } from 'react'
import { colors, shadows } from '@/lib/tokens'

interface SlidePanelProps {
  isOpen: boolean
  onClose: () => void
  width?: string
  children: React.ReactNode
  overlayOpacity?: number
  fullScreenOnMobile?: boolean
}

export function SlidePanel({ isOpen, onClose, width = 'min(75vw, 900px)', children, overlayOpacity = 0.3, fullScreenOnMobile = false }: SlidePanelProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null
  return (
    <>
      <div
        onClick={onClose}
        className={fullScreenOnMobile ? 'slide-panel-overlay slide-panel-overlay--mobile-hidden' : 'slide-panel-overlay'}
        style={{ position: 'fixed', inset: 0, background: `rgba(0,0,0,${overlayOpacity})`, zIndex: 40, animation: 'fadeIn 0.2s ease-out' }}
      />
      <div
        className={fullScreenOnMobile ? 'slide-panel slide-panel--mobile-full' : 'slide-panel'}
        style={{
        position: 'fixed',
        zIndex: 50,
        background: colors.surface,
        boxShadow: shadows.panel,
        display: 'flex', flexDirection: 'column', overflow: 'hidden', overscrollBehavior: 'contain',
        touchAction: 'pan-y',
        animation: 'slideInRight 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
        top: 0, right: 0, height: '100vh', width,
      }}>
        {children}
      </div>
    </>
  )
}