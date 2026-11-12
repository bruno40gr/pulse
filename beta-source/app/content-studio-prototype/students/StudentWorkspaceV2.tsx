'use client'

import { familyActionConfirmation, useActionConfirmation } from './useActionConfirmation'

import { ConfirmActionButton } from './ConfirmActionButton'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Mail, MessageSquare, Phone, Pencil } from 'lucide-react'
import { SlidePanelActionBar } from '@/beta-source/components/ui/SlidePanelActionBar'
import { Button, DenseSectionPanel, DetailField, PageHeader, SlidePanel, SlidePanelHeader, Tabs } from '@/beta-source/components/ui'
import { formatScheduleDate, shiftDate, weekStart } from '@/beta-source/lib/academy-enrollment-schedule'
import { invoiceStatus } from '@/beta-source/lib/academy-invoice-document'
import { colors, spacing, typography } from '@/beta-source/lib/tokens'
import { useIsMobile } from '@/beta-source/lib/useMediaQuery'
import { previewMoney, previewStudentName, workspaceInitial, workspaceLocationFromSearch, workspaceLocationSearch, workspaceOccurrences, type LessonRequest, type PreviewNote, type WorkspaceLocation } from '@/beta-source/lib/academy-student-preview'
import { accountStudents, invoiceOutstanding, nextPreviewPaymentDate, applyFamilyAction, createFamilyPreview, parentFamilyProjection, studentFamilyProjection, type FamilyAction } from '@/beta-source/lib/academy-family-preview'
import { applyParentNote } from '@/beta-source/lib/academy-parent-portal'
import { previewContacts } from '@/beta-source/lib/academy-family-preview'
import { editPreviewNote, previewNoteActorId } from '@/beta-source/lib/academy-student-preview'
import type { NoteAttachment } from '@/beta-source/lib/note-links'
import { AccountPaymentMethods } from './AccountPaymentMethods'
import { AccountEditor } from './AccountEditor'
import { ParentFamilyGroup } from './ParentFamilyGroup'
import { ParentPortal } from './ParentPortal'
import { WorkspaceSections } from './WorkspaceSections'
import { WorkspaceManagement, type ManagementIntent } from './WorkspaceManagement'
import { LessonPreview } from './LessonPreview'
import { MakeupWorkspace } from './MakeupWorkspace'
import { bookPreviewMakeup, createScheduledMakeupPreview, recordPreviewAbsence } from '@/beta-source/lib/academy-makeup-preview'
import styles from './StudentWorkspace.module.css'
import v3Styles from './StudentWorkspaceV3.module.css'
import { PROFILE_PANEL_WIDTH } from '@/beta-source/lib/conversation-display'
import type { FamilyPreviewData } from '@/beta-source/lib/academy-family-preview'
import type { MakeupPreviewState } from '@/beta-source/lib/academy-makeup-preview'
import { CalendarWorkspace } from './CalendarWorkspace'
import { MoveLesson } from './MoveLesson'
import { ContactsTable } from './ContactsTable'
import { expandPreviewCalendar, previewCalendarLessons, movePreviewLesson, reschedulePreviewSubscription, makeupPreviewNow, cancelPreviewReplacement, absenceEligible } from '@/beta-source/lib/academy-makeup-preview'

export type WorkspaceContactsRenderer = (props: { data: ReturnType<typeof createFamilyPreview>; onOpen: (accountId: string, studentId?: string) => void }) => ReactNode

