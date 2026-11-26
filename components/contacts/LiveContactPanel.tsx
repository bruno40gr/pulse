'use client'

import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ContactFollowUps } from '@/components/follow-ups/ContactFollowUps'
import { useContext, useId, useState } from 'react'
import { ContactBandEnrollmentContext } from './ContactPrototypeContext'
import PrototypeContactSms from './PrototypeContactSms'
import { CalendarDays, CreditCard, ExternalLink, Landmark, Mail, MessageSquare, Pencil, Phone, RotateCcw, UserRound } from 'lucide-react'
import type { Contact } from '@/app/dashboard/contacts/page'
import { Avatar, Badge, Button, DenseSectionPanel, DetailField, EmptyState, NotesSection, SlidePanel, SlidePanelHeader, Tabs, StatusBadge } from '@/components/ui'
import { ContactRelationshipBadges } from './ContactRelationshipBadges'
import { ControlButton } from '@/components/ui/ControlButton'
import { AccountProfileLayout } from '@/beta-source/app/content-studio-prototype/students/AccountProfileLayout'
import { MetadataRow } from '@/beta-source/app/content-studio-prototype/students/MetadataRow'
import { SubscriptionCard } from '@/beta-source/app/content-studio-prototype/students/SubscriptionCard'
import { AccountProfileToolbar } from '@/beta-source/app/content-studio-prototype/students/AccountProfileToolbar'
import layoutStyles from '@/beta-source/app/content-studio-prototype/students/StudentWorkspace.module.css'
import { SectionTitle } from '@/components/ui/SectionTitle'
import LiveContactCommunication from './LiveContactCommunication'
import { ProfileComposerLayout, ProfileEntryActions } from '@/components/inbox/ProfileComposerLayout'
import { AccountEditorCanvas, type AccountEditorContact } from '@/beta-source/app/content-studio-prototype/students/AccountEditor'
import { InlineWorkspaceContext } from '@/beta-source/app/content-studio-prototype/students/InlineWorkspaceContext'
import { FundingContactDetails } from '@/components/funding/FundingContactDetails'
import type { FundingCase, FundingInvoice } from '@/components/funding/types'
import { changedContactProfile, contactProfileDraft, validateContactProfile } from '@/lib/contact-profile'
import { formatPhoneNumber } from '@/lib/phone'
import { usesAccountHolder } from '@/lib/contact-presentation'
import { colors, spacing, typography } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'
import { LiveFamilyManagement } from './LiveFamilyManagement'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { LessonSummary } from '@/components/ui/LessonSummary'
import { displayAccountHolders, type DisplayAccountHolder } from '@/lib/family-account'
import { profileFamilyMembers } from '@/lib/profile-family-members'
import { FieldLabel } from '@/components/ui/FieldLabel'
import { FieldValue } from '@/components/ui/FieldValue'

export type AccountContact = { id: string; name: string; phone: string | null; email: string | null; memberSince: string | null }
type Subject =
  | { kind: 'student'; person: Contact }
  | { kind: 'holder'; person: Contact; students: Contact[]; memberSince: string | null }
  | { kind: 'account-holder'; account: AccountContact; students: Contact[] }
export type ContactCapabilities = { edit: boolean; readNotes: boolean; editNotes: boolean }
type NoteKind = 'notes' | 'internal'
export type LiveContactNote = { id?: string; text: string; timestamp: string; actor_name?: string | null; completed_at?: string | null }
type Section = 'account' | 'notes' | 'schedule' | 'billing' | 'makeups' | 'funding' | 'enrollments'
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

