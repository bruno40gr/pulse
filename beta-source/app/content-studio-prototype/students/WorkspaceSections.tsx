'use client'

import { createPortal } from 'react-dom'
import { useContext, useState } from 'react'
import { InlineWorkspaceContext } from './InlineWorkspaceContext'
import { Button, DenseSectionPanel, DetailField, EmptyState, FieldGrid, Input, Modal, ModalHeader, ModalBody, NotesSection, Select, Textarea } from '@/beta-source/components/ui'
import { OverflowMenu } from '@/beta-source/components/ui/OverflowMenu'
import { ArrowRight } from 'lucide-react'
import { InvoiceHistoryFilter, filterInvoiceHistory, type InvoiceHistoryView } from './InvoiceHistoryFilter'
import { InvoiceCard, InvoicePreview, paymentEntryLabel } from './InvoicePreview'
import billingStyles from './InvoicePreview.module.css'
import headerStyles from './SectionHeader.module.css'
import { SectionHeader } from './SectionHeader'
import { formatScheduleDate, shiftDate } from '@/beta-source/lib/academy-enrollment-schedule'
import { ControlButton } from '@/beta-source/components/ui/ControlButton'
import { stickyNotesForStudent } from '@/beta-source/lib/academy-sticky-notes-preview'
import { colors, noteLane, radius, shadows, spacing, typography } from '@/beta-source/lib/tokens'
import { previewMoney, previewStudentName, workspaceOccurrences, type LessonRequest, type PreviewNote, type PreviewStudent, type WorkspaceLocation } from '@/beta-source/lib/academy-student-preview'
import { invoiceOutstanding, type FamilyAction, type FamilyPreviewData, type PreviewAccount } from '@/beta-source/lib/academy-family-preview'
import { MetadataRow } from './MetadataRow'
import { ContactEditor } from './ContactEditor'
import { RelationshipManager } from './RelationshipManager'
import { previewContacts } from '@/beta-source/lib/academy-family-preview'
import { previewNoteActorId } from '@/beta-source/lib/academy-student-preview'
import { AccountManagersPanel } from '@/beta-source/components/contacts/AccountManagersPanel'
import { AccountSubscriptions } from './AccountSubscriptions'
import { WeeklySchedule } from './WeeklySchedule'
import { UpcomingBookings } from './UpcomingBookings'
import { BillingArrangements } from './BillingArrangements'
import { BillingInvoiceActions } from './BillingInvoiceActions'
import { PayInvoiceForm, type ManagementIntent } from './WorkspaceManagement'
import type { PreviewMakeup } from '@/beta-source/lib/academy-makeup-preview'
import type { NoteAttachment } from '@/beta-source/lib/note-links'
import { SectionTitle } from '@/beta-source/components/ui/SectionTitle'
import { LessonStatus } from './LessonStatus'
import cardStyles from './LessonCards.module.css'
import workspaceStyles from './StudentWorkspace.module.css'
import { StudentCommunication } from './StudentCommunication'
import { LessonsBrowser } from './LessonsBrowser'

export type WorkspaceOccurrence = ReturnType<typeof workspaceOccurrences>[number]
export type WorkspaceSectionProps = {
  lessonView?: 'list' | 'calendar'
  onLessonView?: (view: 'list' | 'calendar') => void
  lessonWeek?: string
  onLessonWeek?: (week: string) => void
  hideSubscriptions?: boolean
  subscriptionsOnly?: boolean
  onCancelLesson?: (id: string) => string | null
  previewV2?: boolean
  previewV3?: boolean
  onFamilyGroup?: (view: 'manage' | 'add') => void
  followUpOnly?: boolean
  noteAudience?: 'notes' | 'internal'
  onApply: (action: FamilyAction) => string | null
  makeups: PreviewMakeup[]; onMakeup: (id: string) => void
  data: FamilyPreviewData; account: PreviewAccount; location: WorkspaceLocation; students: PreviewStudent[]; occurrences: WorkspaceOccurrence[]
  requests: LessonRequest[]; notes: Record<string, PreviewNote[]>; drafts: Record<string, string>; channel: 'sms' | 'email'
  onCommunicationBack: () => void
  onDraft: (key: string, value: string) => void; onAddNote: (studentId: string, kind: 'notes' | 'internal', text: string, links?: NoteAttachment[], mentions?: string[]) => boolean
  onEditNote: (subject: string, kind: 'notes' | 'internal', noteId: string, text: string) => boolean
  onCompleteNote: (studentId: string, kind: 'notes' | 'internal', noteId: string) => void
  onNavigate: (patch: Partial<WorkspaceLocation>) => void; onLesson: (id: string) => void
  onCalendar: () => void
  onEnsure: (through: string) => void
  onMove: (id: string) => void
  onPaymentMethods: () => void
  onManage: (intent: ManagementIntent) => void
}
const stack = { display: 'flex', flexDirection: 'column' as const, gap: spacing.lg, minWidth: 0 }