export default function StudentWorkspaceV2({ inlineTasks = false, renderContacts, initialData, initialMakeups, onDemoChange }: { inlineTasks?: boolean; renderContacts?: WorkspaceContactsRenderer; initialData?: FamilyPreviewData; initialMakeups?: MakeupPreviewState; onDemoChange?: (data: FamilyPreviewData, makeups: MakeupPreviewState) => void }) {
  const { confirm, confirmation } = useActionConfirmation()
  const [data, setData] = useState(() => expandPreviewCalendar(initialData || createFamilyPreview(), '2027-02-03'))
  const [makeups, setMakeups] = useState(initialMakeups || createScheduledMakeupPreview)
  useEffect(() => { onDemoChange?.(data, makeups) }, [data, makeups, onDemoChange])
  const [lessonView, setLessonView] = useState<'list' | 'calendar'>('list')
  const [lessonWeek, setLessonWeek] = useState('2026-11-02')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarDate] = useState<string | undefined>()
  const [moveId, setMoveId] = useState<string | null>(null)
  const [recurringMove, setRecurringMove] = useState(false)
  const [replacementCancelId, setReplacementCancelId] = useState<string | null>(null)
  const [replacementError, setReplacementError] = useState('')
  const [bookedDate, setBookedDate] = useState<string | null>(null)
  const [makeupId, setMakeupId] = useState<string | null>(null)
  const makeupReturn = useRef<WorkspaceLocation | null>(null)
  const [location, setLocation] = useState<WorkspaceLocation>(workspaceInitial)
  const [ready, setReady] = useState(false)
  const [search, setSearch] = useState('')
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [familyCanvas, setFamilyCanvas] = useState<'manage' | 'add' | 'edit' | null>(null)
  const [intent, setIntent] = useState<ManagementIntent | null>(null)
  const [requests] = useState<LessonRequest[]>([])
  const [notes, setNotes] = useState<Record<string, PreviewNote[]>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const communicationReturn = useRef<WorkspaceLocation | null>(null)
  const communicationActive = location.section === 'communication'
  function openCommunication(nextChannel: 'sms' | 'email') {
    communicationReturn.current = location
    setChannel(nextChannel)
    navigate({ ...location, section: 'communication', enrollmentId: '' })
  }
  function closeCommunication() { navigate(communicationReturn.current || { ...location, section: 'profile' }); communicationReturn.current = null }
  const [channel, setChannel] = useState<'sms' | 'email'>('sms')
  const isMobile = useIsMobile()
  const panelContent = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (inlineTasks) panelContent.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [inlineTasks, location.section, lessonView, moveId, makeupId, lessonId, replacementCancelId, intent, calendarOpen, familyCanvas])
  const sectionNavigation = useRef<HTMLDivElement>(null)
  useEffect(() => { if (inlineTasks) sectionNavigation.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }, [inlineTasks, location.section])
  const panelReturn = useRef<WorkspaceLocation | null>(null)
  useEffect(() => {
    const restore = () => { setFamilyCanvas(null); setLocation(workspaceLocationFromSearch(window.location.search)); setLessonId(null); setIntent(null); setMakeupId(null); setCalendarOpen(false); setMoveId(null); setReplacementCancelId(null) }
    restore(); setReady(true)
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])
  function navigate(next: WorkspaceLocation) {
    window.history.pushState({ ...window.history.state }, '', `${window.location.pathname}${workspaceLocationSearch(next, window.location.search)}`)
    setFamilyCanvas(null); setLocation(next); setLessonId(null); setIntent(null); setCalendarOpen(false); setMoveId(null); setRecurringMove(false); setMakeupId(null); setReplacementCancelId(null); setBookedDate(null)
  }
  function update(patch: Partial<WorkspaceLocation>) {
    const section = patch.section || location.section
    const view = !inlineTasks && location.view === 'quick' && !['profile', 'notes', 'enrollments'].includes(section) ? 'staff' : location.view
    if (location.view === 'quick' && view === 'staff') panelReturn.current = location
    navigate({ ...location, view, ...patch })
  }
  function closeWorkspace() { setMakeupId(null); navigate({ ...workspaceInitial, view: 'contacts' }) }
  function backToPanel() { const target = panelReturn.current; if (inlineTasks) panelReturn.current = null; setMakeupId(null); navigate(target || { ...location, view: 'quick', section: quick ? location.section : 'profile', enrollmentId: '' }) }
  function manage(next: ManagementIntent) {
    setRecurringMove(false)
    if (quick) panelReturn.current = location
    if (inlineTasks) { setIntent(next); return }
    if (next.kind === 'subscription') update({ view: 'staff', section: 'enrollments', enrollmentId: next.enrollmentId || '' })
    else if (quick) update({ view: 'staff' })
    setIntent(next)
  }
  function openWorkspace(section: WorkspaceLocation['section']) { if (quick) panelReturn.current = location; update({ view: inlineTasks ? 'quick' : 'staff', section, enrollmentId: '' }) }
  function scheduleMakeup(id: string) {
    makeupReturn.current = location
    update({ view: parent ? 'parent' : inlineTasks ? 'quick' : 'staff', section: inlineTasks ? 'makeups' : 'scheduling' })
    setMakeupId(id)
  }
  function closeMakeup() { setMakeupId(null); if (makeupReturn.current) navigate(makeupReturn.current) }
  const parent = location.view === 'parent', quick = location.view === 'quick'
  // Student routes retain their own presentation scope inside the account.
  const account = data.accounts.find(item => location.accountId ? item.id === location.accountId : location.studentId ? item.studentIds.includes(location.studentId) : parent && (data.demoSchool || item.id === 'preview:kim'))
  const invalid = location.view !== 'contacts' && (!account || (parent && !data.demoSchool && account.id !== 'preview:kim') || Boolean(location.studentId && !account.studentIds.includes(location.studentId)) || Boolean(location.enrollmentId && !accountStudents(data, account).some(student => (!location.studentId || student.id === location.studentId) && student.enrollments.some(item => item.id === location.enrollmentId))))
  const visibleStudents = account && !invalid ? accountStudents(data, account) : []
  // Parent simulation keeps the explicit original allowlist. Newly added children require real access grants later.
  const parentData = parent && account && !invalid ? parentFamilyProjection(data, account) : null
  const familyData = parentData || { ...data, contacts: previewContacts(data), students: visibleStudents }
  const studentData = account && location.studentId ? studentFamilyProjection(familyData, account, location.studentId) : null
  const projectedStudents = studentData ? studentData.students : familyData.students
  const scopedData = studentData || familyData
  const scopedLocation = { ...location, accountId: account?.id || '', studentId: location.studentId, enrollmentId: location.enrollmentId, teacher: '' }
  const occurrences = workspaceOccurrences(scopedData, scopedLocation)
  const lesson = occurrences.find(item => item.id === lessonId) || null
  function addNote(subject: string, kind: 'notes' | 'internal', text: string, links?: NoteAttachment[], mentions?: string[]) {
    const key = `${subject}:${kind}`
    setNotes(current => ({ ...current, [key]: [{ id: `preview:${crypto.randomUUID()}`, text, timestamp: new Date().toISOString(), audience: kind === 'notes' ? 'family' : 'internal', actor_id: previewNoteActorId, actor_name: 'Preview staff', completed_at: null, ...(links && links.length ? { links } : {}), ...(mentions && mentions.length ? { mentions } : {}) }, ...(current[key] || [])] }))
    return true
  }
  function completeNote(subject: string, kind: 'notes' | 'internal', noteId: string) {
    const key = `${subject}:${kind}`
    setNotes(current => ({ ...current, [key]: (current[key] || []).map(note => note.id === noteId ? { ...note, completed_at: note.completed_at ? null : new Date().toISOString() } : note) }))
  }
  function apply(action: FamilyAction): string | null {
    if (parent || action.accountId !== account?.id) return 'Action unavailable in this view.'
    try {
      const next = applyFamilyAction(data, action, { role: 'admin' })
      setData(next)
      confirm(familyActionConfirmation(action))
      if (action.kind === 'unlink-child' && location.studentId === action.studentId) update({ accountId: `preview:unlinked:${action.studentId}`, studentId: action.studentId, enrollmentId: '' })
      return null
    } catch (error) { return error instanceof Error ? error.message : 'Unable to update preview.' }
  }
  // Parent sees only invoices/cards for the explicitly simulated guardian, not every household payer.
  const contentData = scopedData
  function openPaymentMethods() {
    if (!account || parent) return
    navigate({ ...location, accountId: account.id, studentId: '', enrollmentId: '', section: location.studentId && location.studentId !== account.holderId ? 'billing' : 'payment-methods' })
  }
  function closePaymentMethods() {
    navigate({ ...location, studentId: '', section: 'billing' })
  }
  const paymentMethodsContent = account && !parent && <AccountPaymentMethods data={familyData} account={account} onBack={closePaymentMethods} onApply={apply} />

  const visibleMakeups = makeups.items.filter(item => projectedStudents.some(student => student.id === item.studentId && student.enrollments.some(enrollment => enrollment.id === item.enrollmentId)))
  const scheduledClasses = previewCalendarLessons(contentData, visibleMakeups, { ...scopedLocation, enrollmentId: '' })
  const movingLesson = scheduledClasses.find(item => item.id === moveId)
  const cancellingReplacement = scheduledClasses.find(item => item.id === replacementCancelId && item.makeup)
  function openLesson(id: string) {
    if (visibleMakeups.some(item => item.id === id && item.booking)) { setReplacementError(''); setReplacementCancelId(id) }
    else setLessonId(id)
  }
  const selectedMakeup = visibleMakeups.find(item => item.id === makeupId && !item.booking)
  const lessonContent = lesson && <LessonPreview onBack={() => setLessonId(null)} key={`${lesson.id}:${parent}`} lesson={lesson} parent={parent} absence={makeups.absences.find(item => item.lessonId === lesson.id)} onSchedule={scheduleMakeup} onCancel={grantLate => {
    try { const next = recordPreviewAbsence(contentData, makeups, account!.id, lesson.id, grantLate, parent); setData(current => ({ ...current, lessons: current.lessons.map(item => next.data.lessons.find(updated => updated.id === item.id) || item) })); setMakeups(next.state); confirm(next.state.items.length > makeups.items.length ? 'Lesson cancelled successfully. Added to the makeup bin.' : 'Lesson cancelled successfully. No makeup credit was added.'); return null } catch (error) { return error instanceof Error ? error.message : 'Unable to cancel lesson.' }
  }} />
  const managementContent = intent && account && !parent && <WorkspaceManagement onRecurringSchedule={inlineTasks ? enrollmentId => {
    const item = scheduledClasses.find(item => item.enrollmentId === enrollmentId && !item.makeup && item.status === 'Scheduled' && `${item.date}T${item.time}:00-08:00` > makeupPreviewNow)
    if (item) { setRecurringMove(true); setMoveId(item.id); setLessonWeek(weekStart(item.date)) }
  } : undefined} previewV2 key={`${account.id}:${intent.kind}:${intent.enrollmentId || ''}`} data={contentData} account={account} studentId={location.studentId} intent={intent} onApply={apply} onClose={() => panelReturn.current ? backToPanel() : setIntent(null)} />
  const selectedStudent = projectedStudents.find(student => student.id === location.studentId)
  const profileTitle = selectedStudent ? previewStudentName(selectedStudent) : account?.holderName || ''
  const panelTabs = <nav aria-label="Account sections" className={styles.tabs}><Tabs items={[{ key: 'profile', label: 'Account' }, { key: 'enrollments', label: 'Upcoming lessons' }, { key: 'notes', label: 'Notes' }]} activeKey={location.section} onChange={section => update({ section: section as WorkspaceLocation['section'], enrollmentId: '' })} /></nav>
  const nextPaymentDate = nextPreviewPaymentDate(contentData, projectedStudents.map(student => student.id), makeupPreviewNow.slice(0, 10))
  const hasOverdueInvoices = contentData.invoices.some(item => item.accountId === account?.id && invoiceStatus(item) === 'Overdue')
  const unpaidInvoiceCount = contentData.invoices.filter(item => item.accountId === account?.id && item.status === 'Open').length
  const sectionTabs = <nav aria-label="Family sections" className={styles.tabs}><Tabs items={[{ key: 'profile', label: 'Account' }, { key: 'notes', label: 'Notes' }, { key: 'enrollments', label: 'Schedule & lessons' }, { key: 'billing', label: 'Billing' }, { key: 'makeups', label: 'Makeups', count: visibleMakeups.filter(item => !item.booking).length || undefined, countAppearance: 'bubble' }]} activeKey={location.section === 'scheduling' ? 'enrollments' : location.section === 'payment-methods' ? 'billing' : location.section} onChange={section => update({ section: section as WorkspaceLocation['section'], enrollmentId: '' })} style={{ width: 'max-content', minWidth: '100%' }} /></nav>

  function renderSection(section: WorkspaceLocation['section'], presentation?: 'details' | 'subscriptions' | 'follow-up') {
    if (section === 'payment-methods') return paymentMethodsContent
    return account && !invalid ? <WorkspaceSections onFamilyGroup={setFamilyCanvas} followUpOnly={presentation === 'follow-up'} onPaymentMethods={openPaymentMethods} lessonView={lessonView} onLessonView={setLessonView} lessonWeek={lessonWeek} onLessonWeek={setLessonWeek} hideSubscriptions={presentation === 'details'} subscriptionsOnly={presentation === 'subscriptions'} onCancelLesson={id => {
      try { const next = recordPreviewAbsence(contentData, makeups, account.id, id, false, parent); setData(current => ({ ...current, lessons: current.lessons.map(item => next.data.lessons.find(updated => updated.id === item.id) || item) })); setMakeups(next.state); confirm('Lesson cancelled.'); return null } catch (error) { return error instanceof Error ? error.message : 'Unable to cancel lesson.' }
    }} previewV2 previewV3={inlineTasks} noteAudience={quick ? undefined : 'notes'} onEnsure={through => setData(current => expandPreviewCalendar(current, through))} onCalendar={() => { if (quick) panelReturn.current = location; setCalendarOpen(true) }} data={contentData} account={account} location={{ ...scopedLocation, section }} students={projectedStudents} occurrences={occurrences} requests={requests} notes={notes} drafts={drafts} channel={channel} onCommunicationBack={closeCommunication} onDraft={(key, value) => setDrafts(current => ({ ...current, [key]: value }))} onAddNote={addNote} onEditNote={(subject, kind, noteId, text) => { const key = `${subject}:${kind}`; const entry = notes[key]?.find(note => note.id === noteId); if (!entry || entry.actor_id !== previewNoteActorId || !text.trim()) return false; setNotes(current => ({ ...current, [key]: current[key].map(note => note.id === noteId ? editPreviewNote(note, previewNoteActorId, text) : note) })); return true }} onCompleteNote={completeNote} onNavigate={patch => update({ accountId: account.id, ...patch })} onLesson={openLesson} onMove={id => { setRecurringMove(false); if (inlineTasks) { setLessonView('calendar'); const item = scheduledClasses.find(item => item.id === id); if (item) setLessonWeek(weekStart(item.date)) } if (quick) panelReturn.current = location; setMoveId(id) }} onManage={manage} onApply={apply} makeups={visibleMakeups} onMakeup={scheduleMakeup} /> : null
  }
  const activeContact = account ? previewContacts(contentData).find(person => person.id === (selectedStudent?.id || account.holderId)) : undefined
  const content = renderSection(location.section)
  const workspaceOpen = Boolean(account && !invalid && (location.view === 'staff' || parent || intent || calendarOpen || selectedMakeup || movingLesson || cancellingReplacement))
  const accountTaskActive = !communicationActive && Boolean(movingLesson || (calendarOpen && !lessonId) || intent || selectedMakeup) && !cancellingReplacement
  const workspaceContent = familyCanvas === 'edit' && account ? <AccountEditor key={selectedStudent?.id || account.id} contactId={selectedStudent && selectedStudent.id !== account.holderId ? selectedStudent.id : undefined} data={contentData} account={account} onApply={apply} onBack={() => setFamilyCanvas(null)} /> : familyCanvas && familyCanvas !== 'edit' && account ? <ParentFamilyGroup key={familyCanvas} canvas={familyCanvas} onBack={() => setFamilyCanvas(null)} account={account} students={projectedStudents.filter(student => student.id !== account.holderId)} onApply={apply} /> : communicationActive ? content : movingLesson && account ? <MoveLesson recurring={recurringMove} onRecurring={inlineTasks && !movingLesson.makeup ? booking => {
      try { setData(reschedulePreviewSubscription(data, makeups, account.id, movingLesson.id, booking)); setMoveId(null); setRecurringMove(false); setIntent(null); confirm('Subscription schedule updated. Upcoming regular lessons have been rescheduled.'); return null } catch (error) { return error instanceof Error ? error.message : 'Unable to change recurring schedule.' }
    } : undefined} profileSubtitle={selectedStudent ? 'Student profile' : 'Account manager'} accountName={profileTitle} key={movingLesson.id} onWeek={inlineTasks ? week => { setLessonWeek(week); setData(current => expandPreviewCalendar(current, shiftDate(week, 6))) } : undefined} initialDate={inlineTasks ? lessonWeek : undefined} item={movingLesson} data={data} state={makeups} onBack={() => recurringMove ? (setMoveId(null), setRecurringMove(false)) : panelReturn.current ? backToPanel() : setMoveId(null)} onMove={booking => {
      try { const next = movePreviewLesson(data, makeups, account.id, movingLesson.id, booking); setData(next.data); setMakeups(next.state); setMoveId(null); confirm('Lesson rescheduled. The recurring subscription is unchanged.'); return null } catch (error) { return error instanceof Error ? error.message : 'Unable to move lesson.' }
    }} /> : cancellingReplacement && account ? <>
      <PageHeader title="Cancel makeup lesson" onBack={() => setReplacementCancelId(null)} backLabel="Back to lessons" />
      <DenseSectionPanel title={`${cancellingReplacement.program} · ${cancellingReplacement.date}`} actions={<ConfirmActionButton variant="destructive" onClick={() => {
        try { setMakeups(cancelPreviewReplacement(data, makeups, account.id, cancellingReplacement.id)); setReplacementCancelId(null); confirm('Makeup lesson cancelled.') } catch (error) { setReplacementError(error instanceof Error ? error.message : 'Unable to cancel lesson.') }
      }}>Cancel lesson</ConfirmActionButton>}><p style={typography.body}>{absenceEligible(cancellingReplacement.date, cancellingReplacement.time) ? 'Cancelling returns this unused makeup credit.' : 'Cancelling this lesson will forfeit the makeup credit because it is less than 24 hours away.'}</p><p style={typography.bodySmall}>{cancellingReplacement.time} · {cancellingReplacement.teacher}</p>{replacementError && <p role="alert">{replacementError}</p>}</DenseSectionPanel>
    </> : calendarOpen && account && !invalid && !lessonId ? <CalendarWorkspace profileSubtitle={selectedStudent ? 'Student profile' : 'Account manager'} accountName={profileTitle} data={contentData} makeups={visibleMakeups} location={scopedLocation} initialDate={calendarDate} onBack={() => panelReturn.current ? backToPanel() : setCalendarOpen(false)} onLesson={openLesson} onMove={id => { setRecurringMove(false); if (inlineTasks) setLessonView('calendar'); setMoveId(id) }} onEnsure={through => setData(current => expandPreviewCalendar(current, through))} /> : intent && account && !invalid ? managementContent : selectedMakeup && account ? <MakeupWorkspace initialDate={lessonWeek} onWeek={week => { setLessonWeek(week); setData(current => expandPreviewCalendar(current, shiftDate(week, 6))) }} profileSubtitle={selectedStudent ? 'Student profile' : 'Account manager'} accountName={profileTitle} key={selectedMakeup.id} data={data} state={makeups} makeup={selectedMakeup} onBack={closeMakeup} onBook={booking => {
      try { setMakeups(bookPreviewMakeup(data, makeups, account.id, selectedMakeup.id, booking)); setMakeupId(null); setLessonWeek(weekStart(booking.date)); setLessonView('calendar'); update({ section: 'enrollments' }); setBookedDate(booking.date); confirm('Makeup lesson booked.'); return null } catch (error) { return error instanceof Error ? error.message : 'Unable to book makeup.' }
    }} /> : <>
    {!communicationActive && !inlineTasks && sectionTabs}
    <div style={{ marginTop: inlineTasks ? 0 : spacing.lg }}>
      {lesson ? lessonContent : <>
        {bookedDate && <DenseSectionPanel title="Makeup booked"><span style={typography.bodySmall}>{bookedDate}</span></DenseSectionPanel>}
        {content}
      </>}
    </div>
  </>
  if (!ready) return <div style={{ padding: spacing.xl }}>Loading preview…</div>
  if (parent && account && !invalid) return <ParentPortal notes={notes} onSaveNote={(studentId, text, id, links) => { try { setNotes(applyParentNote(data, account.id, notes, { studentId, text, id: id || `preview:note:${crypto.randomUUID()}`, edit: Boolean(id), links })); return true } catch { return false } }} data={data} account={account} makeups={makeups} onData={setData} onMakeups={setMakeups} onExit={() => {
    const params = new URLSearchParams(window.location.search)
    params.delete('portal')
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${params}`)
    navigate({ ...workspaceInitial, view: 'contacts' })
  }} />
  return <div className={styles.root} style={{ padding: renderContacts ? 0 : isMobile ? spacing.lg : spacing['3xl'], color: colors.text, fontFamily: typography.fontSans, background: colors.background, minHeight: '100dvh' }}>
    {confirmation}
    {renderContacts ? renderContacts({ data, onOpen: (accountId, studentId) => navigate({ ...workspaceInitial, accountId, studentId: studentId || '', view: 'quick', section: 'profile' }) }) : <ContactsTable data={data} search={search} onSearch={setSearch} onOpen={(accountId, studentId) => navigate({ ...workspaceInitial, accountId, studentId: studentId || '', view: 'quick', section: 'profile' })} />}
    {invalid && <DenseSectionPanel title="Profile unavailable"><Button onClick={closeWorkspace}>Return to contacts</Button></DenseSectionPanel>}
    {(inlineTasks ? location.view !== 'contacts' : quick && !workspaceOpen) && account && !invalid && <SlidePanel isOpen onClose={closeWorkspace} width={inlineTasks || intent?.kind === 'invoice' ? 'min(calc(75vw + 200px), 1160px)' : PROFILE_PANEL_WIDTH} fullScreen={isMobile} ariaLabel={inlineTasks ? 'Family workspace V3' : 'Account quick reference'}>
      <SlidePanelHeader profileTransition actions={communicationActive || inlineTasks ? undefined : <Button size="sm" onClick={() => openWorkspace('profile')}>View Account Details</Button>} title={profileTitle} titleSize={isMobile ? typography.sizeLg : typography.size2xl} subtitle={selectedStudent ? 'Student profile' : 'Account manager'} avatar={{ firstName: selectedStudent?.firstName || account.holderName.split(' ')[0], lastName: selectedStudent?.lastName || account.holderName.split(' ').slice(1).join(' '), size: isMobile ? 36 : 48 }} onBack={communicationActive ? closeCommunication : undefined} backLabel="Back to profile" onClose={closeWorkspace} />
      {!communicationActive && <><SlidePanelActionBar isMobile={isMobile}>
        <div className={styles.toolbar} style={{ gap: spacing.sm }}>
          <Button aria-label="Call" disabled title="Calling is disabled in this preview"><Phone size={16} aria-hidden="true" />Call{inlineTasks && <span className={v3Styles.contactValue}>{activeContact?.phone || 'Not added'}</span>}</Button>
          <Button aria-label="Send SMS" variant="secondary" disabled={inlineTasks && !activeContact?.phone?.trim()} onClick={() => openCommunication('sms')} title="Open SMS conversation preview"><MessageSquare size={16} aria-hidden="true" />Send SMS{inlineTasks && <span className={v3Styles.contactValue}>{activeContact?.phone || 'Not added'}</span>}</Button>
          <Button aria-label="Send email" variant="secondary" disabled={inlineTasks && !activeContact?.email?.trim()} onClick={() => openCommunication('email')} title="Open email conversation preview"><Mail size={16} aria-hidden="true" />Send email{inlineTasks && <span className={v3Styles.contactValue}>{activeContact?.email || 'Not added'}</span>}</Button>
        </div>
        {inlineTasks && <Button variant="ghost" style={{ marginLeft: isMobile ? 0 : 'auto' }} onClick={() => { setIntent(null); setCalendarOpen(false); setMoveId(null); setLessonId(null); setMakeupId(null); setReplacementCancelId(null); setFamilyCanvas('edit') }}><Pencil size={14} aria-hidden="true" />Edit Contact</Button>}
      </SlidePanelActionBar>
      <div ref={sectionNavigation} className={styles.panelNavigation}>{inlineTasks ? sectionTabs : panelTabs}</div></>}
      <div ref={panelContent} data-workspace-content="" className={[styles.panelContent, inlineTasks ? v3Styles.content : '', communicationActive ? styles.communicationContent : ''].filter(Boolean).join(' ')} style={{ background: colors.surfaceMuted }}>
        {inlineTasks && (familyCanvas || communicationActive || movingLesson || cancellingReplacement || calendarOpen || intent || selectedMakeup) ? workspaceContent : lesson ? lessonContent : location.section === 'profile' ? <div className={styles.quickReferenceLayout}>
          <div className={styles.stack} style={{ gap: spacing.lg }}>
          {renderSection('profile', 'details')}
          {inlineTasks && selectedStudent && renderSection('profile', 'subscriptions')}
          {!inlineTasks && <>          <DenseSectionPanel title="Account Balance" actions={<Button size="sm" variant={hasOverdueInvoices ? 'destructive' : 'secondary'} onClick={() => openWorkspace('billing')}>View billing</Button>}>
            <p style={{ ...typography.h1, margin: `0 0 ${spacing.md}` }}>{previewMoney(contentData.invoices.filter(item => item.accountId === account.id && item.status === 'Open').reduce((total, item) => total + invoiceOutstanding(item), 0), 'USD')}</p>
            <p style={{ ...typography.bodySmall, color: colors.textSecondary }}>{unpaidInvoiceCount} unpaid invoice{unpaidInvoiceCount === 1 ? '' : 's'}</p>
            {nextPaymentDate && <DetailField label="Next payment" value={formatScheduleDate(nextPaymentDate)} />}
          </DenseSectionPanel>
          </>}
          {!inlineTasks && <DenseSectionPanel title="Makeup credits" actions={<Button size="sm" variant="secondary" disabled={!visibleMakeups.some(item => !item.booking)} onClick={() => openWorkspace('makeups')}>Book makeup</Button>}>
            {projectedStudents.map(student => <DetailField key={student.id} label={previewStudentName(student)} value={`${visibleMakeups.filter(item => item.studentId === student.id && !item.booking).length} available`} />)}
          </DenseSectionPanel>}
          </div>
          <div className={styles.stack} style={{ gap: spacing.lg }}>
            {inlineTasks && <>          <DenseSectionPanel title="Account Balance" actions={<Button size="sm" variant={hasOverdueInvoices ? 'destructive' : 'secondary'} onClick={() => openWorkspace('billing')}>View billing</Button>}>
            <p style={{ ...typography.h1, margin: `0 0 ${spacing.md}` }}>{previewMoney(contentData.invoices.filter(item => item.accountId === account.id && item.status === 'Open').reduce((total, item) => total + invoiceOutstanding(item), 0), 'USD')}</p>
            <p style={{ ...typography.bodySmall, color: colors.textSecondary }}>{unpaidInvoiceCount} unpaid invoice{unpaidInvoiceCount === 1 ? '' : 's'}</p>
            {nextPaymentDate && <DetailField label="Next payment" value={formatScheduleDate(nextPaymentDate)} />}
          </DenseSectionPanel>
            </>}
            {inlineTasks ? renderSection('profile', 'follow-up') : renderSection('profile', 'subscriptions')}
          </div>
        </div> : <>{renderSection(location.section)}</>}
      </div>
    </SlidePanel>}
    {!inlineTasks && workspaceOpen && account && <SlidePanel isOpen fullScreen onClose={closeWorkspace} ariaLabel="Family workspace V2">
      {!accountTaskActive && <SlidePanelHeader profileTransition headingLevel="h1" title={profileTitle} titleSize={isMobile ? typography.sizeLg : typography.size2xl} subtitle={selectedStudent ? 'Student profile' : 'Account manager'} avatar={{ firstName: selectedStudent?.firstName || account.holderName.split(' ')[0], lastName: selectedStudent?.lastName || account.holderName.split(' ').slice(1).join(' '), size: isMobile ? 36 : 48 }} onBack={communicationActive ? closeCommunication : backToPanel} backLabel="Back to profile" onClose={closeWorkspace} />}
      <div className={communicationActive ? styles.communicationContent : undefined} style={{ padding: isMobile ? spacing.lg : spacing['3xl'], overflowY: communicationActive ? 'hidden' : 'auto', flex: 1, minHeight: 0 }}><div className={communicationActive ? styles.communication : undefined} style={{ maxWidth: 1440, margin: '0 auto', width: '100%' }}>{workspaceContent}</div></div>
    </SlidePanel>}
  </div>
}
