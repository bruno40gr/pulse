'use client'

import { createContext, type ReactNode } from 'react'
import { Button, SectionTitle } from '@/components/ui'
import { spacing } from '@/lib/tokens'

export const ProfileComposerCancelContext = createContext<(() => void) | null>(null)

/** Content heading and actions, never a second drawer header. */
export function ProfileComposerToolbar({ channel, onCancel, children }: {
  channel: 'email' | 'sms'; onCancel: () => void; children: ReactNode
}) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap', flexShrink: 0, padding: `${spacing.lg} ${spacing.xl}` }}>
    <SectionTitle style={{ marginBottom: 0 }}>{channel === 'email' ? 'Write email' : 'Write text message'}</SectionTitle>
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginLeft: 'auto' }}>
      <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      {children}
    </div>
  </div>
}