'use client'

import { useState } from 'react'
import { Mail, MessageSquare } from 'lucide-react'
import { Button, DenseSectionPanel, Notice, Select, SlidePanel, SlidePanelHeader } from '@/components/ui'
import { Checkbox } from '@/components/ui/Checkbox'
import ContactBulkComposer from '@/components/inbox/ContactBulkComposer'
import ContactGroupEmailComposer from '@/components/inbox/ContactGroupEmailComposer'
import { colors, spacing, typography } from '@/lib/tokens'
import { getActiveTenantId } from '@/lib/tenant'
import { useIsMobile } from '@/lib/useMediaQuery'
import { PROFILE_PANEL_WIDTH } from '@/lib/conversation-display'

export type BandCommunicationMember = { person_id: string; name: string }

export default function BandCommunications({ bandName, members, initialChannel }: {
  bandName: string; members: BandCommunicationMember[]; initialChannel?: 'sms' | 'email'
}) {
  const mobile = useIsMobile()
  const [selected, setSelected] = useState<string[]>([])
  const [channel, setChannel] = useState<'sms' | 'email'>(initialChannel || 'sms')
  const [emailMode, setEmailMode] = useState<'individual' | 'shared'>('individual')
  const [compose, setCompose] = useState<{ ids: string[]; channel: 'sms' | 'email'; shared: boolean } | null>(null)
  const ids = [...new Set(members.map(member => member.person_id))]
  const selectedIds = ids.filter(id => selected.includes(id))
  const open = (contactIds: string[]) => setCompose({ ids: contactIds, channel, shared: channel === 'email' && emailMode === 'shared' })
  return <>
    <DenseSectionPanel title="Communications" actions={<Button style={mobile ? { width: '100%' } : undefined} disabled={!selectedIds.length} onClick={() => open(selectedIds)}>
      {channel === 'sms' ? <MessageSquare size={14} /> : <Mail size={14} />}Write {channel === 'sms' ? 'text message' : 'email'}{selectedIds.length ? ` (${selectedIds.length})` : ''}
    </Button>} contentStyle={{ display: 'grid', gap: spacing.lg }}>
      <div style={{ ...typography.bodySmall, color: colors.textSecondary }}>Select members to message their routed account holders. The composer verifies addresses and opt-outs, and combines duplicate family destinations.</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.lg }}>
        <Select label="Channel" value={channel} onChange={event => setChannel(event.target.value as 'sms' | 'email')}>
          <option value="sms">Text message</option><option value="email">Email</option>
        </Select>
        {channel === 'email' && <Select label="Email delivery" value={emailMode} onChange={event => setEmailMode(event.target.value as 'individual' | 'shared')}>
          <option value="individual">Individual emails</option><option value="shared">One email with CC / BCC</option>
        </Select>}
      </div>
      <Notice>{channel === 'sms' ? 'Each recipient gets a separate SMS—not a group text.' : emailMode === 'individual'
        ? 'Each recipient gets a separate email. Other account holders are not included.'
        : 'One shared email. Recipients start in BCC for privacy; use Manage recipients to move them to CC or To.'}</Notice>
      <Checkbox label="Select all band members" disabled={!ids.length} checked={!!ids.length && selectedIds.length === ids.length}
        onChange={event => setSelected(event.target.checked ? ids : [])} />
      <div role="group" aria-label="Band communication recipients">
        {members.map(member => <div key={member.person_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm,
          paddingBlock: spacing.md, borderTop: `1px solid ${colors.borderLight}` }}>
          <Checkbox label={member.name} checked={selectedIds.includes(member.person_id)} onChange={event => setSelected(current => event.target.checked ? [...current, member.person_id] : current.filter(id => id !== member.person_id))} />
          <Button size="sm" variant="secondary" aria-label={`Message account holders for ${member.name}`} onClick={() => open([member.person_id])}>Message</Button>
        </div>)}
        {!members.length && <div style={{ ...typography.bodySmall, color: colors.textSecondary }}>Add members to the band before sending messages.</div>}
      </div>
    </DenseSectionPanel>
    {compose && <SlidePanel isOpen fullScreen={mobile} width={PROFILE_PANEL_WIDTH} ariaLabel="Band message composer" onClose={() => setCompose(null)}>
      <SlidePanelHeader title={compose.channel === 'sms' ? 'Send a text message' : 'Send email'} subtitle={bandName} onBack={() => setCompose(null)} backLabel="Back to band recipients" onClose={() => setCompose(null)} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {compose.shared ? <ContactGroupEmailComposer tenantId={getActiveTenantId()} contactIds={compose.ids} onClose={() => setCompose(null)} />
          : <ContactBulkComposer tenantId={getActiveTenantId()} contactIds={compose.ids} channel={compose.channel} onClose={() => setCompose(null)} />}
      </div>
    </SlidePanel>}
  </>
}