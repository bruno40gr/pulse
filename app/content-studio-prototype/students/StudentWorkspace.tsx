'use client'

import { familyActionConfirmation, useActionConfirmation } from './useActionConfirmation'
import { useEffect, useRef, useState } from 'react'
import { Mail, MessageSquare, Phone } from 'lucide-react'
import { SlidePanelActionBar } from '@/components/ui/SlidePanelActionBar'
import { Button, DenseSectionPanel, PageHeader, SlidePanel, SlidePanelHeader, Tabs } from '@/components/ui'
import { colors, spacing, typography } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'
import { previewStudentName, workspaceInitial, workspaceLocationFromSearch, workspaceLocationSearch, workspaceOccurrences, type LessonRequest, type PreviewNote, type WorkspaceLocation } from '@/lib/academy-student-preview'
import { accountStudents, applyFamilyAction, createFamilyPreview, parentFamilyProjection, studentFamilyProjection, type FamilyAction } from '@/lib/academy-family-preview'
import { applyParentNote } from '@/lib/academy-parent-portal'
import { previewContacts } from '@/lib/academy-family-preview'
import { editPreviewNote, previewNoteActorId } from '@/lib/academy-student-preview'
import type { NoteAttachment } from '@/lib/note-links'
import { AccountPaymentMethods } from './AccountPaymentMethods'
import { ParentPortal } from './ParentPortal'
import { WorkspaceSections } from './WorkspaceSections'
import { WorkspaceManagement, type ManagementIntent } from './WorkspaceManagement'
import { LessonPreview } from './LessonPreview'
import { MakeupWorkspace } from './MakeupWorkspace'
import { bookPreviewMakeup, createScheduledMakeupPreview, recordPreviewAbsence } from '@/lib/academy-makeup-preview'
import styles from './StudentWorkspace.module.css'
import { PROFILE_PANEL_WIDTH } from '@/lib/conversation-display'
import { CalendarWorkspace } from './CalendarWorkspace'
import { MoveLesson } from './MoveLesson'
import { ContactsTable } from './ContactsTable'
import { expandPreviewCalendar, previewCalendarLessons, movePreviewLesson, cancelPreviewReplacement, absenceEligible } from '@/lib/academy-makeup-preview'

