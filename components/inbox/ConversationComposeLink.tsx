'use client'

import { ContactPrototypeContext } from '@/components/contacts/ContactPrototypeContext'
import ContactBulkComposer from './ContactBulkComposer'
import { getActiveTenantId } from '@/lib/tenant'
import { lazy, Suspense, useContext, useState } from 'react'
import { Mail, MessageCircle } from 'lucide-react'
import { Button, SlidePanel, SlidePanelHeader } from '@/components/ui'
import { ProfilePanelSkeleton } from '@/components/ui/ProfilePanelSkeleton'
import { ConversationComposeContext } from '@/components/inbox/ConversationComposeContext'
import type { ConversationChannel } from '@/lib/conversation-links'
import { PROFILE_PANEL_WIDTH } from '@/lib/conversation-display'
import { useIsMobile } from '@/lib/useMediaQuery'
import { ProfileEmailContext } from './ProfileEmailWorkspace'

const Conversations = lazy(() => import('@/components/inbox/Conversations'))

export default function ConversationComposeLink({ recipient, channel, disabled = false, unavailableReason, backDestination, destination }: {
  recipient: string; channel: ConversationChannel; disabled?: boolean; unavailableReason?: string; backDestination: 'lead' | 'contact'; destination?: string
}) {
  const simulated = useContext(ContactPrototypeContext)
  const contextualCompose = useContext(ConversationComposeContext)
  const profileEmail = useContext(ProfileEmailContext)
  const [open, setOpen] = useState(false)
  const mobile = useIsMobile()
  const label = channel === 'email' ? 'Send email' : 'Send SMS'
  return <>
    <Button variant="secondary" aria-label={label} style={{ maxWidth: 'min(320px, 100%)', minWidth: 0, whiteSpace: 'nowrap' }} disabled={disabled} title={disabled ? unavailableReason || `No ${channel === 'email' ? 'email address' : 'phone number'} available` : destination}
      onClick={() => contextualCompose ? contextualCompose(channel) : profileEmail && (!simulated || channel === 'sms') ? profileEmail(recipient, channel) : setOpen(true)}>
      {channel === 'email' ? <Mail size={16} style={{ flexShrink: 0 }} /> : <MessageCircle size={16} style={{ flexShrink: 0 }} />}{channel === 'email' ? 'Email' : 'SMS'}{destination && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{destination}</span>}
    </Button>
    {open && <SlidePanel isOpen onClose={() => setOpen(false)} fullScreen={mobile} width={PROFILE_PANEL_WIDTH} ariaLabel={`${label} composer`}>
      <SlidePanelHeader title={channel === 'email' ? 'Send Email' : 'Send a Text Message'} onBack={() => setOpen(false)} backLabel={`Back to ${backDestination}`} onClose={() => setOpen(false)} />
      <Suspense fallback={<ProfilePanelSkeleton />}>{simulated ? <ContactBulkComposer tenantId={getActiveTenantId()} contactIds={[recipient.split(':').slice(1).join(':')]} channel={channel === 'email' ? 'email' : 'sms'} onClose={() => setOpen(false)} /> : <Conversations embedded={{ recipient, channel, onClose: () => setOpen(false) }} />}</Suspense>
    </SlidePanel>}
  </>
}