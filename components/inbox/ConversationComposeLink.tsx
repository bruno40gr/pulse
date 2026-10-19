'use client'

import { lazy, Suspense, useContext, useState } from 'react'
import { Mail, MessageCircle } from 'lucide-react'
import { Button, SlidePanel, SlidePanelHeader } from '@/components/ui'
import { ProfilePanelSkeleton } from '@/components/ui/ProfilePanelSkeleton'
import { ConversationComposeContext } from '@/components/inbox/ConversationComposeContext'
import type { ConversationChannel } from '@/lib/conversation-links'
import { PROFILE_PANEL_WIDTH } from '@/lib/conversation-display'
import { useIsMobile } from '@/lib/useMediaQuery'

const Conversations = lazy(() => import('@/components/inbox/Conversations'))

export default function ConversationComposeLink({ recipient, channel, disabled = false, unavailableReason, backDestination }: {
  recipient: string; channel: ConversationChannel; disabled?: boolean; unavailableReason?: string; backDestination: 'lead' | 'contact'
}) {
  const contextualCompose = useContext(ConversationComposeContext)
  const [open, setOpen] = useState(false)
  const mobile = useIsMobile()
  const label = channel === 'email' ? 'Send email' : 'Send SMS'
  return <>
    <Button variant="secondary" disabled={disabled} title={disabled ? unavailableReason || `No ${channel === 'email' ? 'email address' : 'phone number'} available` : undefined}
      onClick={() => contextualCompose ? contextualCompose(channel) : setOpen(true)}>
      {channel === 'email' ? <Mail size={16} /> : <MessageCircle size={16} />}{label}
    </Button>
    {open && <SlidePanel isOpen onClose={() => setOpen(false)} fullScreen={mobile} width={PROFILE_PANEL_WIDTH} ariaLabel={`${label} composer`}>
      <SlidePanelHeader title={channel === 'email' ? 'Send Email' : 'Send a Text Message'} onBack={() => setOpen(false)} backLabel={`Back to ${backDestination}`} onClose={() => setOpen(false)} />
      <Suspense fallback={<ProfilePanelSkeleton />}><Conversations embedded={{ recipient, channel, onClose: () => setOpen(false) }} /></Suspense>
    </SlidePanel>}
  </>
}