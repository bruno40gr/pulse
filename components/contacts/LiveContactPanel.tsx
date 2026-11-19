'use client'

import { useState } from 'react'
import { CalendarDays, CreditCard, Landmark, Mail, MessageSquare, Pencil, Phone, RotateCcw, UserRound } from 'lucide-react'
import type { Contact } from '@/app/dashboard/contacts/page'
import { Avatar, Button, DenseSectionPanel, DetailField, EmptyState, FieldGrid, Input, NotesSection, Select, SlidePanel, SlidePanelHeader, Tabs, Textarea, StatusBadge } from '@/components/ui'
import { ControlButton } from '@/components/ui/ControlButton'
import { AccountProfileLayout } from '@/beta-source/app/content-studio-prototype/students/AccountProfileLayout'
import { MetadataRow } from '@/beta-source/app/content-studio-prototype/students/MetadataRow'
import { SubscriptionCard } from '@/beta-source/app/content-studio-prototype/students/SubscriptionCard'
import { AccountProfileToolbar } from '@/beta-source/app/content-studio-prototype/students/AccountProfileToolbar'
import layoutStyles from '@/beta-source/app/content-studio-prototype/students/StudentWorkspace.module.css'
import { SectionTitle } from '@/components/ui/SectionTitle'
import CardSmsComposer from '@/components/inbox/CardSmsComposer'
import ContactBulkComposer from '@/components/inbox/ContactBulkComposer'
import ConversationComposeLink from '@/components/inbox/ConversationComposeLink'
import { FundingContactDetails } from '@/components/funding/FundingContactDetails'
import type { FundingCase } from '@/components/funding/types'
import { changedContactProfile, CONTACT_PROFILE_FIELDS, contactProfileDraft, type ContactProfileField } from '@/lib/contact-profile'
import { formatPhoneNumber } from '@/lib/phone'
import { usesAccountHolder } from '@/lib/contact-presentation'
import { colors, spacing, typography } from '@/lib/tokens'
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

