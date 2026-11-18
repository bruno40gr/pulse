'use client'

import { useState } from 'react'
import { CalendarDays, CreditCard, Landmark, Mail, MessageSquare, Pencil, Phone, RotateCcw } from 'lucide-react'
import type { Contact } from '@/app/dashboard/contacts/page'
import { Button, DenseSectionPanel, EmptyState, FieldGrid, FieldLabel, FieldValue, Input, NotesSection, SlidePanel, SlidePanelHeader, StatusBadge, Tabs } from '@/components/ui'
import { SlidePanelActionBar } from '@/components/ui/SlidePanelActionBar'
import CardSmsComposer from '@/components/inbox/CardSmsComposer'
import ContactBulkComposer from '@/components/inbox/ContactBulkComposer'
import ConversationComposeLink from '@/components/inbox/ConversationComposeLink'
import { FundingContactDetails } from '@/components/funding/FundingContactDetails'
import type { FundingCase } from '@/components/funding/types'
import { changedContactProfile, CONTACT_PROFILE_FIELDS, contactProfileDraft, type ContactProfileField } from '@/lib/contact-profile'
import { formatPhoneNumber } from '@/lib/phone'
import { usesAccountHolder } from '@/lib/contact-presentation'
import { colors, spacing, typography } from '@/lib/tokens'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { useIsMobile } from '@/lib/useMediaQuery'

export type AccountContact = { id: string; name: string; phone: string | null; email: string | null; memberSince: string | null }
type Subject =
  | { kind: 'student'; person: Contact }
  | { kind: 'holder'; person: Contact; students: Contact[]; memberSince: string | null }
  | { kind: 'account-holder'; account: AccountContact; students: Contact[] }
export type ContactCapabilities = { edit: boolean; readNotes: boolean; editNotes: boolean }
type NoteKind = 'notes' | 'internal'
export type LiveContactNote = { id?: string; text: string; timestamp: string; actor_name?: string | null; completed_at?: string | null }
type Section = 'account' | 'notes' | 'schedule' | 'billing' | 'makeups' | 'funding'
const labels: Record<ContactProfileField, string> = { first_name: 'First name', last_name: 'Last name', phone: 'Phone', email: 'Email', date_of_birth: 'Date of birth' }
const personName = (person: Contact) => `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim()
const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback
const jsonHeaders = { 'Content-Type': 'application/json' }
const muted = { ...typography.bodySmall, color: colors.textSecondary } as const

function ageLabel(dateOfBirth?: string | null) {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null
  const birth = new Date(`${dateOfBirth}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1
  return age >= 0 && age < 120 ? `${age}yo` : null
}

function scheduleLabel(contact: Contact) {
  const day = typeof contact.custom_fields?.lesson_day === 'string' ? contact.custom_fields.lesson_day.trim() : ''
  const time = typeof contact.custom_fields?.lesson_time === 'string' ? contact.custom_fields.lesson_time.trim() : ''
  if (!day && !time) return null
  const plural = /^[a-z]+$/i.test(day) ? `${day}s` : day
  return [plural, time && `at ${time}`].filter(Boolean).join(' ')
}

function enrollmentLabel(contact: Contact) {
  const instrument = typeof contact.custom_fields?.instrument === 'string' ? contact.custom_fields.instrument.trim() : ''
  const duration = typeof contact.custom_fields?.service_type === 'string' ? contact.custom_fields.service_type.trim() : ''
  return [instrument, duration].filter(Boolean).join(' • ') || null
}

function planLabel(contact: Contact) {
  const plan = typeof contact.custom_fields?.plan_name === 'string' ? contact.custom_fields.plan_name.trim() : ''
  const session = typeof contact.custom_fields?.session_name === 'string' ? contact.custom_fields.session_name.trim() : ''
  return plan || session || null
}

function formatMemberSince(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function under18(dateOfBirth?: string | null) {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return false
  const now = new Date()
  const cutoff = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate())
  const birthday = new Date(`${dateOfBirth}T00:00:00`)
  return birthday > cutoff && birthday <= now
}

