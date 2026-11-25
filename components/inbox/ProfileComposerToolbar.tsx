'use client'

import { createContext, type ReactNode } from 'react'
import { Button, SectionTitle } from '@/components/ui'
import { spacing } from '@/lib/tokens'

export const ProfileComposerCancelContext = createContext<(() => void) | null>(null)

/** Content heading and actions, never a second drawer header. */
export function ProfileComposerToolbar({ channel, onCancel, children, recipientName, recipientControl }: {
  channel: 'email' | 'sms'; onCancel: () => void; children: ReactNode; recipientName?: string; recipientControl?: ReactNode
}) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap', flexShrink: 0, padding: `${spacing.lg} ${spacing.xl}` }}>
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