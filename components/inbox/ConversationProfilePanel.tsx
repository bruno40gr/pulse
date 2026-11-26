'use client'

import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { useRouter } from 'next/navigation'
import LiveContactPanel, { type ContactCapabilities } from '@/components/contacts/LiveContactPanel'
import type { Contact } from '@/app/dashboard/contacts/page'
import { contactProfileFamilies } from '@/lib/contact-profile-family'
import { displayAccountHolders } from '@/lib/family-account'
import { LeadDetailPanel } from '@/components/leads/LeadDetailPanel'
import { Button, Notice, SlidePanel } from '@/components/ui'
import { useIsMobile } from '@/lib/useMediaQuery'
import { useMobilePanelHistory } from '@/lib/useMobilePanelHistory'
import type { ConversationPerson } from '@/lib/conversations-live'
import { PROFILE_PANEL_WIDTH } from '@/lib/conversation-display'
import { ProfilePanelSkeleton } from '@/components/ui/ProfilePanelSkeleton'
import { ConversationComposeContext } from '@/components/inbox/ConversationComposeContext'
import type { ConversationChannel } from '@/lib/conversation-links'

type Lead = ComponentProps<typeof LeadDetailPanel>['lead']
type Draft = ComponentProps<typeof LeadDetailPanel>['draft']

export default function ConversationProfilePanel({ person, tenantId, onClose, onCompose }: {
  person: ConversationPerson; tenantId: string; onClose: () => void; onCompose: (channel: ConversationChannel) => void
}) {
  const [contact, setContact] = useState<Contact | null>(null)
  const [lead, setLead] = useState<Lead | null>(null)
  const [roster, setRoster] = useState<Contact[]>([])
  const [familyTrail, setFamilyTrail] = useState<Contact[]>([])
  const [capabilities, setCapabilities] = useState<ContactCapabilities>({ edit: false, readNotes: false, editNotes: false })
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
        if (controller.signal.aborted) return
        if (person.profileType === 'lead') setLead(data)
        else {
          const rosterResponse = await fetch(`/api/contacts?tenant=${encodeURIComponent(tenantId)}`, { signal: controller.signal })
          const contacts = await rosterResponse.json()
          if (!rosterResponse.ok || !Array.isArray(contacts)) throw new Error('Could not load contact permissions and family.')
          if (controller.signal.aborted) return
          setRoster(contacts)
          setCapabilities({ edit: rosterResponse.headers.get('X-Contacts-Can-Edit') === 'true',
            readNotes: rosterResponse.headers.get('X-Contacts-Can-Read-Notes') === 'true',
            editNotes: rosterResponse.headers.get('X-Contacts-Can-Edit-Notes') === 'true' })
          setContact(contacts.find((row: Contact) => row.id === data.id) || data)
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

  const families = contact ? contactProfileFamilies(roster, tenantId, contact.id) : []
  const holderFamily = families.find(family => family.holders.some(holder => holder.id === contact?.id))
  const studentFamily = families.find(family => family.id === (contact?.family_account_id || contact?.account_id))
  const holder = studentFamily?.holders.find(person => person.id === contact?.account_holder_person_id) || studentFamily?.holders[0]
  const updateContact = (updated: Contact) => {
    setRoster(rows => rows.map(row => row.id === updated.id ? updated : row))
    setContact(current => current?.id === updated.id ? updated : current)
  }
  const refreshFamily = async () => {
    try {
      const response = await fetch(`/api/contacts?tenant=${encodeURIComponent(tenantId)}`, { cache: 'no-store' })
      const rows = await response.json()
      if (!response.ok || !Array.isArray(rows)) throw new Error('Could not refresh contact family.')
      if (!mounted.current) return
      setRoster(rows)
      setContact(current => current ? rows.find((row: Contact) => row.id === current.id) || current : current)
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not refresh contact family.') }
  }
  return <ConversationComposeContext.Provider value={channel => history.dismissPanel(() => onCompose(channel))}>
    {contact ? <LiveContactPanel key={contact.id} tenantId={tenantId} capabilities={capabilities} initialNotesTab="notes" onFamilyChanged={() => void refreshFamily()}
      familyPeople={[...new Map(families.flatMap(family => [...family.students, ...family.holders]).map(person => [person.id, person])).values()]}
      onBack={familyTrail.length ? () => { setContact(familyTrail[familyTrail.length - 1]); setFamilyTrail(trail => trail.slice(0, -1)) } : undefined}
      subject={holderFamily ? { kind: 'holder', person: contact, students: holderFamily.students.filter(row => row.id !== contact.id), memberSince: holderFamily.students[0]?.account_member_since || null } : { kind: 'student', person: contact }}
      accountHolders={displayAccountHolders(families.flatMap(family => family.students))}
      accountHolderLink={holder ? { name: `${holder.first_name} ${holder.last_name}`.trim(), href: `/dashboard/contacts?contact=${encodeURIComponent(holder.id)}`, open: () => setContact(holder) } : undefined}
      onOpenStudent={next => { setFamilyTrail(trail => [...trail, contact]); setContact(next) }} onUpdated={updateContact} onAccountUpdated={() => void refreshFamily()}
      onNotesUpdated={(id, field, notes) => {
        setContact(current => current?.id === id ? { ...current, [field]: notes } : current)
        setRoster(rows => rows.map(row => row.id === id ? { ...row, [field]: notes } : row))
      }}
      onClose={history.closePanel} onCompose={contact.id === person.profileId ? channel => history.dismissPanel(() => onCompose(channel)) : undefined} /> :
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