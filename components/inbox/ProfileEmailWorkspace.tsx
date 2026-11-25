'use client'

import { createContext, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { ProfilePanelSkeleton } from '@/components/ui/ProfilePanelSkeleton'
import { ProfileComposerLayout } from './ProfileComposerLayout'
import { ProfileComposerActiveContext } from './ProfileComposerToolbar'

const Conversations = lazy(() => import('./Conversations'))
export const ProfileEmailContext = createContext<((recipient: string, channel: 'email' | 'sms') => void) | null>(null)

/** Keep both views mounted: returning to the profile must not discard the draft. */
export function ProfileEmailWorkspace({ identity, onViewChange, children, renderSms, header }: {
  identity: string; backDestination: 'lead' | 'contact'; onClose: () => void
  onViewChange?: (open: boolean) => void; children: ReactNode
  renderSms?: (onBack: () => void) => ReactNode
  header: ReactNode
}) {
  const [recipient, setRecipient] = useState<string | null>(null)
  const [channel, setChannel] = useState<'email' | 'sms'>('email')
  const [visited, setVisited] = useState({ email: false, sms: false })
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false); setRecipient(null); setVisited({ email: false, sms: false }) }, [identity])
  const back = () => { setOpen(false); onViewChange?.(false) }
  return <ProfileEmailContext.Provider value={(value, nextChannel) => { setRecipient(value); setChannel(nextChannel); setVisited(current => ({ ...current, [nextChannel]: true })); setOpen(true); onViewChange?.(true) }}>
    <ProfileComposerLayout open={open} header={header} onCancel={back} profile={children} composer={<>
      {recipient && (['email', 'sms'] as const).map(value => visited[value] && <div key={value} hidden={channel !== value} style={{ display: channel === value ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 }}>
        <ProfileComposerActiveContext.Provider value={open && channel === value}><Suspense fallback={<ProfilePanelSkeleton />}>
          {value === 'sms' && renderSms ? renderSms(back) : <Conversations key={`${identity}:${recipient}`} embedded={{ recipient, channel: value, onClose: back, onSent: () => setVisited(current => ({ ...current, [value]: false })) }} />}
        </Suspense></ProfileComposerActiveContext.Provider>
      </div>)}
    </>} />
  </ProfileEmailContext.Provider>
}