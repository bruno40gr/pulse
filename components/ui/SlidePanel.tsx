'use client'
import { useEffect } from 'react'
import { colors, shadows } from '@/lib/tokens'

interface SlidePanelProps {
  isOpen: boolean
  onClose: () => void
  width?: string
  children: React.ReactNode
  overlayOpacity?: number
}

export function SlidePanel({ isOpen, onClose, width = 'min(75vw, 900px)', children, overlayOpacity = 0.3 }: SlidePanelProps) {
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
        style={{ position: 'fixed', inset: 0, background: `rgba(0,0,0,${overlayOpacity})`, zIndex: 40, animation: 'fadeIn 0.2s ease-out' }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100vh',
        width, background: colors.surface, zIndex: 50,
        boxShadow: shadows.panel,
        display: 'flex', flexDirection: 'column', overflow: 'hidden', overscrollBehavior: 'contain',
        touchAction: 'pan-y',
        animation: 'slideInRight 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        {children}
      </div>
    </>
  )
}