'use client'

import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { useRouter } from 'next/navigation'
import ContactSlidePanel from '@/components/contacts/ContactSlidePanel'
import { LeadDetailPanel } from '@/components/leads/LeadDetailPanel'
import { Button, Notice, SlidePanel } from '@/components/ui'
import { useIsMobile } from '@/lib/useMediaQuery'
import { useMobilePanelHistory } from '@/lib/useMobilePanelHistory'
import type { ConversationPerson } from '@/lib/conversations-live'
import { PROFILE_PANEL_WIDTH } from '@/lib/conversation-display'
import { ProfilePanelSkeleton } from '@/components/ui/ProfilePanelSkeleton'
import { ConversationComposeContext } from '@/components/inbox/ConversationComposeContext'
import type { ConversationChannel } from '@/lib/conversation-links'

type Contact = ComponentProps<typeof ContactSlidePanel>['contact']
type Lead = ComponentProps<typeof LeadDetailPanel>['lead']
type Draft = ComponentProps<typeof LeadDetailPanel>['draft']
type Field = ComponentProps<typeof ContactSlidePanel>['tenantFields'][number]

export default function ConversationProfilePanel({ person, tenantId, onClose, onCompose }: {
  person: ConversationPerson; tenantId: string; onClose: () => void; onCompose: (channel: ConversationChannel) => void
}) {
  const [contact, setContact] = useState<Contact | null>(null)
  const [lead, setLead] = useState<Lead | null>(null)
  const [fields, setFields] = useState<Field[]>([])
  const [draft, setDraft] = useState<Draft>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [calling, setCalling] = useState(false)
  const mounted = useRef(true)
  const mobile = useIsMobile()
  const router = useRouter()
  const history = useMobilePanelHistory({ isOpen: true, isMobile: mobile, historyKey: 'pulseMobileConversationProfile', onClose })
  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    const load = async () => {
      try {
        const params = new URLSearchParams({ tenant: tenantId })
        if (person.intakeType) params.set('intake_type', person.intakeType)
        const response = await fetch(`/api/${person.profileType === 'lead' ? 'leads' : 'contacts'}/${person.profileId}?${params}`, { signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load profile.')
        if (!mounted.current) return
        if (person.profileType === 'lead') setLead(data)
        else {
          setContact(data)
          const fieldsResponse = await fetch(`/api/tenant-fields?tenant=${tenantId}`, { signal: controller.signal })
          if (fieldsResponse.ok && mounted.current) setFields(await fieldsResponse.json())
        }
      } catch (error) {
        if (mounted.current && !controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load profile.')
      }
    }
    void load()
    return () => { mounted.current = false; controller.abort() }
  }, [person, tenantId])

  async function patchLead(patch: Record<string, unknown>) {
    if (!lead) return false
    setSaving(true); setError('')
    try {
      const response = await fetch(`/api/leads/${lead.id}?tenant=${tenantId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save lead.')
      if (mounted.current) setLead(data)
      return true
    } catch (error) {
      if (mounted.current) setError(error instanceof Error ? error.message : 'Could not save lead.')
      return false
    } finally { if (mounted.current) setSaving(false) }
  }

  return <ConversationComposeContext.Provider value={channel => history.dismissPanel(() => onCompose(channel))}>
    {contact ? <ContactSlidePanel contact={contact} tenantFields={fields} onUpdated={setContact} onClose={history.closePanel} onCompose={() => history.dismissPanel(() => onCompose('sms'))} /> :
      <SlidePanel isOpen onClose={history.closePanel} fullScreen={mobile} width={PROFILE_PANEL_WIDTH} ariaLabel={person.profileType === 'lead' ? 'Lead details' : 'Contact details'}>
        {error && <Notice variant="error">{error}</Notice>}
        {lead ? <LeadDetailPanel lead={lead} saving={saving} calling={calling} isMobile={mobile} draft={draft} onDraftChange={setDraft}
          onPatch={patchLead} onClose={history.closePanel} onCompose={() => history.dismissPanel(() => onCompose('sms'))}
          onEdit={() => history.dismissPanel(() => router.push(`/dashboard/leads?lead=${lead.id}`))}
          onCall={async () => {
            if (!lead.contact?.phone) return
            setCalling(true); setError('')
            try {
              const response = await fetch(`/api/calls?tenant=${tenantId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to_phone: lead.contact.phone, contact_id: lead.contact.id || null, lead_id: lead.intake_type === 'job_application' ? null : lead.id }) })
              if (!response.ok) throw new Error('Call could not be started.')
            } catch { if (mounted.current) setError('Call could not be started.') }
            finally { if (mounted.current) setCalling(false) }
          }} /> : error ? <><p>Profile unavailable.</p><Button variant="secondary" onClick={history.closePanel}>Close</Button></> : <ProfilePanelSkeleton />}
      </SlidePanel>}
  </ConversationComposeContext.Provider>
}