export default function StudentWorkspace() {
  const { confirm, confirmation } = useActionConfirmation()
  const [data, setData] = useState(() => expandPreviewCalendar(createFamilyPreview(), '2027-02-03'))
  const [makeups, setMakeups] = useState(createScheduledMakeupPreview)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarDate, setCalendarDate] = useState<string | undefined>()
  const [moveId, setMoveId] = useState<string | null>(null)
  const [replacementCancelId, setReplacementCancelId] = useState<string | null>(null)
  const [replacementError, setReplacementError] = useState('')
  const [bookedDate, setBookedDate] = useState<string | null>(null)
  const [makeupId, setMakeupId] = useState<string | null>(null)
  const makeupReturn = useRef<WorkspaceLocation | null>(null)
  const [location, setLocation] = useState<WorkspaceLocation>(workspaceInitial)
  const [ready, setReady] = useState(false)
  const [search, setSearch] = useState('')
  const [lessonId, setLessonId] = useState<string | null>(null)
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
  const returnTo = useRef<WorkspaceLocation | null>(null)
  const isMobile = useIsMobile()
  useEffect(() => {
    const restore = () => { setLocation(workspaceLocationFromSearch(window.location.search)); setLessonId(null); setIntent(null); setMakeupId(null); setCalendarOpen(false); setMoveId(null); setReplacementCancelId(null) }
    restore(); setReady(true)
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])
  function navigate(next: WorkspaceLocation) {
    window.history.pushState({ ...window.history.state }, '', `${window.location.pathname}${workspaceLocationSearch(next, window.location.search)}`)
    setLocation(next); setLessonId(null); setIntent(null); setCalendarOpen(false); setMoveId(null); setReplacementCancelId(null); setBookedDate(null)
  }
  function update(patch: Partial<WorkspaceLocation>) { navigate({ ...location, ...patch }) }
  function scheduleMakeup(id: string) {
    makeupReturn.current = location
    setMakeupId(id)
    update({ view: parent ? 'parent' : 'staff', section: 'scheduling' })
  }
  function closeMakeup() { setMakeupId(null); if (makeupReturn.current) navigate(makeupReturn.current) }
  function openAccount(accountId: string, view: WorkspaceLocation['view'] = 'quick') { navigate({ ...workspaceInitial, accountId, view, section: 'profile' }) }
  function previewParent() { returnTo.current = location; navigate({ ...workspaceInitial, accountId: 'preview:kim', view: 'parent' }) }
  function returnToStaff() { navigate(returnTo.current || { ...workspaceInitial, accountId: 'preview:kim', view: 'staff' }); returnTo.current = null }
  const parent = location.view === 'parent', quick = location.view === 'quick'
  // Student routes retain their own presentation scope inside the account.
  const account = data.accounts.find(item => location.accountId ? item.id === location.accountId : location.studentId ? item.studentIds.includes(location.studentId) : parent && item.id === 'preview:kim')
  const invalid = location.view !== 'contacts' && (!account || (parent && account.id !== 'preview:kim') || Boolean(location.studentId && !account.studentIds.includes(location.studentId)) || Boolean(location.enrollmentId && !accountStudents(data, account).some(student => (!location.studentId || student.id === location.studentId) && student.enrollments.some(item => item.id === location.enrollmentId))))
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
  const toolbar = <>
    {!parent && <Button disabled title="Calling is disabled in this preview"><Phone size={16} aria-hidden="true" />Call</Button>}
    <Button variant="secondary" onClick={() => openCommunication('sms')} title="Open SMS conversation preview"><MessageSquare size={16} aria-hidden="true" />Send SMS</Button>
    <Button variant="secondary" onClick={() => openCommunication('email')} title="Open email conversation preview"><Mail size={16} aria-hidden="true" />Send email</Button>
  </>
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
    try { const next = recordPreviewAbsence(contentData, makeups, account!.id, lesson.id, grantLate, parent); setData(current => ({ ...current, lessons: current.lessons.map(item => next.data.lessons.find(updated => updated.id === item.id) || item) })); setMakeups(next.state); confirm('Lesson absence recorded.'); return null } catch (error) { return error instanceof Error ? error.message : 'Unable to record absence.' }
  }} />
  const managementContent = intent && account && !parent && <WorkspaceManagement key={`${account.id}:${intent.kind}:${intent.enrollmentId || ''}`} data={contentData} account={account} studentId={location.studentId} intent={intent} onApply={apply} onClose={() => setIntent(null)} />

  const selectedStudent = projectedStudents.find(student => student.id === location.studentId)
  const profileTitle = selectedStudent ? previewStudentName(selectedStudent) : account?.holderName || ''
  const sectionTabs = <nav aria-label="Family sections" className={styles.tabs}><Tabs items={[{ key: 'profile', label: 'Account' }, { key: 'enrollments', label: quick ? 'Upcoming classes' : 'Schedule' }, { key: 'notes', label: 'Notes' }, { key: 'billing', label: 'Billing' }, { key: 'makeups', label: 'Makeups', count: visibleMakeups.filter(item => !item.booking).length || undefined, countAppearance: 'bubble' }]} activeKey={location.section === 'scheduling' ? 'enrollments' : location.section === 'payment-methods' ? 'billing' : location.section} onChange={section => update({ section: section as WorkspaceLocation['section'], enrollmentId: '' })} style={{ width: 'max-content', minWidth: '100%' }} /></nav>

  const content = location.section === 'payment-methods' ? paymentMethodsContent : account && !invalid ? <WorkspaceSections onPaymentMethods={openPaymentMethods} onEnsure={through => setData(current => expandPreviewCalendar(current, through))} onCalendar={() => setCalendarOpen(true)} data={contentData} account={account} location={scopedLocation} students={projectedStudents} occurrences={occurrences} requests={requests} notes={notes} drafts={drafts} channel={channel} onCommunicationBack={closeCommunication} onDraft={(key, value) => setDrafts(current => ({ ...current, [key]: value }))} onAddNote={addNote} onEditNote={(subject, kind, noteId, text) => { const key = `${subject}:${kind}`; const entry = notes[key]?.find(note => note.id === noteId); if (!entry || entry.actor_id !== previewNoteActorId || !text.trim()) return false; setNotes(current => ({ ...current, [key]: current[key].map(note => note.id === noteId ? editPreviewNote(note, previewNoteActorId, text) : note) })); return true }} onCompleteNote={completeNote} onNavigate={patch => update({ accountId: account.id, ...patch })} onLesson={openLesson} onMove={setMoveId} onManage={setIntent} onApply={apply} makeups={visibleMakeups} onMakeup={scheduleMakeup} /> : null
  if (!ready) return <div style={{ padding: spacing.xl }}>Loading preview…</div>
  if (parent && account && !invalid) return <ParentPortal notes={notes} onSaveNote={(studentId, text, id, links) => { try { setNotes(applyParentNote(data, account.id, notes, { studentId, text, id: id || `preview:note:${crypto.randomUUID()}`, edit: Boolean(id), links })); return true } catch { return false } }} data={data} account={account} makeups={makeups} onData={setData} onMakeups={setMakeups} onExit={() => {
    const params = new URLSearchParams(window.location.search)
    params.delete('portal')
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${params}`)
    navigate({ ...workspaceInitial, view: 'contacts' })
  }} />
  return <div className={styles.root} style={{ padding: isMobile ? spacing.lg : spacing['3xl'], color: colors.text, fontFamily: typography.fontSans, background: colors.background, minHeight: '100dvh' }}>
    {confirmation}
    <div hidden={Boolean(!(location.view === 'contacts' || quick) || intent || movingLesson || cancellingReplacement || calendarOpen || selectedMakeup)}>
    <ContactsTable data={data} search={search} onSearch={setSearch} onParent={previewParent} onOpen={(accountId, studentId) => studentId ? navigate({ ...workspaceInitial, accountId, studentId, view: 'quick' }) : openAccount(accountId)} /></div>
    {movingLesson && account ? <MoveLesson profileSubtitle={selectedStudent ? 'Student profile' : 'Account manager'} accountName={profileTitle} key={movingLesson.id} item={movingLesson} data={familyData} state={makeups} onBack={() => setMoveId(null)} onMove={booking => {
      try { const next = movePreviewLesson(data, makeups, account.id, movingLesson.id, booking); setData(next.data); setMakeups(next.state); setMoveId(null); confirm('Lesson rescheduled. The recurring subscription is unchanged.'); return null } catch (error) { return error instanceof Error ? error.message : 'Unable to move lesson.' }
    }} /> : cancellingReplacement && account ? <>
      <PageHeader title="Cancel makeup lesson" onBack={() => setReplacementCancelId(null)} backLabel="Back to lessons" />
      <DenseSectionPanel title={`${cancellingReplacement.program} · ${cancellingReplacement.date}`} actions={<Button variant="destructive" onClick={() => {
        try { setMakeups(cancelPreviewReplacement(data, makeups, account.id, cancellingReplacement.id)); setReplacementCancelId(null); confirm('Makeup lesson cancelled.') } catch (error) { setReplacementError(error instanceof Error ? error.message : 'Unable to cancel lesson.') }
      }}>Cancel lesson</Button>}><p style={typography.body}>{absenceEligible(cancellingReplacement.date, cancellingReplacement.time) ? 'Cancelling returns this unused makeup credit.' : 'Cancelling this lesson will forfeit the makeup credit because it is less than 24 hours away.'}</p><p style={typography.bodySmall}>{cancellingReplacement.time} · {cancellingReplacement.teacher}</p>{replacementError && <p role="alert">{replacementError}</p>}</DenseSectionPanel>
    </> : calendarOpen && account && !invalid && !lessonId ? <CalendarWorkspace profileSubtitle={selectedStudent ? 'Student profile' : 'Account manager'} accountName={profileTitle} data={contentData} makeups={visibleMakeups} location={scopedLocation} initialDate={calendarDate} onBack={() => setCalendarOpen(false)} onLesson={openLesson} onMove={setMoveId} onEnsure={through => setData(current => expandPreviewCalendar(current, through))} /> : intent && account && !invalid ? managementContent : selectedMakeup && account ? <MakeupWorkspace profileSubtitle={selectedStudent ? 'Student profile' : 'Account manager'} accountName={profileTitle} key={selectedMakeup.id} data={familyData} state={makeups} makeup={selectedMakeup} onBack={closeMakeup} onBook={booking => {
      try { setMakeups(bookPreviewMakeup(familyData, makeups, account.id, selectedMakeup.id, booking)); closeMakeup(); setBookedDate(booking.date); confirm('Makeup lesson booked.'); return null } catch (error) { return error instanceof Error ? error.message : 'Unable to book makeup.' }
    }} /> : <>

    {invalid ? <DenseSectionPanel title="Profile unavailable" headingLevel="h2"><p>This account, student or enrollment is not available in this preview context.</p><Button onClick={() => navigate({ ...workspaceInitial, view: parent ? 'parent' : 'contacts', accountId: parent ? 'preview:kim' : '' })}>Return to {parent ? 'family' : 'contacts'}</Button></DenseSectionPanel> : account && (location.view === 'staff' || parent) && <>
      <PageHeader title={profileTitle} onBack={communicationActive ? closeCommunication : parent ? returnToStaff : () => update({ view: 'quick' })} backLabel={communicationActive ? 'Back to profile' : parent ? 'Back to staff preview' : 'Back to quick view'} right={!parent && account.id === 'preview:kim' ? <Button variant="secondary" onClick={previewParent}>Preview parent portal</Button> : undefined} />
      {!communicationActive && <div className={styles.toolbar} style={{ marginBottom: spacing.lg }}>{toolbar}</div>}
      {!communicationActive && sectionTabs}
      <div style={{ marginTop: spacing.lg }}>{intent ? managementContent : lesson ? lessonContent : <>{bookedDate && <DenseSectionPanel title="Makeup booked" actions={<Button variant="secondary" size="sm" onClick={() => { setCalendarDate(bookedDate); setCalendarOpen(true); setBookedDate(null) }}>View this lesson</Button>}><span style={typography.bodySmall}>{bookedDate}</span></DenseSectionPanel>}{content}</>}</div>
    </>}
    {quick && account && !invalid && <SlidePanel isOpen onClose={() => update({ view: 'contacts' })} width={PROFILE_PANEL_WIDTH} fullScreen={isMobile} >
      <SlidePanelHeader profileTransition title={profileTitle} titleSize={isMobile ? typography.sizeLg : typography.size2xl} avatar={{ firstName: selectedStudent?.firstName || account.holderName.split(' ')[0], lastName: selectedStudent?.lastName || account.holderName.split(' ').slice(1).join(' '), size: isMobile ? 36 : 48 }} subtitle={selectedStudent ? 'Student profile' : 'Account manager'} onClose={() => update({ view: 'contacts' })} onBack={communicationActive ? closeCommunication : undefined} backLabel={communicationActive ? 'Back to profile' : quick ? 'Back to upcoming' : 'Back to schedule'} />
      {!communicationActive && !intent && <>
        <SlidePanelActionBar isMobile={isMobile}><div role="group" aria-label="Contact actions" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }}>{toolbar}</div></SlidePanelActionBar>
        <div className={styles.panelNavigation}>{sectionTabs}</div>
      </>}
      <div className={[styles.panelContent, communicationActive ? styles.communicationContent : ''].filter(Boolean).join(' ')} style={{ background: colors.surfaceMuted }}>{intent ? managementContent : lesson ? lessonContent : <>{bookedDate && <DenseSectionPanel title="Makeup booked" actions={<Button variant="secondary" size="sm" onClick={() => { setCalendarDate(bookedDate); setCalendarOpen(true); setBookedDate(null) }}>View this lesson</Button>}><span style={typography.bodySmall}>{bookedDate}</span></DenseSectionPanel>}{content}</>}</div>
    </SlidePanel>}
    </>}

  </div>
}