export function WorkspaceSections(props: WorkspaceSectionProps) {
  if (props.followUpOnly) return <FollowUp {...props} />
  if (props.subscriptionsOnly) return <AccountSubscriptions {...props} />
  const parent = props.location.view === 'parent'
  if (props.location.section === 'profile') return <ContactContext {...props} />
  if (props.location.section === 'enrollments' || props.location.section === 'scheduling') return <Enrollments {...props} />
  if (props.location.section === 'makeups') return <MakeupBins {...props} />
  if (props.location.section === 'billing') return <Billing {...props} />
  if (props.location.section === 'notes') return parent ? <EmptyState title="Not available in family view" /> : <StudentNotes {...props} />
  return <StudentCommunication {...props} />
}

function ContactContext(props: WorkspaceSectionProps) {
  const { account, students, location, onManage } = props
  const parent = location.view === 'parent'
  const student = location.studentId ? students.find(item => item.id === location.studentId) : undefined
  const holder = students.find(item => item.id === account.holderId)
  const manager = students.flatMap(item => item.family).find(item => item.id === account.holderId)
  const family = students.filter(item => item.id !== account.holderId)
  const compact = props.previewV2 && location.view === 'quick'
  return <div className={workspaceStyles.profileGrid} style={props.previewV2 && location.view === 'quick' ? { gridTemplateColumns: 'minmax(0, 1fr)' } : undefined}>
    <section aria-label="Account details and follow-up" style={stack}>
    {previewContacts(props.data).filter(person => person.id === (student?.id || account.holderId)).map(contact => props.previewV3 ? <DenseSectionPanel key={contact.id} title="Contact details"><MetadataRow label="Contact details metadata"><DetailField label="Dependents" value={String(family.length)} /><DetailField label="Member since" value={contact.memberSince ? formatScheduleDate(contact.memberSince, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not added'} /><DetailField label="Birthday" value={contact.birthday ? formatScheduleDate(contact.birthday, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not added'} /></MetadataRow></DenseSectionPanel> : <ContactEditor key={contact.id} horizontal={props.previewV3} hideName={props.previewV3 && !student} dependentCount={!props.previewV3 && (!student || student.id === account.holderId) ? account.studentIds.filter(id => id !== account.holderId).length : undefined} contact={contact} accountId={account.id} onApply={props.onApply} />)}
    {!parent && !props.previewV3 && <RelationshipManager key={`${account.id}:${student?.id || ''}`} data={props.data} account={account} student={student} onApply={props.onApply} />}
    {student && !compact && <AccountManagersPanel accountHolders={[{ name: account.holderName, email: account.email, phone: holder?.phone || manager?.phone || null, relationship: student.id !== account.holderId ? 'Parent / guardian' : 'Account holder', is_primary: true }]} />}
    {!student && props.previewV3 && <>
      {family.map(person => <section key={person.id} aria-label={`${previewStudentName(person)} dependent`} style={stack}>
        <ContactEditor readOnly title={previewStudentName(person)} actions={!parent ? <Button size="md" onClick={() => onManage({ kind: 'enrollment', studentId: person.id })}>Add subscription</Button> : undefined} compact hideName contact={person} accountId={account.id} onApply={props.onApply}>
          <AccountSubscriptions {...props} hideHeader students={[person]} location={{ ...location, studentId: person.id }} />
        </ContactEditor>
      </section>)}
    </>}
    {!student && !props.previewV3 && <section aria-label="Dependents" style={stack}>
      <SectionHeader actions={!parent ? <Button variant="secondary" size="md" onClick={() => onManage({ kind: 'child' })}>Add Dependent</Button> : undefined}><SectionTitle as="h3" variant="card">Dependents</SectionTitle></SectionHeader>
      {family.map(child => <section key={child.id} aria-label={`${previewStudentName(child)} family details`} style={stack}>
        <ContactEditor title={previewStudentName(child)} contact={child} accountId={account.id} onApply={props.onApply} />
      </section>)}{!family.length && <EmptyState title="No children added" />}
    </section>}
    {!parent && !props.previewV2 && <FollowUp key={`${account.id}:${location.studentId}`} {...props} />}
    </section>
    {!props.hideSubscriptions && (!props.previewV2 || location.view === 'quick') && <AccountSubscriptions {...props} />}
  </div>
}

function FollowUp({ account, location, onApply, previewV3 }: WorkspaceSectionProps) {
  const propsTitle = previewV3 ? 'Follow ups' : 'Follow-up'
  const followUp = location.studentId ? account.studentFollowUps?.[location.studentId] : account.followUp
  const [date, setDate] = useState(followUp?.date || '')
  const [note, setNote] = useState(followUp?.note || '')
  const [error, setError] = useState('')
  return <DenseSectionPanel title={propsTitle} actions={<div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>{followUp && <Button variant="secondary" size="md" onClick={() => { const error = onApply({ kind: 'follow-up', accountId: account.id, studentId: location.studentId || undefined, followUp: undefined }); setError(error || ''); if (!error) { setDate(''); setNote('') } }}>Clear follow-up</Button>}<Button size="md" disabled={!date} onClick={() => setError(onApply({ kind: 'follow-up', accountId: account.id, studentId: location.studentId || undefined, followUp: { date, note } }) || '')}>Update follow-up</Button></div>}>
    <FieldGrid><Input label="Date" type="date" value={date} onChange={event => setDate(event.target.value)} /><Select label="Quick pick" value="" onChange={event => { if (event.target.value) setDate(shiftDate('2026-11-03', Number(event.target.value))) }}><option value="">Choose an interval</option><option value="1">Tomorrow</option><option value="7">Next week</option><option value="30">Next month</option></Select></FieldGrid>
    <div style={{ marginTop: spacing.lg }}><Textarea label="Reminder note" value={note} onChange={event => setNote(event.target.value)} /></div>
    {error && <p role="alert">{error}</p>}
  </DenseSectionPanel>
}

function Enrollments(props: WorkspaceSectionProps) {
  const inline = useContext(InlineWorkspaceContext)
  if (inline) return <UpcomingBookings {...props} />
  const quick = props.location.view === 'quick'
  if (props.previewV2 && !quick) return <LessonsBrowser {...props} />
  return <section style={stack}>
    {quick ? <UpcomingBookings {...props} /> : <WeeklySchedule data={props.data} makeups={props.makeups} location={props.location} onEnsure={props.onEnsure} onLesson={props.onLesson} onMove={props.onMove} />}
  </section>
}

function MakeupBins(props: WorkspaceSectionProps) {
  const students = props.students.filter(student => !props.location.studentId || props.location.studentId === student.id)
  return <div style={stack}>{students.map(student => <section key={student.id} style={stack} aria-label={props.location.studentId ? 'Makeup classes' : `${student.firstName} makeup classes`}>
    {!props.location.studentId && <SectionHeader><SectionTitle as="h3" variant="card">{previewStudentName(student)}</SectionTitle></SectionHeader>}
    <div style={{ ...stack, gap: spacing.md }}>
    {props.makeups.filter(item => item.studentId === student.id && !item.booking).map(item => <DenseSectionPanel key={item.id} title={`${item.program} • ${item.duration} min`} actions={<Button size="md" variant="secondary" aria-label={`Schedule ${student.firstName} makeup ${item.date}`} onClick={() => props.onMakeup(item.id)}>Schedule makeup</Button>} style={{ padding: spacing.lg, gap: spacing.sm }} contentStyle={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
        <div style={{ ...typography.bodySmall, color: colors.textSecondary }}>{item.service} · Credit from {formatScheduleDate(item.date, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        <LessonStatus status="Awaiting scheduling" />
    </DenseSectionPanel>)}
    </div>
    {!props.makeups.some(item => item.studentId === student.id && !item.booking) && <EmptyState title="No unused makeups" />}
  </section>)}</div>
}

function Billing({ account, data, students, location, onManage, onApply, onPaymentMethods }: WorkspaceSectionProps) {
  const studentBilling = Boolean(location.studentId && location.studentId !== account.holderId)
  const canPay = location.view !== 'parent'
  const canManageBilling = location.view !== 'parent' && !studentBilling
  const [payment, setPayment] = useState<ManagementIntent | null>(null)
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [invoiceView, setInvoiceView] = useState<InvoiceHistoryView>('all')
  const invoices = data.invoices.filter(item => item.accountId === account.id)
  const enrollments = students.flatMap(student => student.enrollments.map(enrollment => ({ student, enrollment })))
  const open = invoices.filter(item => item.status === 'Open').reduce((sum, item) => sum + invoiceOutstanding(item), 0)
  const unpaid = invoices.filter(item => item.status === 'Open')
  const selectedInvoice = invoices.find(invoice => invoice.id === invoiceId)
  const paymentDialog = <Modal isOpen={Boolean(payment)} onClose={() => setPayment(null)} ariaLabel={payment?.kind === 'pay-all' ? 'Pay all invoices' : 'Pay'}><ModalHeader title={payment?.kind === 'pay-all' ? 'Pay all invoices' : 'Pay'} onClose={() => setPayment(null)} /><ModalBody>{payment && <PayInvoiceForm key={`${payment.kind}:${payment.invoiceId || ''}`} data={data} account={account} intent={payment} onApply={onApply} onClose={() => setPayment(null)} onOpenBillingAccount={onPaymentMethods} />}</ModalBody></Modal>
  if (selectedInvoice) return <><InvoicePreview key={selectedInvoice.id} onRefund={canPay ? reason => onApply({ kind: 'refund-invoice', accountId: account.id, invoiceId: selectedInvoice.id, reason }) : undefined} onSaveDetails={canManageBilling ? (customFields, notes) => onApply({ kind: 'invoice-details', accountId: account.id, invoiceId: selectedInvoice.id, customFields, notes }) : undefined} invoice={selectedInvoice} onBack={() => setInvoiceId(null)} onPay={canPay ? () => setPayment({ kind: 'pay', invoiceId: selectedInvoice.id }) : undefined} />{canManageBilling && <BillingInvoiceActions invoice={selectedInvoice} onApply={onApply} />}{paymentDialog}</>
  return <div style={stack}>
    <header className={billingStyles.balance} aria-label="Billing summary">
      <SectionHeader actions={canManageBilling ? <Button variant="secondary" onClick={onPaymentMethods}>Payment methods</Button> : undefined}>
        <SectionTitle as="h2" variant="card">{previewMoney(open, 'USD')} due</SectionTitle>
      </SectionHeader>
    </header>
    <section aria-label="Invoices" style={stack}><div className={cardStyles.toolbar}><SectionTitle as="h3" variant="card">Invoices</SectionTitle><div className={cardStyles.actions}>{canManageBilling && <><OverflowMenu label="Billing actions" items={[...(invoices.length >= 2 ? [{ label: 'Create statement', onSelect: () => onManage({ kind: 'statement' as const }) }] : []), ...(enrollments.length ? [{ label: 'Create invoice', onSelect: () => onManage({ kind: 'invoice' as const }) }] : [])]} />{unpaid.length > 1 && <Button variant="secondary" size="md" className={billingStyles.paymentButton} onClick={() => setPayment({ kind: 'pay-all', invoiceIds: unpaid.map(invoice => invoice.id) })}>{paymentEntryLabel(open)}<ArrowRight size={16} aria-hidden="true" /></Button>}</>}</div></div>
      <InvoiceHistoryFilter value={invoiceView} onChange={setInvoiceView} />
      {filterInvoiceHistory(invoices, invoiceView).map(invoice => <InvoiceCard key={invoice.id} invoice={invoice} onView={() => setInvoiceId(invoice.id)} onPay={canPay ? () => setPayment({ kind: 'pay', invoiceId: invoice.id }) : undefined} />)}
      {!filterInvoiceHistory(invoices, invoiceView).length && <EmptyState title={invoiceView === 'past' ? 'No past invoices' : invoiceView === 'unpaid' ? 'No unpaid invoices' : 'No invoices'} />}
    </section>
    {canManageBilling && <BillingArrangements data={data} accountId={account.id} onApply={onApply} />}
    {paymentDialog}
  </div>
}

function AccountNotes({ account, students, previewV3, notes, drafts, onDraft, onAddNote, onEditNote }: WorkspaceSectionProps) {
  const inline = useContext(InlineWorkspaceContext)
  const [toolbarHost, setToolbarHost] = useState<HTMLDivElement | null>(null)
  const key = `${account.id}:notes`
  return <section aria-label="Account notes" style={stack}>
    {inline && <div ref={setToolbarHost} />}
    <NotesSection key={key} title="Account notes" panel showHeader={!inline} renderToolbar={inline ? (onAdd, composing) => toolbarHost ? createPortal(<SectionHeader actions={<Button variant="secondary" size="md" disabled={composing} onClick={onAdd}>Add note</Button>}><SectionTitle as="h2" variant="card">Account notes</SectionTitle></SectionHeader>, toolbarHost) : null : undefined} addLabel="Add note" helperText="Staff notes for this account. Stay here to keep context across all children." notes={(notes[key] || []).map(note => ({ ...note, editable: note.actor_id === previewNoteActorId }))} onEdit={(entry, text) => onEditNote(account.id, 'notes', entry.id!, text)} avatarInitial={account.holderName.charAt(0)} avatarBg={colors.tealDark} cardBg={colors.surface} attachmentsEnabled draft={drafts[key] || ''} onDraftChange={value => onDraft(key, value)} onSave={(text, mentions, links) => onAddNote(account.id, 'notes', text, links, mentions)} />
    {previewV3 && students.filter(student => student.id !== account.holderId).map(student => <section key={student.id} aria-label={`${previewStudentName(student)} notes`}>
      <NotesSection title={`${previewStudentName(student)} · Student notes`} panel notes={[...(notes[`${student.id}:notes`] || []), ...student.notes].map(note => ({ ...note, editable: note.actor_id === previewNoteActorId }))} avatarInitial={student.firstName[0]} avatarBg={colors.tealDark} cardBg={colors.surface} attachmentsEnabled draft={drafts[`${student.id}:notes`] || ''} onDraftChange={value => onDraft(`${student.id}:notes`, value)} onSave={(text, mentions, links) => onAddNote(student.id, 'notes', text, links, mentions)} onEdit={(entry, text) => onEditNote(student.id, 'notes', entry.id!, text)} />
    </section>)}
  </section>
}

function StudentNotes(props: WorkspaceSectionProps) {
  const student = props.students.find(item => item.id === props.location.studentId)
  return student ? <StaffNotes key={student.id} {...props} student={student} /> : <AccountNotes {...props} />
}

function StaffNotes({ student, notes, drafts, onDraft, onAddNote, onEditNote, onCompleteNote, account, students, noteAudience }: WorkspaceSectionProps & { student: PreviewStudent }) {
  const [toolbarHost, setToolbarHost] = useState<HTMLDivElement | null>(null)
  const [selectedAudience, setActive] = useState<'notes' | 'internal'>('notes')
  const active = noteAudience || selectedAudience
  const [stickyDone, setStickyDone] = useState<Record<string, boolean>>({})
  const key = `${student.id}:${active}`
  const sharedCount = (notes[`${student.id}:notes`]?.length || 0) + student.notes.length
  const internalCount = notes[`${student.id}:internal`]?.length || 0
  const palette = active === 'notes' ? noteLane.shared : noteLane.internal
  const region = active === 'notes' ? 'Shared with family notes' : 'Internal only notes'
  const laneLabels = { notes: 'Shared with family', internal: 'Internal only' } as const
  const mentionMembers = [...new Set([account?.holderName, ...students.flatMap(item => item.enrollments.map(enrollment => enrollment.teacher))].filter(Boolean) as string[])].map(name => { const [first, ...rest] = name.split(' '); return { membership_id: `preview:staff:${name}`, person_id: null, first_name: first, last_name: rest.join(' '), email: null } })
  const stickyEntries = active === 'internal' ? stickyNotesForStudent(student.id).map(note => ({ id: note.id, text: `${note.title ? `${note.title}\n` : ''}${note.text}`, timestamp: note.createdAt, actor_name: note.author, task: true, sticky: true, completed_at: stickyDone[note.id] ? new Date().toISOString() : null })) : []
  const typedEntries = (notes[key] || []).map(note => ({ ...note, task: Boolean(note.mentions && note.mentions.length) }))
  const entries = [...stickyEntries, ...typedEntries, ...(active === 'notes' ? student.notes : [])]
  const toggleTask = (index: number) => {
    const entry = entries[index] as { id?: string; sticky?: boolean; task?: boolean } | undefined
    if (!entry?.id) return
    if (entry.sticky) setStickyDone(current => ({ ...current, [entry.id!]: !current[entry.id!] }))
    else if (entry.task) onCompleteNote(student.id, 'internal', entry.id)
  }
  return <section style={stack} aria-label="Student notes">
    <div ref={setToolbarHost} />
    <section aria-label={region} style={{ background: palette.surface, border: `1px solid ${palette.border}`, borderRadius: radius.lg, padding: spacing.lg }}>
      <NotesSection key={key} title="" showHeader={false} attachmentsEnabled={active === 'notes'} cardStyle={palette.cardSticky ? { borderRadius: radius.md, border: '1px solid rgba(0,0,0,0.06)', boxShadow: shadows.sm } : undefined} renderToolbar={(onAdd, composing) => toolbarHost ? createPortal(<SectionHeader actions={<Button variant="secondary" size="md" disabled={composing} onClick={onAdd}>Add note</Button>}><div className={headerStyles.audience} role="group" hidden={Boolean(noteAudience)} aria-label="Note audience" style={{ display: noteAudience ? 'none' : 'flex', gap: spacing.xs, flexWrap: 'wrap' }}>{(['notes', 'internal'] as const).map(kind => <ControlButton key={kind} kind="toggle" selected={active === kind} aria-pressed={active === kind} onClick={() => setActive(kind)} style={typography.h2}>{laneLabels[kind]}<span style={typography.bodySmall}>{kind === 'notes' ? sharedCount : internalCount}</span></ControlButton>)}</div></SectionHeader>, toolbarHost) : null} notes={entries.map(note => ({ ...note, editable: 'actor_id' in note && note.actor_id === previewNoteActorId }))} onEdit={(entry, text) => onEditNote(student.id, active, entry.id!, text)} avatarInitial={student.firstName.charAt(0)} avatarBg={colors.tealDark} cardBg={palette.card} mentionsEnabled={active === 'internal'} mentionMembers={mentionMembers} onToggleComplete={active === 'internal' ? toggleTask : undefined} draft={drafts[key] || ''} onDraftChange={value => onDraft(key, value)} onSave={(text, mentionIds, links) => onAddNote(student.id, active, text, links, mentionIds)} />
    </section>
  </section>
}
