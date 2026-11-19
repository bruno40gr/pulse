'use client'

import { useState } from 'react'
import { CalendarDays, CreditCard, Landmark, Mail, MessageSquare, Pencil, Phone, RotateCcw, UserRound } from 'lucide-react'
import type { Contact } from '@/app/dashboard/contacts/page'
import { Avatar, Button, DenseSectionPanel, DetailField, EmptyState, Input, NotesSection, Select, SlidePanel, SlidePanelHeader, Tabs, Textarea, StatusBadge } from '@/components/ui'
import { ControlButton } from '@/components/ui/ControlButton'
import { AccountProfileLayout } from '@/beta-source/app/content-studio-prototype/students/AccountProfileLayout'
import { MetadataRow } from '@/beta-source/app/content-studio-prototype/students/MetadataRow'
import { SubscriptionCard } from '@/beta-source/app/content-studio-prototype/students/SubscriptionCard'
import { AccountProfileToolbar } from '@/beta-source/app/content-studio-prototype/students/AccountProfileToolbar'
import layoutStyles from '@/beta-source/app/content-studio-prototype/students/StudentWorkspace.module.css'
import { SectionTitle } from '@/components/ui/SectionTitle'
import LiveContactCommunication from './LiveContactCommunication'
import { AccountEditorCanvas, type AccountEditorContact } from '@/beta-source/app/content-studio-prototype/students/AccountEditor'
import { InlineWorkspaceContext } from '@/beta-source/app/content-studio-prototype/students/InlineWorkspaceContext'
import { FundingContactDetails } from '@/components/funding/FundingContactDetails'
import type { FundingCase } from '@/components/funding/types'
import { changedContactProfile, contactProfileDraft, validateContactProfile } from '@/lib/contact-profile'
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
  const [editing, setEditing] = useState(false)
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
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
  const canLeave = () => !saving && !noteSaving && (!editing || window.confirm('Discard unsaved contact changes?'))
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
      <SlidePanelHeader title={name.replace(/\s*\(account\)\s*$/i, '')} subtitle={subject.kind === 'student' ? 'Student profile' : 'Account manager'} titleSize={mobile ? typography.sizeLg : typography.size2xl}
        avatar={{ firstName: person?.first_name || name.split(' ')[0], lastName: person?.last_name || name.split(' ').slice(1).join(' '), size: mobile ? 36 : 48 }}
        badge={subject.kind === 'student' && person ? <StatusBadge status={person.opted_out ? 'spam' : person.client_status} label={person.opted_out ? 'Opted out' : person.client_status} /> : undefined}
        toast={status || undefined} onClose={close} onBack={compose ? () => setCompose(null) : undefined} backLabel="Back to contact" />
      {compose ? <div className={`${layoutStyles.panelContent} ${layoutStyles.communicationContent}`} style={{ background: colors.surfaceMuted }}>
        <LiveContactCommunication key={compose} tenantId={tenantId} channel={compose} contactIds={account ? accountRecipients.map(student => student.id) : person ? [person.id] : []}
          destination={(compose === 'sms' ? callPhone : displayedEmail) || ''} name={name} drafts={messageDrafts} onDraft={(key, value) => setMessageDrafts(current => ({ ...current, [key]: value }))} />
      </div> : <>
      <AccountProfileToolbar mobile={mobile} communication={<>
          <Button aria-label="Call" disabled={!person || !callPhone || calling} onClick={() => void placeCall()}><Phone size={16} />{calling ? 'Calling…' : 'Call'} {displayedPhone}</Button>
          <Button aria-label="Send SMS" variant="secondary" disabled={saving || (person ? (!callPhone || (holderRouting && !canComposeToHolder)) : !canMessageAccountSms)} onClick={() => { if (canLeave()) { setEditing(false); setCompose('sms') } }}><MessageSquare size={16} />Send SMS {displayedPhone}</Button>
          <Button aria-label="Send email" variant="secondary" disabled={saving || (person ? !displayedEmail || (holderRouting && !canComposeToHolder) : !canMessageAccountEmail)} onClick={() => { if (canLeave()) { setEditing(false); setCompose('email') } }}><Mail size={16} />Send email{displayedEmail && <span style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{displayedEmail}</span>}</Button>
        </>} actions={<>
          <Button variant="ghost" disabled={!capabilities.edit || saving} onClick={() => { setSection('account'); setEditing(true); setStatus('') }}><Pencil size={14} />Edit Contact</Button>
          <ControlButton kind="icon" aria-label="Impersonate" title="Impersonate — Coming soon" onClick={() => setComingSoonFeature('Impersonate')}><UserRound size={16} aria-hidden="true" /></ControlButton>
        </>} />
      <div style={{ overflowX: 'auto', flexShrink: 0, paddingInline: mobile ? spacing.lg : spacing.xl }}>
        <Tabs<Section> ariaLabel="Contact sections" compact={mobile} style={{ width: 'max-content', minWidth: '100%' }} activeKey={section} onChange={next => {
          if (next === section || !canLeave()) return
          setEditing(false)
          setSection(next)
          if (next === 'funding' && !fundingLoaded) void loadFunding()
        }} items={[
          { key: 'account', label: 'Account' }, { key: 'notes', label: 'Notes' }, { key: 'schedule', label: 'Schedule & lessons' },
          { key: 'billing', label: 'Billing' }, { key: 'makeups', label: 'Makeups' }, ...(fundingAvailable ? [{ key: 'funding' as const, label: 'Funding Program' }] : []),
        ]} />
      </div>
      <div className={layoutStyles.panelContent} style={{ background: colors.surfaceMuted }}>
        {editing && section === 'account' ? <InlineWorkspaceContext.Provider value={true}>
          <AccountEditorCanvas contacts={editorContacts} holderId={showsAccount ? editorContacts[0]?.id : undefined} accountName={name} studentOnly={!showsAccount} onSave={save} onBack={() => setEditing(false)}
            family={showsAccount && <DenseSectionPanel title="Manage Family Group" actions={<Button disabled>Add Dependent</Button>}><div style={muted}>Coming soon</div>{students.map(student => <div key={student.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingBlock: spacing.md, borderTop: `1px solid ${colors.borderLight}` }}><strong>{personName(student)}</strong><Button variant="secondary" disabled>Remove from Family Group</Button></div>)}</DenseSectionPanel>} />
        </InlineWorkspaceContext.Provider> : section === 'account' ? <AccountProfileLayout details={<>
              <DenseSectionPanel title="Contact details">
                <MetadataRow label="Contact details metadata">
                  {showsAccount ? <DetailField label="Dependents" value={String(students.length)} /> : <DetailField label="Account holder" value="Not added">
                    {accountHolderLink && <a href={accountHolderLink.href} style={{ color: colors.link }} onClick={event => {
                      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                      event.preventDefault()
                      if (canLeave()) accountHolderLink.open()
                    }}>{accountHolderLink.name}</a>}
                  </DetailField>}
                  <DetailField label="Member since" value={formatMemberSince(memberSince) || 'Not added'} />
                  <DetailField label="Birthday" value={formatMemberSince(person?.date_of_birth ?? null) || 'Not added'} />
                </MetadataRow>
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