export default function LiveContactPanel({ subject, tenantId, capabilities, initialNotesTab, startOnNotes, onClose, onUpdated, onAccountUpdated, onNotesUpdated, onOpenStudent }: {
  subject: Subject; tenantId: string; capabilities: ContactCapabilities
  initialNotesTab: NoteKind; startOnNotes?: boolean; onClose: () => void
  onUpdated: (person: Contact) => void; onNotesUpdated: (id: string, field: 'notes_history' | 'student_notes_history', notes: LiveContactNote[]) => void
  onAccountUpdated: (account: AccountContact) => void; onOpenStudent: (student: Contact) => void
}) {
  const mobile = useIsMobile()
  const wide = useMediaQuery('(min-width: 860px)')
  const person = subject.kind === 'account-holder' ? null : subject.person
  const account = subject.kind === 'account-holder' ? subject.account : null
  const students = subject.kind === 'student' ? [] : subject.students
  const memberSince = subject.kind === 'student' ? null : subject.kind === 'holder' ? subject.memberSince : account?.memberSince ?? null
  const showsAccount = subject.kind !== 'student'
  const name = account ? account.name : person ? personName(person) : ''
  const phone = account ? account.phone : person?.phone ?? null
  const email = account ? account.email : person?.email ?? null
  const [section, setSection] = useState<Section>(startOnNotes ? 'notes' : 'account')
  const [notesTab, setNotesTab] = useState(initialNotesTab)
  const [draft, setDraft] = useState<ReturnType<typeof contactProfileDraft> | null>(null)
  const [baseline, setBaseline] = useState<ReturnType<typeof contactProfileDraft> | null>(null)
  const [saving, setSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [noteError, setNoteError] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [calling, setCalling] = useState(false)
  const [compose, setCompose] = useState<'sms' | 'email' | null>(null)
  const [status, setStatus] = useState('')
  const [funding, setFunding] = useState<{ loading: boolean; data?: FundingCase; error?: string }>({ loading: false })
  const [fundingLoaded, setFundingLoaded] = useState(false)
  const tenantQuery = `tenant=${encodeURIComponent(tenantId)}`
  const endpoint = person && `/api/contacts/${encodeURIComponent(person.id)}`
  const profilePath = account ? `/api/contacts/accounts/${encodeURIComponent(account.id)}/profile` : `${endpoint}/profile`
  const fundingAvailable = subject.kind === 'student' || person?.is_student === true
  const holderRouting = !!person && (usesAccountHolder(person) || under18(person.date_of_birth))
  // Bulk delivery uses the saved student routing columns, not DOB or display fields.
  const canComposeToHolder = holderRouting && !!person && (person.is_minor === true || person.message_routing === 'account_holder')
  const primaryHolder = person?.account_holders?.find(holder => holder.is_primary) || person?.account_holders?.[0]
  const callPhone = holderRouting ? primaryHolder?.phone || person?.account_holder_phone : phone
  const routedEmail = primaryHolder?.email || person?.account_holder_email
  // An account has no person row; message it through the students whose saved routing targets the account holder.
  const accountRecipients = account ? students.filter(student => student.is_minor === true || student.message_routing === 'account_holder') : []
  const canMessageAccountSms = Boolean(account) && accountRecipients.length > 0 && Boolean(phone)
  const canMessageAccountEmail = Boolean(account) && accountRecipients.length > 0 && Boolean(email)
  const notesField = notesTab === 'internal' ? 'notes_history' : 'student_notes_history'
  const notes = person?.[notesField] ?? []
  const changes = draft && baseline ? changedContactProfile(baseline, draft) : {}
  const dirty = Object.keys(changes).length > 0
  const canLeave = () => !saving && !noteSaving && (!dirty || window.confirm('Discard unsaved contact changes?'))

  const save = async () => {
    if ((!person && !account) || !capabilities.edit || saving || !dirty) return
    setSaving(true)
    setProfileError('')
    try {
      const { first_name: accountName, ...rest } = changes
      const payload = account ? { ...rest, ...(accountName !== undefined ? { name: accountName } : {}) } : changes
      const response = await fetch(`${profilePath}?${tenantQuery}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(payload) })
      const saved = await response.json()
      if (!response.ok || saved?.id !== (account?.id ?? person?.id)) throw new Error(saved?.error || 'Could not save contact details.')
      if (account) onAccountUpdated({ ...account, id: saved.id, name: saved.name, phone: saved.phone, email: saved.email })
      else if (person) {
        const { first_name, last_name, phone, email, date_of_birth } = saved
        onUpdated({ ...person, first_name, last_name, phone, email, date_of_birth })
      }
      setDraft(null)
      setStatus('Contact details saved.')
    } catch (error) {
      setProfileError(message(error, 'Could not save contact details.'))
    } finally { setSaving(false) }
  }

  const mutateNote = async (method: 'POST' | 'PATCH', body: object) => {
    if (!person || !endpoint || !capabilities.editNotes || noteSaving) return false
    setNoteSaving(true)
    setNoteError('')
    try {
      const path = notesTab === 'internal' ? 'internal-notes' : 'student-notes'
      const response = await fetch(`${endpoint}/${path}?${tenantQuery}`, { method, headers: jsonHeaders, body: JSON.stringify(body) })
      const result = await response.json()
      if (!response.ok || !Array.isArray(result?.[notesField])) throw new Error(result?.error || 'Could not save note.')
      onNotesUpdated(person.id, notesField, result[notesField])
      return true
    } catch (error) {
      setNoteError(message(error, 'Could not save note.'))
      return false
    } finally { setNoteSaving(false) }
  }

  const loadFunding = async () => {
    if (!person || funding.loading) return
    setFundingLoaded(true)
    setFunding({ loading: true })
    try {
      const response = await fetch(`/api/funding/cases?${tenantQuery}&student_person_id=${encodeURIComponent(person.id)}`)
      const result = await response.json()
      if (!response.ok || !Array.isArray(result)) throw new Error(result?.error || 'Could not load funding details.')
      setFunding({ loading: false, data: result[0] })
    } catch (error) { setFunding({ loading: false, error: message(error, 'Could not load funding details.') }) }
  }

  const placeCall = async () => {
    if (!person || !callPhone || calling) return
    setCalling(true)
    try {
      const response = await fetch(`/api/calls?${tenantQuery}`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ to_phone: callPhone, contact_id: person.id }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || 'Could not place call.')
      setStatus('Call placed.')
    } catch (error) { setStatus(message(error, 'Could not place call.')) }
    finally { setCalling(false) }
  }

  const close = () => { if (canLeave()) onClose() }
  const stack = { display: 'grid', gap: spacing.lg, minWidth: 0 }
  const comingSoon = section === 'schedule' ? { icon: <CalendarDays />, title: 'Schedule & lessons' }
    : section === 'billing' ? { icon: <CreditCard />, title: 'Billing' } : { icon: <RotateCcw />, title: 'Makeups' }

  return <SlidePanel isOpen onClose={close} fullScreen={mobile} width="min(calc(75vw + 200px), 1160px)">
    {compose && (person || account) ? (
      account || holderRouting ? <>
        <SlidePanelHeader title={compose === 'email' ? 'Send email' : 'Send SMS'} onBack={() => setCompose(null)} backLabel="Back to contact" onClose={close} />
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}><ContactBulkComposer tenantId={tenantId}
          contactIds={account ? accountRecipients.map(student => student.id) : person ? [person.id] : []} channel={compose} onClose={() => setCompose(null)} /></div>
      </> : <CardSmsComposer backDestination="contact" recipientId={person!.id} name={name} onBack={() => setCompose(null)} onClose={close} />
    ) : <>
      <SlidePanelHeader title={name.replace(/\s*\(account\)\s*$/i, '')} subtitle={subject.kind === 'student' ? 'Student profile' : 'Account holder'} titleSize={mobile ? typography.sizeLg : typography.size2xl}
        avatar={{ firstName: person?.first_name || name.split(' ')[0], lastName: person?.last_name || name.split(' ').slice(1).join(' '), size: mobile ? 36 : 48 }}
        badge={subject.kind === 'student' && person ? <StatusBadge status={person.opted_out ? 'spam' : person.client_status} label={person.opted_out ? 'Opted out' : person.client_status} /> : undefined}
        toast={status || undefined} onClose={close} />
      <SlidePanelActionBar isMobile={mobile}>
        <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button size="sm" disabled={!person || !callPhone || calling} onClick={() => void placeCall()}><Phone size={16} />{calling ? 'Calling…' : 'Call'}</Button>
          <Button size="sm" variant="secondary" disabled={person ? (!callPhone || (holderRouting && !canComposeToHolder)) : !canMessageAccountSms} onClick={() => setCompose('sms')}><MessageSquare size={16} />Send SMS</Button>
          {person && !holderRouting ? <ConversationComposeLink backDestination="contact" recipient={`person:${person.id}`} channel="email" disabled={!email} />
            : <Button size="sm" variant="secondary" disabled={person ? (!canComposeToHolder || !routedEmail) : !canMessageAccountEmail} onClick={() => setCompose('email')}><Mail size={16} />Send email</Button>}
          <Button size="sm" variant="ghost" disabled={!capabilities.edit || saving} onClick={() => {
            setSection('account')
            if (draft) return
            const initial = contactProfileDraft(account ? { first_name: name, phone, email } : person ?? {})
            setBaseline(initial); setDraft(initial); setProfileError(''); setStatus('')
          }}><Pencil size={14} />Edit Contact</Button>
        </div>
      </SlidePanelActionBar>
      <div style={{ overflowX: 'auto', flexShrink: 0, paddingInline: mobile ? spacing.lg : spacing.xl }}>
        <Tabs<Section> ariaLabel="Contact sections" compact={mobile} style={{ width: 'max-content', minWidth: '100%' }} activeKey={section} onChange={next => {
          setSection(next)
          if (next === 'funding' && !fundingLoaded) void loadFunding()
        }} items={[
          { key: 'account', label: 'Account' }, { key: 'notes', label: 'Notes' }, { key: 'schedule', label: 'Schedule & lessons' },
          { key: 'billing', label: 'Billing' }, { key: 'makeups', label: 'Makeups' }, ...(fundingAvailable ? [{ key: 'funding' as const, label: 'Funding Program' }] : []),
        ]} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: mobile ? spacing.lg : spacing.xl, background: colors.surfaceMuted }}>
        {section === 'account' ? <div style={stack}>
          <div style={{ display: 'grid', gap: spacing.lg, alignItems: 'start', gridTemplateColumns: wide ? 'minmax(0, 1.6fr) minmax(0, 1fr)' : 'minmax(0, 1fr)' }}>
            <div style={stack}>
              <DenseSectionPanel title="Contact details">
                {draft ? <form style={stack} noValidate onSubmit={event => { event.preventDefault(); void save() }}>
                  <FieldGrid>{CONTACT_PROFILE_FIELDS.filter(field => !account || field === 'first_name' || field === 'phone' || field === 'email').map(field => <Input key={field} label={account && field === 'first_name' ? 'Name' : labels[field]} name={field}
                    type={field === 'date_of_birth' ? 'date' : field === 'phone' ? 'tel' : field === 'email' ? 'email' : 'text'}
                    value={draft[field]} disabled={saving} onChange={event => setDraft({ ...draft, [field]: event.target.value })} />)}</FieldGrid>
                  {profileError && <div role="alert" style={{ color: colors.error }}>{profileError}</div>}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm }}>
                    <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => { setDraft(null); setProfileError('') }}>Cancel</Button>
                    <Button type="submit" size="sm" disabled={!dirty || saving || !capabilities.edit}>{saving ? 'Saving…' : 'Save changes'}</Button>
                  </div>
                </form> : <div style={stack}>
                  <FieldGrid>{[
                    showsAccount ? ['Dependents', String(students.length)] : null,
                    showsAccount ? ['Member since', formatMemberSince(memberSince)] : null,
                    ['Birthday', person?.date_of_birth ? formatMemberSince(person.date_of_birth) : 'Not added'],
                    ['Name', name.replace(/\s*\(account\)\s*$/i, '')], ['Phone', formatPhoneNumber(phone)], ['Email', email],
                  ].filter((row): row is [string, string | null] => Boolean(row)).map(([label, value]) => <div key={label} style={{ minWidth: 0 }}><FieldLabel>{label}</FieldLabel><FieldValue style={{ overflowWrap: 'anywhere' }}>{value || 'Not provided'}</FieldValue></div>)}</FieldGrid>
                </div>}
              </DenseSectionPanel>
              {showsAccount && students.map(student => <DenseSectionPanel key={student.id}
                title={personName(student) || 'Student'}
                actions={<Button size="sm" variant="secondary" aria-label={`Open ${personName(student) || 'student'}`} onClick={() => { if (canLeave()) onOpenStudent(student) }}>Open profile</Button>}
                contentStyle={stack}>
                {ageLabel(student.date_of_birth) && <div style={muted}>{ageLabel(student.date_of_birth)}</div>}
                {enrollmentLabel(student) && <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                  <span style={{ ...typography.body, color: colors.text }}>{enrollmentLabel(student)}</span>
                  {student.client_status && <StatusBadge status={student.client_status} size="sm" label={student.client_status.charAt(0).toUpperCase() + student.client_status.slice(1)} />}
                </div>}
                {planLabel(student) && <div style={{ ...typography.body, color: colors.text }}>{planLabel(student)}</div>}
                {scheduleLabel(student) && <div style={muted}>{scheduleLabel(student)}</div>}
                {student.instructor?.name && <div style={muted}>{student.instructor.name}</div>}
                <div style={muted}>Subscriptions and payments — Coming soon</div>
              </DenseSectionPanel>)}
            </div>
            <div style={stack}>
              <DenseSectionPanel title="Account Balance"><div style={muted}>Coming soon</div></DenseSectionPanel>
              <DenseSectionPanel title="Follow ups"><div style={muted}>Coming soon</div></DenseSectionPanel>
            </div>
          </div>
        </div> : section === 'notes' ? <DenseSectionPanel title={person ? `Notes for ${name}` : 'Notes'} contentStyle={stack}>
          {!person ? <div style={muted}>Coming soon</div> : !capabilities.readNotes ? <p>You don’t have permission to view notes.</p> : <>
            <Tabs<NoteKind> ariaLabel="Note types" activeKey={notesTab} onChange={next => { setNoteError(''); setNotesTab(next) }} items={[{ key: 'notes', label: 'Notes' }, { key: 'internal', label: 'Internal notes' }]} />
            {notesTab === 'internal' && <div style={{ ...typography.bodySmall, color: colors.textSecondary }}>Visible to staff only.</div>}
            {noteError && <div role="alert" style={{ color: colors.error }}>{noteError}</div>}
            {notes.length === 0 && <div style={{ ...typography.bodySmall, color: colors.textSecondary }}>No notes yet.</div>}
            <NotesSection key={notesTab} title={notesTab === 'internal' ? 'Internal notes' : 'Notes'} notes={notes} showHeader={false} saving={noteSaving}
              avatarInitial={notesTab === 'internal' ? 'T' : 'S'} avatarBg={colors.textMuted} cardBg={colors.surface} mentionsEnabled={notesTab === 'internal'} addLabel={notesTab === 'internal' ? 'Add internal note' : 'Add a note'}
              onSave={capabilities.editNotes ? (text, mention_membership_ids) => mutateNote('POST', { text, ...(notesTab === 'internal' ? { mention_membership_ids } : {}) }) : undefined}
              onToggleComplete={capabilities.editNotes ? async index => {
                const note = notes[index]
                if (note) await mutateNote('PATCH', { note_id: note.id, timestamp: note.timestamp })
              } : undefined} />
          </>}
        </DenseSectionPanel> : section === 'funding' ? (
          funding.loading ? <p role="status">Loading funding details…</p> : funding.error ? <DenseSectionPanel title="Funding Program" actions={<Button size="sm" onClick={() => void loadFunding()}>Retry</Button>}><p role="alert">{funding.error}</p></DenseSectionPanel>
            : funding.data ? <FundingContactDetails fundingCase={funding.data} embedded showBilling={false} onFundingDetailsUpdated={data => setFunding({ loading: false, data })} />
              : <EmptyState icon={<Landmark />} title="No funding program assigned" description="Funding authorization and coverage details appear here when this student is assigned to a funding program." />
        ) : <EmptyState icon={comingSoon.icon} title={comingSoon.title} description="Coming soon" />}
      </div>
    </>}
  </SlidePanel>
}