'use client'

import { createContext, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { SlidePanelHeader } from '@/components/ui'
import { ProfilePanelSkeleton } from '@/components/ui/ProfilePanelSkeleton'

const Conversations = lazy(() => import('./Conversations'))
export const ProfileEmailContext = createContext<((recipient: string) => void) | null>(null)

/** Keep both views mounted: returning to the profile must not discard the draft. */
export function ProfileEmailWorkspace({ identity, backDestination, onClose, onViewChange, children }: {
  identity: string; backDestination: 'lead' | 'contact'; onClose: () => void
  onViewChange?: (open: boolean) => void; children: ReactNode
}) {
  const [recipient, setRecipient] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false); setRecipient(null) }, [identity])
  const back = () => { setOpen(false); onViewChange?.(false) }
  return <ProfileEmailContext.Provider value={value => { setRecipient(value); setOpen(true); onViewChange?.(true) }}>
    <div hidden={open} style={{ display: open ? 'none' : 'contents' }}>{children}</div>
    {recipient && <div hidden={!open} style={{ display: open ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 }}>
      <SlidePanelHeader title="Send Email" onBack={back} backLabel={`Back to ${backDestination}`} onClose={onClose} />
      <Suspense fallback={<ProfilePanelSkeleton />}>
        <Conversations key={`${identity}:${recipient}`} embedded={{ recipient, channel: 'email', onClose: back }} />
      </Suspense>
    </div>}
  </ProfileEmailContext.Provider>
}