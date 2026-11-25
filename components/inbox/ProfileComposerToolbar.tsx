'use client'

import { createContext, useEffect, useRef, type ReactNode } from 'react'
import { Button, SectionTitle } from '@/components/ui'
import { colors, spacing } from '@/lib/tokens'

export const ProfileComposerCancelContext = createContext<(() => void) | null>(null)
export const ProfileComposerActiveContext = createContext(true)

/** Content heading and actions, never a second drawer header. */
export function ProfileComposerToolbar({ channel, onCancel, children, recipientName, recipientControl }: {
  channel: 'email' | 'sms'; onCancel: () => void; children: ReactNode; recipientName?: string; recipientControl?: ReactNode
}) {
  const toolbar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = toolbar.current
    const workspace = element?.closest<HTMLElement>('[data-profile-composer-workspace]')
    if (!element || !workspace) return
    const measure = () => {
      // Retained email/SMS panes are mounted but hidden; only the visible toolbar owns the height.
      const box = element.getBoundingClientRect()
      if (box.width > 0 && box.height > 0) workspace.style.setProperty('--profile-toolbar-height', `${box.height}px`)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => observer.disconnect()
  }, [])
  return <div ref={toolbar} data-profile-composer-toolbar style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap', flexShrink: 0, minHeight: 64, boxSizing: 'border-box', borderBottom: `1px solid ${colors.border}`, padding: `${spacing.sm} ${spacing.xl}` }}>
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, minWidth: 0 }}>
      <SectionTitle style={{ marginBottom: 0 }}>{channel === 'email' ? 'Write email' : `Messaging ${recipientName || 'recipient'}`}</SectionTitle>
      {channel === 'sms' && recipientControl}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginLeft: 'auto' }}>
      <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      {children}
    </div>
  </div>
}