export default function LiveContactPanel({ subject, tenantId, capabilities, initialNotesTab, startOnNotes, onClose, onUpdated, onAccountUpdated, onNotesUpdated, onOpenStudent, accountHolderLink }: {
  subject: Subject; tenantId: string; capabilities: ContactCapabilities
  initialNotesTab: NoteKind; startOnNotes?: boolean; onClose: () => void
  onUpdated: (person: Contact) => void; onNotesUpdated: (id: string, field: 'notes_history' | 'student_notes_history', notes: LiveContactNote[]) => void
  onAccountUpdated: (account: AccountContact) => void; onOpenStudent: (student: Contact) => void
  accountHolderLink?: { name: string; href: string; open: () => void }
}) {
  const mobile = useIsMobile()
  const person = subject.kind === 'account-holder' ? null : subject.person
  const account = subject.kind === 'account-holder' ? subject.account : null
  const students = subject.kind === 'student' ? [] : subject.students
  const memberSince = subject.kind === 'student' ? subject.person.account_member_since ?? null : subject.kind === 'holder' ? subject.memberSince : subject.account.memberSince
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
  const [comingSoonFeature, setComingSoonFeature] = useState<string | null>(null)
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
  const displayedEmail = holderRouting ? routedEmail : email
  const displayedPhone = formatPhoneNumber(callPhone)
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
      <SlidePanelHeader title={name.replace(/\s*\(account\)\s*$/i, '')} subtitle={subject.kind === 'student' ? 'Student profile' : 'Account manager'} titleSize={mobile ? typography.sizeLg : typography.size2xl}
        avatar={{ firstName: person?.first_name || name.split(' ')[0], lastName: person?.last_name || name.split(' ').slice(1).join(' '), size: mobile ? 36 : 48 }}
        badge={subject.kind === 'student' && person ? <StatusBadge status={person.opted_out ? 'spam' : person.client_status} label={person.opted_out ? 'Opted out' : person.client_status} /> : undefined}
        toast={status || undefined} onClose={close} />
      <AccountProfileToolbar mobile={mobile} communication={<>
          <Button aria-label="Call" disabled={!person || !callPhone || calling} onClick={() => void placeCall()}><Phone size={16} />{calling ? 'Calling…' : 'Call'} {displayedPhone}</Button>
          <Button aria-label="Send SMS" variant="secondary" disabled={person ? (!callPhone || (holderRouting && !canComposeToHolder)) : !canMessageAccountSms} onClick={() => setCompose('sms')}><MessageSquare size={16} />Send SMS {displayedPhone}</Button>
          {person && !holderRouting ? <ConversationComposeLink backDestination="contact" recipient={`person:${person.id}`} channel="email" disabled={!email} destination={email || undefined} />
            : <Button aria-label="Send email" variant="secondary" disabled={person ? (!canComposeToHolder || !routedEmail) : !canMessageAccountEmail} onClick={() => setCompose('email')}><Mail size={16} />Send email{displayedEmail && <span style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{displayedEmail}</span>}</Button>}
        </>} actions={<>
          <Button variant="ghost" disabled={!capabilities.edit || saving} onClick={() => {
            setSection('account')
            if (draft) return
            const initial = contactProfileDraft(account ? { first_name: name, phone, email } : person ?? {})
            setBaseline(initial); setDraft(initial); setProfileError(''); setStatus('')
          }}><Pencil size={14} />Edit Contact</Button>
          <ControlButton kind="icon" aria-label="Impersonate" title="Impersonate — Coming soon" onClick={() => setComingSoonFeature('Impersonate')}><UserRound size={16} aria-hidden="true" /></ControlButton>
        </>} />
      <div style={{ overflowX: 'auto', flexShrink: 0, paddingInline: mobile ? spacing.lg : spacing.xl }}>
        <Tabs<Section> ariaLabel="Contact sections" compact={mobile} style={{ width: 'max-content', minWidth: '100%' }} activeKey={section} onChange={next => {
          setSection(next)
          if (next === 'funding' && !fundingLoaded) void loadFunding()
        }} items={[
          { key: 'account', label: 'Account' }, { key: 'notes', label: 'Notes' }, { key: 'schedule', label: 'Schedule & lessons' },
          { key: 'billing', label: 'Billing' }, { key: 'makeups', label: 'Makeups' }, ...(fundingAvailable ? [{ key: 'funding' as const, label: 'Funding Program' }] : []),
        ]} />
      </div>
      <div className={layoutStyles.panelContent} style={{ background: colors.surfaceMuted }}>
        {section === 'account' ? <AccountProfileLayout details={<>
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
                </form> : <MetadataRow label="Contact details metadata">
                  {showsAccount ? <DetailField label="Dependents" value={String(students.length)} /> : <DetailField label="Account holder" value="Not added">
                    {accountHolderLink && <a href={accountHolderLink.href} style={{ color: colors.link }} onClick={event => {
                      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                      event.preventDefault()
                      if (canLeave()) accountHolderLink.open()
                    }}>{accountHolderLink.name}</a>}
                  </DetailField>}
                  <DetailField label="Member since" value={formatMemberSince(memberSince) || 'Not added'} />
                  <DetailField label="Birthday" value={formatMemberSince(person?.date_of_birth ?? null) || 'Not added'} />
                </MetadataRow>}
              </DenseSectionPanel>
              {(showsAccount ? students : person ? [person] : []).map(student => <DenseSectionPanel key={student.id}
                title={showsAccount ? <SectionTitle as="h3" variant="card"><ControlButton kind="name" onClick={() => { if (canLeave()) onOpenStudent(student) }}>{personName(student) || 'Student'}</ControlButton></SectionTitle> : 'Subscriptions'}
                actions={<Button onClick={() => setComingSoonFeature('Add subscription')}>Add subscription</Button>}
                contentStyle={stack}>
                {showsAccount && ageLabel(student.date_of_birth) && <div>{ageLabel(student.date_of_birth)}</div>}
                {student.profile_enrollments?.map(enrollment => {
                  const plan = enrollment.plan_name || enrollment.session_name
                  const duration = plan?.match(/\b(\d+)\s*min(?:ute)?s?\b/i)?.[1]
                  const schedule = [enrollment.lesson_day, enrollment.lesson_time].filter(Boolean).join(' at ')
                  const teacher = enrollment.instructor?.trim()
                  const label = enrollment.instrument || 'Subscription'
                  return <SubscriptionCard key={enrollment.id}
                    title={[label, duration ? `${duration} min` : null].filter(Boolean).join(' • ')}
                    actions={{ label: `${personName(student)} ${label} subscription actions`, onManage: () => setComingSoonFeature('Manage subscription') }}
                    detail={plan} schedule={schedule}
                    instructor={teacher && <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}><Avatar firstName={teacher.split(' ')[0]} lastName={teacher.split(' ').slice(1).join(' ')} size={28} />{teacher}</div>}
                    payment={<DetailField label="Payment method" value="Coming soon" />} />
                })}
                {!student.profile_enrollments?.length && <div style={muted}>No current subscriptions</div>}
              </DenseSectionPanel>)}
          </>} side={<>
              <DenseSectionPanel title="Account Balance" actions={<Button size="sm" variant="secondary" onClick={() => setSection('billing')}>View billing</Button>}>
                <div style={{ ...stack, gap: spacing.sm }}><strong>Coming soon</strong><DetailField label="Unpaid invoices" value="Coming soon" /><DetailField label="Next payment" value="Coming soon" /></div>
              </DenseSectionPanel>
              <DenseSectionPanel title="Follow ups" actions={<Button disabled>Update follow-up</Button>} contentStyle={stack}>
                <div style={muted}>Coming soon</div><Input label="Date" type="date" disabled /><Select label="Quick pick" disabled><option>Choose an interval</option></Select><Textarea label="Reminder note" disabled />
              </DenseSectionPanel>
          </>} /> : section === 'notes' ? <DenseSectionPanel title={person ? `Notes for ${name}` : 'Notes'} contentStyle={stack}>
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
    {comingSoonFeature && <SlidePanel isOpen onClose={() => setComingSoonFeature(null)} width="min(100vw, 420px)" fullScreen={mobile}>
      <SlidePanelHeader title={comingSoonFeature} onClose={() => setComingSoonFeature(null)} />
      <div style={{ padding: spacing.xl }}>Coming soon</div>
    </SlidePanel>}
  </SlidePanel>
}