export default function LiveContactPanel({ subject, tenantId, capabilities, initialNotesTab, startOnNotes, onClose, onUpdated, onAccountUpdated, onNotesUpdated, onOpenStudent, onOpenPerson, onOpenAccount, familyPeople, onFamilyChanged, accountHolders, onCompose, navigationError, openingContact, initialSection, fundingCase, onFundingCaseUpdated, onInvoiceStatusChange, fundingOnly = false, simulated = false }: {
  initialSection?: 'account' | 'funding' | 'schedule' | 'billing' | 'enrollments'
  /** Fictional Contacts can update local state, never operational services. */
  simulated?: boolean
  fundingCase?: FundingCase
  onFundingCaseUpdated?: (updated: FundingCase) => void
  onInvoiceStatusChange?: (invoice: FundingInvoice) => void
  /** Isolated fictional funding cases: never expose operational contact actions. */
  fundingOnly?: boolean
  navigationError?: string
  openingContact?: boolean
  onOpenPerson?: (id: string) => void
  familyPeople?: Contact[]
  onOpenAccount?: (id: string) => void
  onCompose?: (channel: 'sms' | 'email') => void
  accountHolders?: (DisplayAccountHolder & { id: string })[]
  onFamilyChanged?: () => void
  subject: Subject; tenantId: string; capabilities: ContactCapabilities
  initialNotesTab: NoteKind; startOnNotes?: boolean; onClose: () => void
  onUpdated: (person: Contact) => void; onNotesUpdated: (id: string, field: 'notes_history' | 'student_notes_history', notes: LiveContactNote[]) => void
  onAccountUpdated: (account: AccountContact) => void; onOpenStudent: (student: Contact) => void
  accountHolderLink?: { name: string; href: string; open: () => void }
}) {
  const mobile = useIsMobile()
  const bandEnrollments = useContext(ContactBandEnrollmentContext)
  const person = subject.kind === 'account-holder' ? null : subject.person
  const account = subject.kind === 'account-holder' ? subject.account : null
  const isInstructor = !!person && (!!person.staff_id || person.custom_fields?.contact_kind === 'instructor')
  const students = subject.kind === 'student' ? [] : subject.students
  const visibleHolders = accountHolders ?? displayAccountHolders(subject.kind === 'student' ? [subject.person] : students)
  const familyMembers = profileFamilyMembers(familyPeople ?? [...students, ...(person ? [person] : [])], visibleHolders, tenantId, person?.id, account?.id)
  const familyId = account?.id || students[0]?.family_account_id || students[0]?.account_id || person?.family_account_id || person?.account_id
  const memberSince = subject.kind === 'student' ? subject.person.account_member_since ?? null : subject.kind === 'holder' ? subject.memberSince : subject.account.memberSince
  const showsAccount = subject.kind !== 'student'
  const name = account ? account.name : person ? personName(person) : ''
  const phone = account ? account.phone : person?.phone ?? null
  const email = account ? account.email : person?.email ?? null
  const [section, setSection] = useState<Section>(fundingOnly ? 'funding' : startOnNotes ? 'notes' : initialSection || 'account')
  const [notesTab, setNotesTab] = useState(initialNotesTab)
  const [editing, setEditing] = useState(false)
  const [editorDirty, setEditorDirty] = useState(false)
  const [discardTarget, setDiscardTarget] = useState<'editor' | 'panel' | null>(null)
  const editorFormId = useId()
  const [addingStudent, setAddingStudent] = useState(false)
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [noteError, setNoteError] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [calling, setCalling] = useState(false)
  const [visitedChannels, setVisitedChannels] = useState({ email: false, sms: false })
  const [compose, setCompose] = useState<'sms' | 'email' | null>(null)
  const [status, setStatus] = useState('')
  const [comingSoonFeature, setComingSoonFeature] = useState<string | null>(null)
  const [funding, setFunding] = useState<{ loading: boolean; data?: FundingCase; error?: string }>({ loading: false })
  const [fundingLoaded, setFundingLoaded] = useState(Boolean(fundingCase))
  const visibleFunding = fundingCase ?? funding.data
  const updateFunding = (updated: FundingCase) => {
    setFunding({ loading: false, data: updated })
    onFundingCaseUpdated?.(updated)
  }
  const tenantQuery = `tenant=${encodeURIComponent(tenantId)}`
  const endpoint = person && `/api/contacts/${encodeURIComponent(person.id)}`
  const fundingAvailable = person?.is_student === true || (!isInstructor && subject.kind === 'student')
  const holderRouting = !isInstructor && !!person && (usesAccountHolder(person) || under18(person.date_of_birth))
  // Bulk delivery uses the saved student routing columns, not DOB or display fields.
  const canComposeToHolder = holderRouting && !!person && (person.is_minor === true || person.message_routing === 'account_holder')
  const primaryHolder = person?.account_holders?.find(holder => holder.is_primary) || person?.account_holders?.[0]
  const callPhone = holderRouting ? primaryHolder?.phone || person?.account_holder_phone : phone
  const routedEmail = primaryHolder?.email || person?.account_holder_email
  const displayedEmail = holderRouting ? routedEmail : email
  const displayedPhone = formatPhoneNumber(callPhone)
  // An account has no person row; message it through the students whose saved routing targets the account holder.
  const accountRecipients = account ? students.filter(student => student.account_id === account.id
    && (student.is_minor === true || student.message_routing === 'account_holder')) : []
  const canMessageAccountSms = Boolean(account) && accountRecipients.length > 0 && Boolean(phone)
  const canMessageAccountEmail = Boolean(account) && accountRecipients.length > 0 && Boolean(email)
  const notesField = notesTab === 'internal' ? 'notes_history' : 'student_notes_history'
  const notes = person?.[notesField] ?? []
  const canLeave = () => !saving && !noteSaving && (!editing || !editorDirty)
  const leaveEditor = (target: 'editor' | 'panel') => {
    if (saving || noteSaving) return
    if (editing && editorDirty) { setDiscardTarget(target); return }
    setEditing(false)
    setEditorDirty(false)
    if (target === 'panel') onClose()
  }
  const editorPeople = [...new Map([...(person ? [person] : []), ...(showsAccount ? students : [])].map(item => [item.id, item])).values()]
  const editorContacts: AccountEditorContact[] = [...(account ? [{ id: `account:${account.id}`, accountRecord: true, firstName: account.name, lastName: '', email: account.email || '', phone: account.phone || '', birthday: '' }] : []),
    ...editorPeople.map(item => ({ id: item.id, firstName: item.first_name || '', lastName: item.last_name || '', email: item.email || '', phone: item.phone || '', birthday: item.date_of_birth || '' }))]
  const save = async (drafts: AccountEditorContact[], markSaved: (id: string) => void) => {
    if (!capabilities.edit || saving) return 'You cannot edit these contacts.'
    const changes = []
    for (const draft of drafts) {
      const original = editorContacts.find(item => item.id === draft.id)
      if (!original) return 'Contact is no longer available.'
      const fields = (item: AccountEditorContact) => contactProfileDraft({ first_name: item.firstName, last_name: item.lastName, phone: item.phone, email: item.email, date_of_birth: item.birthday })
      const diff = changedContactProfile(fields(original), fields(draft))
      if (!Object.keys(diff).length) continue
      const result = validateContactProfile(diff)
      if (!result.ok) return `${original.firstName} ${original.lastName}`.trim() + `: ${result.error}`
      const accountTarget = original.accountRecord ? account : null
      const personTarget = editorPeople.find(item => item.id === original.id)
      if (!accountTarget && !personTarget) return 'Contact is no longer available.'
      const { first_name: accountName, ...rest } = diff
      changes.push({ id: draft.id, accountTarget, personTarget, payload: accountTarget ? { ...rest, ...(accountName !== undefined ? { name: accountName } : {}) } : diff })
    }
    setSaving(true)
    let savedCount = 0
    try {
      for (const { id, accountTarget, personTarget, payload } of changes) {
        if (simulated) {
          if (accountTarget) onAccountUpdated({ ...accountTarget, ...payload })
          else if (personTarget) onUpdated({ ...personTarget, ...payload, first_name: payload.first_name ?? personTarget.first_name, last_name: payload.last_name ?? personTarget.last_name })
          markSaved(id)
          savedCount++
          continue
        }
        const path = accountTarget ? `accounts/${encodeURIComponent(accountTarget.id)}` : encodeURIComponent(personTarget!.id)
        const response = await fetch(`/api/contacts/${path}/profile?${tenantQuery}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(payload) })
        const saved = await response.json()
        if (!response.ok || saved?.id !== (accountTarget?.id ?? personTarget?.id)) throw new Error(saved?.error || 'Could not save contact details.')
        if (accountTarget) onAccountUpdated({ ...accountTarget, name: saved.name, phone: saved.phone, email: saved.email })
        else if (personTarget) onUpdated({ ...personTarget, first_name: saved.first_name, last_name: saved.last_name, phone: saved.phone, email: saved.email, date_of_birth: saved.date_of_birth })
        markSaved(id)
        savedCount++
      }
      if (savedCount) setStatus('Contact details saved.')
      return null
    } catch (error) { return `${savedCount ? `${savedCount} contact(s) saved. ` : ''}${message(error, 'Could not save contact details.')}` }
    finally { setSaving(false) }
  }

  const mutateNote = async (method: 'POST' | 'PATCH', body: { text?: string; note_id?: string; timestamp?: string }) => {
    if (!person || !endpoint || !capabilities.editNotes || noteSaving) return false
    if (simulated) {
      const timestamp = new Date().toISOString()
      onNotesUpdated(person.id, notesField, method === 'POST'
        ? [...notes, { id: crypto.randomUUID(), text: body.text || '', timestamp }]
        : notes.map(note => (body.note_id ? note.id === body.note_id : note.timestamp === body.timestamp)
          ? { ...note, completed_at: note.completed_at ? null : timestamp } : note))
      return true
    }
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
    if (!person || funding.loading || fundingOnly || simulated) return
    setFundingLoaded(true)
    setFunding({ loading: true })
    try {
      const response = await fetch(`/api/funding/cases?${tenantQuery}&student_person_id=${encodeURIComponent(person.id)}`)
      const result = await response.json()
      if (!response.ok || !Array.isArray(result)) throw new Error(result?.error || 'Could not load funding details.')
      setFunding({ loading: false, data: result[0] })
    } catch (error) { setFunding({ loading: false, error: message(error, 'Could not load funding details.') }) }
  }

  const changeStaffStatus = async () => {
    if (!isInstructor || !person || !capabilities.edit || saving) return
    const nextActive = person.is_active === false
    if (!nextActive && !window.confirm('Sunset this instructor? They will no longer be able to sign in or be messaged.')) return
    if (simulated) { onUpdated({ ...person, is_active: nextActive }); return }
    setSaving(true)
    setStatus('')
    try {
      const response = await fetch(`${endpoint}?${tenantQuery}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ is_active: nextActive }) })
      const saved = await response.json()
      if (!response.ok || saved?.id !== person.id || saved.is_active !== nextActive) throw new Error(saved?.error || 'Could not update instructor status.')
      onUpdated({ ...person, ...saved })
      setStatus(nextActive ? 'Instructor reactivated.' : 'Instructor sunset.')
    } catch (error) { setStatus(message(error, 'Could not update instructor status.')) }
    finally { setSaving(false) }
  }

  const placeCall = async () => {
    if (!person || !callPhone || calling || simulated) return
    setCalling(true)
    try {
      const response = await fetch(`/api/calls?${tenantQuery}`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ to_phone: callPhone, contact_id: person.id }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || 'Could not place call.')
      setStatus('Call placed.')
    } catch (error) { setStatus(message(error, 'Could not place call.')) }
    finally { setCalling(false) }
  }

  const close = () => { if (compose) setCompose(null); else leaveEditor('panel') }
  const stack = { display: 'grid', gap: spacing.lg, minWidth: 0 }
  const comingSoon = section === 'schedule' ? { icon: <CalendarDays />, title: 'Schedule & lessons' }
    : section === 'billing' ? { icon: <CreditCard />, title: 'Billing' } : { icon: <RotateCcw />, title: 'Makeups' }

  return <SlidePanel isOpen onClose={close} closeOnBackdrop={!editing} closeOnEscape={!editing} fullScreen={mobile} width="65dvw">
      <ProfileComposerLayout profileWidth="65dvw" open={!!compose} onCancel={() => setCompose(null)} header={
      <SlidePanelHeader title={editing ? 'Edit Contact' : name.replace(/\s*\(account\)\s*$/i, '')} subtitle={editing ? name : isInstructor ? 'Instructor profile' : subject.kind === 'student' ? 'Student profile' : 'Account manager'} titleSize={mobile ? typography.sizeLg : typography.size2xl}
        actions={editing ? <><Button variant="secondary" disabled={saving} onClick={() => leaveEditor('editor')}>Cancel</Button><Button type="submit" form={editorFormId} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button></> : undefined}
        avatar={{ firstName: person?.first_name || name.split(' ')[0], lastName: person?.last_name || name.split(' ').slice(1).join(' '), size: mobile ? 36 : 48 }}
        badge={person ? <><ContactRelationshipBadges contact={person} />{isInstructor && <Badge size="sm" variant="info">Instructor</Badge>}{isInstructor && person.is_active === false && <StatusBadge status="sunset" label="Sunset" />}{person.opted_out && <StatusBadge status="spam" label="Opted out" />}</> : undefined}
        toast={status || undefined} onClose={close} />} profile={<>

      {!editing && <>{!fundingOnly && <ProfileEntryActions><AccountProfileToolbar mobile={mobile} singleRow communication={<>
          <Button aria-label="Call" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} disabled={simulated || !person || !callPhone || calling} onClick={() => void placeCall()}><Phone size={16} />{calling ? 'Calling…' : 'Call'} {displayedPhone}</Button>
          <Button aria-label="Send SMS" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} variant="secondary" disabled={saving || (person ? (!callPhone || (holderRouting && !canComposeToHolder)) : !canMessageAccountSms)} onClick={() => { if (canLeave()) { if (onCompose) { onCompose('sms'); return } setEditing(false); setVisitedChannels(current => ({ ...current, sms: true })); setCompose('sms') } }}><MessageSquare size={16} />SMS {displayedPhone}</Button>
          <Button aria-label="Send email" style={{ minWidth: 0, flex: '0 1 auto', overflow: 'hidden', whiteSpace: 'nowrap' }} title={displayedEmail || undefined} variant="secondary" disabled={simulated || saving || (person ? (!displayedEmail || (holderRouting && !canComposeToHolder)) : !canMessageAccountEmail)} onClick={() => { if (canLeave()) { if (onCompose) { onCompose('email'); return } setEditing(false); setVisitedChannels(current => ({ ...current, email: true })); setCompose('email') } }}><Mail size={16} style={{ flexShrink: 0 }} />Email{displayedEmail && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{displayedEmail}</span>}</Button>
        </>} actions={<>
          <Button variant="ghost" disabled={!capabilities.edit || saving} onClick={() => { setSection('account'); setEditing(true); setStatus('') }}><Pencil size={14} />Edit Contact</Button>
          <Button variant="ghost" aria-label="Impersonate" title="Impersonate — Coming soon" onClick={() => setComingSoonFeature('Impersonate')}><UserRound size={16} aria-hidden="true" />Impersonate</Button>
        </>} /></ProfileEntryActions>}
      <div style={{ overflowX: 'auto', flexShrink: 0, paddingInline: mobile ? spacing.lg : spacing.xl }}>
        <Tabs<Section> ariaLabel="Contact sections" compact={mobile} style={{ width: 'max-content', minWidth: '100%', minHeight: compose && !mobile ? 'var(--profile-toolbar-height, 64px)' : undefined, boxSizing: 'border-box', alignItems: 'stretch' }} activeKey={section} onChange={next => {
          if (next === section || !canLeave()) return
          setEditing(false)
          setSection(next)
          if (next === 'funding' && !fundingLoaded) void loadFunding()
        }} items={fundingOnly ? [{ key: 'funding', label: 'Funding Program' }, { key: 'billing', label: 'Billing' }] : [
          { key: 'account', label: 'Account' }, { key: 'notes', label: 'Notes' }, { key: 'schedule', label: 'Schedule & lessons' },
          { key: 'billing', label: 'Billing' }, { key: 'makeups', label: 'Makeups' }, ...(fundingAvailable ? [{ key: 'funding' as const, label: 'Funding Program' }] : []),
          ...(bandEnrollments && person ? [{ key: 'enrollments' as const, label: 'Enrollments' }] : []),
        ]} />
      </div></>}
      <div className={layoutStyles.panelContent} style={{ background: colors.surfaceMuted }}>
        {navigationError && <p role="alert" style={{ color: colors.error }}>{navigationError}</p>}
        {openingContact && <LoadingSkeleton label="Loading linked contact" />}
        {editing && section === 'account' ? <InlineWorkspaceContext.Provider value={true}>
          <AccountEditorCanvas embedded formId={editorFormId} contacts={editorContacts} holderId={showsAccount ? editorContacts[0]?.id : undefined} accountName={name} studentOnly={!showsAccount} onSave={save} onDirtyChange={setEditorDirty} onBack={() => { setEditorDirty(false); setEditing(false) }}
            family={!simulated && capabilities.edit && <LiveFamilyManagement tenantId={tenantId} accountId={familyId}
              personId={subject.kind === 'student' ? person?.id : undefined} onChanged={onFamilyChanged} />} />
        </InlineWorkspaceContext.Provider> : section === 'account' ? <AccountProfileLayout details={<>
              {isInstructor && <DenseSectionPanel title="Instructor" actions={capabilities.edit ? <Button size="sm" variant="secondary" disabled={saving} onClick={() => void changeStaffStatus()}>{saving ? 'Saving…' : person?.is_active === false ? 'Reactivate instructor' : 'Sunset / offboard'}</Button> : undefined}>
                <DetailField label="Status" value={person?.is_active === false ? 'Sunset' : 'Active'} />
              </DenseSectionPanel>}
              {isInstructor && <DenseSectionPanel title={`Active students (${person?.active_students?.length || 0})`} contentStyle={stack}>
                {!person?.active_students?.length ? <div style={muted}>No active students are currently subscribed to this instructor.</div> : person.active_students.map(student => <div key={student.enrollment_id}>
                  <FieldValue><a href={`/dashboard/contacts?contact=${encodeURIComponent(student.person_id)}`} style={{ color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: spacing.xs, textDecoration: 'none' }} onClick={event => {
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !onOpenPerson) return
                    event.preventDefault()
                    if (canLeave()) onOpenPerson(student.person_id)
                  }}>{student.name}<ExternalLink size={14} aria-hidden="true" /></a></FieldValue>
                  <FieldLabel>{[student.instrument, student.service_type, student.lesson_day, student.lesson_time].filter(Boolean).join(' · ')}</FieldLabel>
                  <ContactRelationshipBadges contact={{ is_student: true, client_status: student.client_status }} />
                </div>)}
              </DenseSectionPanel>}
              {familyMembers.length > 0 && <DenseSectionPanel title="Family members" actions={!simulated && showsAccount && capabilities.edit && !addingStudent ? <Button size="sm" variant="secondary" disabled={!familyId} onClick={() => setAddingStudent(true)}>Add student</Button> : undefined}>
                <div style={stack}>{familyMembers.map(member => <div key={member.id}>
                  <FieldValue><a href={`/dashboard/contacts?${member.person ? `contact=${encodeURIComponent(member.person.id)}` : `account=${encodeURIComponent(member.accountId!)}`}`} style={{ color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: spacing.xs, maxWidth: '100%', textDecoration: 'none' }} onClick={event => {
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                    if (member.person || onOpenAccount) {
                      event.preventDefault()
                      if (canLeave()) { if (member.person) { if (onOpenPerson) onOpenPerson(member.person.id); else onOpenStudent(member.person) } else onOpenAccount?.(member.accountId!) }
                    }
                  }}><span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{member.name}</span><ExternalLink size={14} style={{ flexShrink: 0 }} aria-hidden="true" /></a></FieldValue>
                  <FieldLabel>{[member.holder ? 'Account holder' : '', member.student ? 'Student' : ''].filter(Boolean).join(' · ')}</FieldLabel>
                </div>)}</div>
              </DenseSectionPanel>}
              <DenseSectionPanel title="Contact details" actions={!simulated && showsAccount && familyMembers.length === 0 && capabilities.edit && !addingStudent ? <Button size="sm" variant="secondary" disabled={!familyId} onClick={() => setAddingStudent(true)}>Add student</Button> : undefined}>
                <MetadataRow label="Contact details metadata">
                  <DetailField label="Member since" value={formatMemberSince(memberSince) || 'Not added'} />
                  <DetailField label="Birthday" value={formatMemberSince(person?.date_of_birth ?? null) || 'Not added'} />
                </MetadataRow>
              </DenseSectionPanel>
              {!simulated && showsAccount && capabilities.edit && addingStudent && <LiveFamilyManagement tenantId={tenantId}
                accountId={familyId} addStudentOnly
                onCancel={() => setAddingStudent(false)} onChanged={() => { setAddingStudent(false); onFamilyChanged?.() }} />}
              {(showsAccount ? students : person && (!isInstructor || person.is_student) ? [person] : []).map(student => <DenseSectionPanel key={student.id}
                title={showsAccount ? <SectionTitle as="h2"><ControlButton kind="name" style={{ fontSize: 'inherit', fontWeight: 'inherit' }} onClick={() => { if (canLeave()) onOpenStudent(student) }}>{personName(student) || 'Student'}</ControlButton></SectionTitle> : 'Subscriptions'}
                actions={<Button size="sm" variant="secondary" onClick={() => setComingSoonFeature('Add subscription')}>Add subscription</Button>}
                contentStyle={stack}>
                {showsAccount && ageLabel(student.date_of_birth) && <div>{ageLabel(student.date_of_birth)}</div>}
                {student.profile_enrollments?.map(enrollment => {
                  const plan = enrollment.plan_name || enrollment.session_name
                  const schedule = [enrollment.lesson_day, enrollment.lesson_time].filter(Boolean).join(' at ')
                  const teacher = enrollment.instructor?.trim()
                  const label = enrollment.instrument || 'Subscription'
                  return <SubscriptionCard key={enrollment.id}
                    title={<LessonSummary part="identity" instrument={label} level={enrollment.level} plan={plan} />}
                    actions={{ label: `${personName(student)} ${label} subscription actions`, onManage: () => setComingSoonFeature('Manage subscription') }}
                    detail={<LessonSummary part="details" format={enrollment.service_type} duration={enrollment.duration} plan={plan} />} schedule={schedule}
                    instructor={teacher ? <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}><Avatar firstName={teacher.split(' ')[0]} lastName={teacher.split(' ').slice(1).join(' ')} size={28} />{enrollment.instructor_person_id && onOpenPerson ? <ControlButton kind="name" onClick={() => { if (canLeave()) onOpenPerson(enrollment.instructor_person_id!) }}>{teacher}</ControlButton> : teacher}</div> : <div style={muted}>Current teacher needs verification</div>}
                    payment={<DetailField label="Payment method" value="Coming soon" />} />
                })}
                {!student.profile_enrollments?.length && <div style={muted}>No current subscriptions</div>}
              </DenseSectionPanel>)}
          </>} side={<>
              <DenseSectionPanel title="Account Balance" actions={<Button size="sm" variant="secondary" onClick={() => setSection('billing')}>View billing</Button>}>
                <div style={{ ...stack, gap: spacing.sm }}><strong>Coming soon</strong><DetailField label="Unpaid invoices" value="Coming soon" /><DetailField label="Next payment" value="Coming soon" /></div>
              </DenseSectionPanel>
              {!simulated && (showsAccount && familyId
                ? <ContactFollowUps accountId={familyId} tenantId={tenantId} name={name} canEdit={capabilities.edit} onChanged={() => onFamilyChanged?.()} />
                : person && <ContactFollowUps personId={person.id} tenantId={tenantId} name={name} canEdit={capabilities.edit} onChanged={() => onFamilyChanged?.()} />)}
              {!simulated && showsAccount && familyId && person && <ContactFollowUps personId={person.id} tenantId={tenantId}
                name={`${name} (individual)`} canEdit={capabilities.edit} onChanged={() => onFamilyChanged?.()} />}
          </>} /> : section === 'enrollments' && bandEnrollments && person ? bandEnrollments(person.id) : section === 'notes' ? <DenseSectionPanel title={person ? `Notes for ${name}` : 'Notes'} contentStyle={stack}>
          {!person ? <div style={muted}>Coming soon</div> : !capabilities.readNotes ? <p>You don’t have permission to view notes.</p> : <>
            <Tabs<NoteKind> ariaLabel="Note types" activeKey={notesTab} onChange={next => { setNoteError(''); setNotesTab(next) }} items={[{ key: 'notes', label: 'Notes' }, { key: 'internal', label: 'Internal notes' }]} />
            {notesTab === 'internal' && <div style={{ ...typography.bodySmall, color: colors.textSecondary }}>Visible to staff only.</div>}
            {noteError && <div role="alert" style={{ color: colors.error }}>{noteError}</div>}
            {notes.length === 0 && <div style={{ ...typography.bodySmall, color: colors.textSecondary }}>No notes yet.</div>}
            <NotesSection key={notesTab} title={notesTab === 'internal' ? 'Internal notes' : 'Notes'} notes={notes} showHeader={false} saving={noteSaving}
              avatarInitial={notesTab === 'internal' ? 'T' : 'S'} avatarBg={colors.textMuted} cardBg={colors.surface} mentionsEnabled={!simulated && notesTab === 'internal'} addLabel={notesTab === 'internal' ? 'Add internal note' : 'Add a note'}
              onSave={capabilities.editNotes ? (text, mention_membership_ids) => mutateNote('POST', { text, ...(notesTab === 'internal' ? { mention_membership_ids } : {}) }) : undefined}
              onToggleComplete={capabilities.editNotes ? async index => {
                const note = notes[index]
                if (note) await mutateNote('PATCH', { note_id: note.id, timestamp: note.timestamp })
              } : undefined} />
          </>}
        </DenseSectionPanel> : section === 'funding' ? (
          funding.loading ? <LoadingSkeleton label="Loading funding details" /> : funding.error ? <DenseSectionPanel title="Funding Program" actions={<Button size="sm" onClick={() => void loadFunding()}>Retry</Button>}><p role="alert">{funding.error}</p></DenseSectionPanel>
            : visibleFunding ? <FundingContactDetails fundingCase={visibleFunding} embedded showBilling={false} onFundingDetailsUpdated={updateFunding} />
              : <EmptyState icon={<Landmark />} title="No funding program assigned" description="Funding authorization and coverage details appear here when this student is assigned to a funding program." />
        ) : section === 'billing' && visibleFunding ? <FundingContactDetails fundingCase={visibleFunding} embedded sections="billing" onInvoiceStatusChange={onInvoiceStatusChange} onFundingDetailsUpdated={updateFunding} /> : <EmptyState icon={comingSoon.icon} title={comingSoon.title} description="Coming soon" />}
      </div>
      </>} composer={<>
        {(['email', 'sms'] as const).map(channel => visitedChannels[channel] && <div key={channel} hidden={compose !== channel} className={layoutStyles.communicationContent} style={{ display: compose === channel ? 'flex' : 'none', flex: 1, minHeight: 0, minWidth: 0, background: colors.surface }}>
          {simulated ? person && channel === 'sms' && <PrototypeContactSms subject={person}
            recipientId={primaryHolder?.person_id || person.id} recipientName={primaryHolder?.name || name} phone={callPhone || null}
            holders={holderRouting ? (person.account_holders ?? []).flatMap(holder => holder.person_id ? [{ ...holder, person_id: holder.person_id, name: holder.name || 'Account holder' }] : []) : []} onBack={() => setCompose(null)} onClose={close} />
            : <LiveContactCommunication active={compose === channel} tenantId={tenantId} channel={channel} contactIds={account ? accountRecipients.map(student => student.id) : person ? [person.id] : []}
              destination={(channel === 'sms' ? callPhone : displayedEmail) || ''} name={name} drafts={messageDrafts} onDraft={(key, value) => setMessageDrafts(current => ({ ...current, [key]: value }))} />}
        </div>)}
      </>} />
    <Modal isOpen={discardTarget !== null} onClose={() => setDiscardTarget(null)} size="sm" layout="content" ariaLabel="Discard contact changes">
      <ModalHeader title="Discard unsaved changes?" onClose={() => setDiscardTarget(null)} />
      <ModalBody>Your unsaved contact edits will be lost. Family changes already saved are not affected.</ModalBody>
      <ModalFooter><Button variant="secondary" onClick={() => setDiscardTarget(null)}>Keep editing</Button><Button variant="destructive" onClick={() => {
        const target = discardTarget
        setDiscardTarget(null)
        setEditorDirty(false)
        setEditing(false)
        if (target === 'panel') onClose()
      }}>Discard changes</Button></ModalFooter>
    </Modal>
    {comingSoonFeature && <SlidePanel isOpen onClose={() => setComingSoonFeature(null)} width="min(100vw, 420px)" fullScreen={mobile}>
      <SlidePanelHeader title={comingSoonFeature} onClose={() => setComingSoonFeature(null)} />
      <div style={{ padding: spacing.xl }}>Coming soon</div>
    </SlidePanel>}
  </SlidePanel>
}