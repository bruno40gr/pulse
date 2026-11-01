'use client'

import { useState } from 'react'
import { Button, DenseSectionPanel, SlidePanel, SlidePanelHeader, StatusBadge, Tabs } from '@/components/ui'
import { PersonName } from '@/components/ui/PersonName'
import { PROFILE_PANEL_WIDTH } from '@/lib/conversation-display'
import { colors, spacing } from '@/lib/tokens'
import { formatPhoneNumber } from '@/lib/phone'
import { useIsMobile } from '@/lib/useMediaQuery'

type Member = {
  id: string; first_name: string; last_name: string; client_status: string
  is_student?: boolean; account_holder_phone: string | null; account_holder_email: string | null
}
type Section = 'profile' | 'scheduling' | 'billing'

/** Account context, not a synthetic person or a new authorization role. */
export default function AccountFamilyPanel<T extends Member>({ name, members, onClose, onOpenMember }: {
  name: string; members: T[]; onClose: () => void
  onOpenMember: (member: T, tab: Section) => void
}) {
  const [section, setSection] = useState<Section>('profile')
  const mobile = useIsMobile()
  const holder = members[0]
  return <SlidePanel isOpen onClose={onClose} fullScreen={mobile} width={PROFILE_PANEL_WIDTH}>
    <SlidePanelHeader title={name} subtitle="Account holder" onClose={onClose} />
    <div style={{ padding: spacing.lg }}>
      <Tabs items={[{ key: 'profile', label: 'Family' }, { key: 'scheduling', label: 'Scheduling' }, { key: 'billing', label: 'Billing & accounting' }]} activeKey={section} onChange={setSection} />
    </div>
    <div style={{ padding: spacing.lg, overflowY: 'auto', display: 'grid', gap: spacing.lg }}>
      {section === 'profile' && <DenseSectionPanel title="Account contact">
        <div>{formatPhoneNumber(holder?.account_holder_phone) || 'No phone'}</div>
        <div style={{ color: colors.textSecondary }}>{holder?.account_holder_email || 'No email'}</div>
      </DenseSectionPanel>}
      {members.map(member => <DenseSectionPanel key={member.id}
        title={<PersonName weight="normal">{member.first_name} {member.last_name}</PersonName>}
        actions={<Button variant="secondary" size="sm" onClick={() => onOpenMember(member, section)}>{section === 'profile' ? 'Open profile' : section === 'billing' ? 'Open billing' : 'Open scheduling'}</Button>}
      >
        {member.is_student !== false && <StatusBadge status={member.client_status} label={member.client_status.charAt(0).toUpperCase() + member.client_status.slice(1)} />}
      </DenseSectionPanel>)}
    </div>
  </SlidePanel>
}