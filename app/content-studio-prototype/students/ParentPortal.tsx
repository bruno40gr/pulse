'use client'

import { familyActionConfirmation, useActionConfirmation } from './useActionConfirmation'

import { ConfirmActionButton } from './ConfirmActionButton'

import { List, Grid2X2 } from 'lucide-react'

import { useEffect, useRef, useState } from 'react'
import { Button, DenseSectionPanel, DetailField, EmptyState, Modal, ModalBody, ModalHeader, Select } from '@/components/ui'
import { BackControl } from '@/components/ui/BackControl'
import { invoiceStatus } from '@/lib/academy-invoice-document'
import { spacing, typography } from '@/lib/tokens'
import { formatScheduleDate, formatScheduleTime } from '@/lib/academy-enrollment-schedule'
import { applyParentPortalAction, applyParentScheduleAction, parentPortalProjection } from '@/lib/academy-parent-portal'
import { invoiceOutstanding, nextPreviewPaymentDate, type FamilyAction, type FamilyPreviewData, type PreviewAccount } from '@/lib/academy-family-preview'
import { previewMoney, previewStudentName, workspaceInitial, type PreviewNote } from '@/lib/academy-student-preview'
import { absenceEligible, makeupSlots, expandPreviewCalendar, previewCalendarLessons, makeupPreviewNow, recordPreviewAbsence, type MakeupPreviewState } from '@/lib/academy-makeup-preview'
import { Cards, PayInvoiceForm, type ManagementIntent } from './WorkspaceManagement'
import { InvoiceHistoryFilter, filterInvoiceHistory, type InvoiceHistoryView } from './InvoiceHistoryFilter'
import { InvoiceCard, InvoicePreview } from './InvoicePreview'
import { LessonPreview } from './LessonPreview'
import { MakeupWorkspace } from './MakeupWorkspace'
import { InlineWorkspaceContext } from './InlineWorkspaceContext'
import { ContactEditor } from './ContactEditor'
import { previewContacts } from '@/lib/academy-family-preview'
import { WeeklySchedule } from './WeeklySchedule'
import { MoveLesson } from './MoveLesson'
import { ParentFamilyGroup } from './ParentFamilyGroup'
import { ParentNotes } from './ParentNotes'
import { ControlButton } from '@/components/ui/ControlButton'
import type { NoteAttachment } from '@/lib/note-links'
import styles from './ParentPortal.module.css'

type Section = 'home' | 'lessons' | 'billing' | 'payment-methods' | 'account' | 'notes' | 'makeups'
type Props = { notes: Record<string, PreviewNote[]>; onSaveNote: (studentId: string, text: string, id?: string, links?: NoteAttachment[]) => boolean; data: FamilyPreviewData; account: PreviewAccount; makeups: MakeupPreviewState; onData: (data: FamilyPreviewData) => void; onMakeups: (state: MakeupPreviewState) => void; onExit: () => void }

/** Fictional self-service surface. Receives no access to live payment or identity APIs. */
export function ParentPortal({ data, account, makeups, notes, onSaveNote, onData, onMakeups, onExit }: Props) {
  const [section, setSection] = useState<Section>(() => {
    const value = new URLSearchParams(window.location.search).get('portal')
    return value === 'makeups' || value === 'notes' || value === 'account' || value === 'lessons' || value === 'billing' || value === 'payment-methods' ? value : 'home'
  })
  const contentRef = useRef<HTMLElement>(null)
  const [studentId, setStudentId] = useState('')
  const [lessonLimit, setLessonLimit] = useState(16)
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [makeupId, setMakeupId] = useState<string | null>(null)
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [invoiceView, setInvoiceView] = useState<InvoiceHistoryView>('all')
  const [payment, setPayment] = useState<ManagementIntent | null>(null)
  const { confirm, confirmation } = useActionConfirmation()
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [week, setWeek] = useState('2026-11-02')
  const [moveId, setMoveId] = useState<string | null>(null)
  const [cancelMakeupId, setCancelMakeupId] = useState<string | null>(null)
  const [scheduleError, setScheduleError] = useState('')
  const [approvalRequired, setApprovalRequired] = useState(false)
  const visible = parentPortalProjection(data, account)
  const payers = [{ id: account.holderId, name: account.holderName }]
  const location = { ...workspaceInitial, view: 'parent' as const, accountId: account.id }
  const lessons = previewCalendarLessons(visible, makeups.items, location).filter(lesson => `${lesson.date}T${lesson.time}:00-08:00` >= makeupPreviewNow)
  const filteredLessons = lessons.filter(lesson => !studentId || lesson.student.id === studentId)
  const credits = makeups.items.filter(item => visible.students.some(student => student.id === item.studentId && student.enrollments.some(enrollment => enrollment.id === item.enrollmentId)))
  const unused = credits.filter(item => !item.booking)
  const scopedUnused = unused.filter(item => !studentId || item.studentId === studentId)
  const nextPayment = nextPreviewPaymentDate(visible, visible.students.map(student => student.id), makeupPreviewNow.slice(0, 10))
  const open = visible.invoices.filter(invoice => invoice.status === 'Open')
  const hasOverdueInvoices = open.some(invoice => invoiceStatus(invoice) === 'Overdue')
  const balance = open.reduce((total, invoice) => total + invoiceOutstanding(invoice), 0)
  const moving = lessons.find(lesson => lesson.id === moveId)
  const cancellingMakeup = lessons.find(lesson => lesson.id === cancelMakeupId && lesson.makeup)
  const selectedLesson = lessons.find(lesson => lesson.id === lessonId)
  const selectedMakeup = unused.find(item => item.id === makeupId)
  const selectedInvoice = visible.invoices.find(invoice => invoice.id === invoiceId)

  useEffect(() => {
    const hidden: { element: HTMLElement; inert: boolean }[] = []
    let branch: HTMLElement | null = document.querySelector('[data-parent-portal]')
    while (branch?.parentElement && branch.parentElement !== document.body) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling !== branch && sibling instanceof HTMLElement && !['SCRIPT', 'STYLE', 'LINK'].includes(sibling.tagName)) {
          hidden.push({ element: sibling, inert: sibling.inert }); sibling.inert = true
        }
      }
      branch = branch.parentElement
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const restore = () => {
      const value = new URLSearchParams(window.location.search).get('portal')
      setSection(value === 'makeups' || value === 'notes' || value === 'account' || value === 'lessons' || value === 'billing' || value === 'payment-methods' ? value : 'home')
      setLessonId(null); setMakeupId(null); setInvoiceId(null); setPayment(null); setMoveId(null); setCancelMakeupId(null); setScheduleError('')
    }
    window.addEventListener('popstate', restore)
    return () => { document.body.style.overflow = previous; hidden.forEach(({ element, inert }) => { element.inert = inert }); window.removeEventListener('popstate', restore) }
  }, [])

  useEffect(() => {
    const heading = contentRef.current?.querySelector<HTMLElement>('h1, h2')
    heading?.setAttribute('tabindex', '-1')
    heading?.focus({ preventScroll: true })
  }, [section, lessonId, makeupId, invoiceId, moveId])

  function navigate(next: Section) {
    const params = new URLSearchParams(window.location.search)
    params.set('portal', next)
    params.delete('student'); params.delete('enrollment')
    window.history.pushState({ ...window.history.state }, '', `${window.location.pathname}?${params}`)
    setApprovalRequired(false); setSection(next); setLessonId(null); setMakeupId(null); setInvoiceId(null); setPayment(null); setMoveId(null); setCancelMakeupId(null); setScheduleError('')
    document.querySelector('[data-parent-portal]')?.scrollTo({ top: 0 })
  }
  function apply(action: FamilyAction): string | null {
    try { onData(applyParentPortalAction(data, account.id, action)); confirm(familyActionConfirmation(action, true)); return null } catch (error) { return error instanceof Error ? error.message : 'Unable to save.' }
  }
  function openLesson(id: string) {
    const lesson = lessons.find(item => item.id === id)
    setScheduleError('')
    if (lesson?.makeup) setCancelMakeupId(id)
    else setLessonId(id)
  }
  function startMove(id: string) {
    const lesson = lessons.find(item => item.id === id && item.status === 'Scheduled')
    if (!lesson) return
    if (!absenceEligible(lesson.date, lesson.time)) { setApprovalRequired(true); return }
    setScheduleError(''); setMoveId(id)
  }
  function renderLessons(limit?: number) {
    const rows = filteredLessons.slice(0, limit || lessonLimit)
    return rows.length ? rows.map(lesson => <div className={styles.row} key={lesson.id}>
      <div className={styles.rowText}><strong>{previewStudentName(lesson.student)} · {lesson.program}{lesson.makeup ? ' · Makeup' : ''}</strong><span>{formatScheduleDate(lesson.date, { weekday: 'short', month: 'short', day: 'numeric' })} · {formatScheduleTime(lesson.time)} · {lesson.duration} min</span><span className={styles.muted}>{lesson.teacher} · {lesson.room} · {lesson.status}</span></div>
      <div className={styles.lessonActions}><Button variant="secondary" size="sm" onClick={() => { navigate('lessons'); openLesson(lesson.id) }} aria-label={`View ${lesson.student.firstName} ${lesson.program} ${lesson.date}`}>View lesson</Button>{section === 'lessons' && lesson.status === 'Scheduled' && <Button variant="secondary" size="sm" aria-label={`Reschedule ${lesson.student.firstName} ${lesson.program} lesson ${lesson.date}`} onClick={() => startMove(lesson.id)}>Reschedule lesson</Button>}</div>
    </div>) : <EmptyState title="No upcoming lessons" />
  }
  function openMakeups() {
    navigate('makeups')
    setMakeupId(scopedUnused[0]?.id || null)
  }
  const makeupBlocks = <section aria-label="Makeup credits and bookings" className={styles.makeupBlocks}>
    <h2 style={{ ...typography.h2, margin: 0 }}>Makeup credits ({scopedUnused.length})</h2>
    {scopedUnused.map(item => <ControlButton key={item.id} kind="row" selected={item.id === makeupId} aria-pressed={item.id === makeupId} aria-label={`Book ${item.program} makeup ${item.date}`} onClick={() => setMakeupId(item.id)}><span className={styles.makeupBlockText}><strong>{visible.students.find(student => student.id === item.studentId)?.firstName} · {item.program} · {item.duration} min</strong><span className={styles.muted}>Credit from {formatScheduleDate(item.date)}</span></span></ControlButton>)}
    {!scopedUnused.length && <p className={styles.muted}>No unused makeup credits.</p>}
    {credits.some(item => item.booking && (!studentId || item.studentId === studentId)) && <><h2 style={{ ...typography.h2, margin: 0 }}>Booked makeups</h2>{credits.filter(item => item.booking && (!studentId || item.studentId === studentId)).map(item => <div key={item.id} className={`${styles.makeupBlockText} ${styles.bookedBlock}`}><strong>{visible.students.find(student => student.id === item.studentId)?.firstName} · {item.booking!.program}</strong><span className={styles.muted}>{formatScheduleDate(item.booking!.date)} · {formatScheduleTime(item.booking!.time)} · {item.booking!.teacher}</span></div>)}</>}
  </section>
  const billingActions = <Button variant="secondary" onClick={() => navigate('payment-methods')}>Payment methods</Button>
  const paymentModal = <Modal isOpen={Boolean(payment)} onClose={() => setPayment(null)} ariaLabel="Pay"><ModalHeader title="Pay" onClose={() => setPayment(null)} /><ModalBody>{payment && <PayInvoiceForm key={`${payment.kind}:${payment.invoiceId || ''}`} data={visible} account={account} intent={payment} payerOptions={payers} onApply={apply} onClose={() => setPayment(null)} onOpenBillingAccount={() => navigate('payment-methods')} />}</ModalBody></Modal>

  return <InlineWorkspaceContext.Provider value={true}><div className={styles.portal} data-parent-portal="" style={{ fontFamily: typography.fontSans }}>
    <header className={styles.topbar}><div className={styles.topbarInner}>
      <div className={styles.brand}><span className={styles.brandMark} aria-hidden="true">O</span><div><strong>Odeon</strong><div className={styles.identity}>Parent portal · {account.holderName}</div></div></div>
      <nav className={styles.nav} aria-label="Parent portal navigation">{([{ key: 'home', label: 'Home' }, { key: 'lessons', label: 'Lessons' }, { key: 'notes', label: 'Notes' }, { key: 'billing', label: 'Billing' }, { key: 'account', label: 'Account' }] as const).map(item => <Button key={item.key} variant={(section === 'payment-methods' ? 'billing' : section === 'makeups' ? 'lessons' : section) === item.key ? 'primary' : 'ghost'} aria-current={(section === 'payment-methods' ? 'billing' : section === 'makeups' ? 'lessons' : section) === item.key ? 'page' : undefined} onClick={() => navigate(item.key)}>{item.label}</Button>)}</nav>
      <Button variant="secondary" size="sm" onClick={onExit}>Exit parent preview</Button>
    </div></header>
    <main ref={contentRef} className={styles.content} aria-label="Parent portal">
      <p className={styles.preview}>Interactive preview · Fictional data · Schedule shown in Pacific time · No real charges · Changes reset on refresh</p>
      {confirmation}
      {moving ? <MoveLesson availableSlots={date => makeupSlots({ ...data, lessons: data.lessons.filter(item => item.id !== moving.id) }, { ...makeups, items: makeups.items.filter(item => item.id !== moving.id) }, { id: moving.id, lessonId: moving.id, studentId: moving.student.id, enrollmentId: moving.enrollmentId, date: moving.date, program: moving.program, duration: moving.duration, teacher: moving.teacher, service: moving.enrollment.service }, date, moving.program, false)} key={moving.id} item={moving} data={visible} state={makeups} initialDate={moving.date} accountName={previewStudentName(moving.student)} onBack={() => setMoveId(null)} onMove={booking => {
        try { const next = applyParentScheduleAction(data, makeups, account.id, { kind: 'move', id: moving.id, booking }); onData(next.data); onMakeups(next.state); setMoveId(null); confirm('I’ve rescheduled the lesson.'); return null } catch (error) { return error instanceof Error ? error.message : 'Unable to reschedule lesson.' }
      }} /> : selectedMakeup ? <MakeupWorkspace sidebar={makeupBlocks} availableSlots={date => makeupSlots(data, makeups, selectedMakeup, date, selectedMakeup.program, false)} key={selectedMakeup.id} data={visible} state={makeups} makeup={selectedMakeup} accountName={visible.students.find(student => student.id === selectedMakeup.studentId) ? previewStudentName(visible.students.find(student => student.id === selectedMakeup.studentId)!) : account.holderName} onBack={() => { setMakeupId(null); if (section === 'makeups') navigate('lessons') }} onBook={booking => {
        try { onMakeups(applyParentScheduleAction(data, makeups, account.id, { kind: 'book', id: selectedMakeup.id, booking }).state); setMakeupId(null); if (section === 'makeups') navigate('lessons'); confirm('I’ve booked the makeup lesson.'); return null } catch (error) { return error instanceof Error ? error.message : 'Unable to book makeup.' }
      }} /> : section === 'makeups' && !selectedLesson ? <><BackControl label="Back to lessons" showLabel onClick={() => navigate('lessons')} /><div className={styles.intro}><h1>Schedule a makeup</h1></div><div className={styles.makeupLayout}>{makeupBlocks}<WeeklySchedule data={visible} makeups={credits} location={{ ...location, studentId }} taskLayout week={week} onWeek={setWeek} onEnsure={through => onData(expandPreviewCalendar(data, through))} onLesson={openLesson} onMove={startMove} compact /></div></> : selectedLesson ? <LessonPreview key={selectedLesson.id} lesson={selectedLesson} parent absence={makeups.absences.find(item => item.lessonId === selectedLesson.id)} onBack={() => setLessonId(null)} onSchedule={id => { setLessonId(null); setMakeupId(id) }} onCancel={() => {
        try { const next = recordPreviewAbsence(data, makeups, account.id, selectedLesson.id, false, true); onData(next.data); onMakeups(next.state); confirm('I’ve cancelled the lesson.'); return null } catch (error) { return error instanceof Error ? error.message : 'Unable to cancel lesson.' }
      }} /> : selectedInvoice ? <InvoicePreview invoice={selectedInvoice} onBack={() => setInvoiceId(null)} onPay={selectedInvoice.status === 'Open' ? () => setPayment({ kind: 'pay', invoiceId: selectedInvoice.id }) : undefined} /> : section === 'home' ? <>
        <div className={styles.intro}><div><h1>Hi, {account.holderName.split(' ')[0]}.</h1><p>Your children’s lessons and your account, in one place.</p></div></div>
        <div className={styles.grid}><DenseSectionPanel title="Upcoming lessons" headingLevel="h2" actions={<Button variant="secondary" size="sm" onClick={() => navigate('lessons')}>View all lessons</Button>}>{renderLessons(4)}</DenseSectionPanel><div className={styles.stack}>
          <DenseSectionPanel title="Your balance" headingLevel="h2" actions={<Button variant={hasOverdueInvoices ? 'destructive' : 'secondary'} size="sm" onClick={() => navigate('billing')}>View billing</Button>}><p className={styles.amount}>{previewMoney(balance, 'USD')}</p>{nextPayment && <p className={styles.muted}>Next payment · {formatScheduleDate(nextPayment)}</p>}<span className={styles.muted}>{open.length ? `${open.length} unpaid invoice${open.length === 1 ? '' : 's'} billed to you` : 'You’re all paid up.'}</span></DenseSectionPanel>
          <DenseSectionPanel title="Makeup credits" headingLevel="h2" actions={<Button variant="secondary" size="sm" onClick={openMakeups}>View credits</Button>}><strong>{unused.length} available</strong><p className={styles.muted}>Choose a time that works for you. Credits stay with the student they were issued to.</p></DenseSectionPanel>
        </div></div>
        <h2 style={{ ...typography.h2, margin: 0 }}>Your children</h2><div className={styles.children}>{visible.students.map(student => <DenseSectionPanel key={student.id} title={previewStudentName(student)} actions={<Button variant="secondary" size="sm" onClick={() => { setStudentId(student.id); navigate('lessons') }}>View {student.firstName}’s lessons</Button>}>{student.enrollments.map(enrollment => <div className={styles.rowText} key={enrollment.id} style={{ marginBottom: spacing.md }}><strong>{enrollment.program} · {enrollment.duration} min</strong><span className={styles.muted}>{enrollment.day} · {formatScheduleTime(enrollment.time)} · {enrollment.teacher}</span></div>)}</DenseSectionPanel>)}</div>
      </> : section === 'notes' ? <ParentNotes drafts={noteDrafts} onDraft={(id, text) => setNoteDrafts(current => ({ ...current, [id]: text }))} data={visible} account={account} notes={notes} onSave={onSaveNote} /> : section === 'lessons' ? <>
        <div className={styles.intro}><div><h1>Lessons</h1><p>Upcoming lessons and makeup credits for your children.</p></div><Select label="Student" value={studentId} onChange={event => setStudentId(event.target.value)}><option value="">All children</option>{visible.students.map(student => <option value={student.id} key={student.id}>{previewStudentName(student)}</option>)}</Select></div>
        <div className={styles.lessonToolbar}><div role="group" aria-label="Lesson view">{(['list', 'calendar'] as const).map(value => <ControlButton key={value} kind="toggle" aria-pressed={view === value} selected={view === value} onClick={() => setView(value)}>{value === 'list' ? <List size={16} aria-hidden="true" /> : <Grid2X2 size={16} aria-hidden="true" />}{value === 'list' ? 'List' : 'Calendar'}</ControlButton>)}</div><Button onClick={openMakeups}>Schedule a makeup ({scopedUnused.length})</Button></div>
        {scheduleError && <p role="alert">{scheduleError}</p>}
        {view === 'calendar' ? <WeeklySchedule data={visible} makeups={credits} location={{ ...location, studentId }} taskLayout week={week} onWeek={setWeek} onEnsure={through => onData(expandPreviewCalendar(data, through))} onLesson={openLesson} onMove={startMove} compact /> : <DenseSectionPanel title="Upcoming lessons" headingLevel="h2" actions={filteredLessons.length > lessonLimit ? <Button variant="secondary" size="sm" onClick={() => setLessonLimit(value => value + 16)}>Show more lessons</Button> : undefined}>{renderLessons()}</DenseSectionPanel>}
      </> : section === 'account' ? <>
        <div className={styles.intro}><h1>Account</h1></div>
        <div className={styles.accountGrid}>
          <div className={styles.stack}>
            {previewContacts(data).filter(person => person.id === account.holderId).map(contact => <ContactEditor key={contact.id} contact={contact} accountId={account.id} onApply={apply} />)}
            <ParentFamilyGroup account={account} students={visible.students.filter(student => student.id !== account.holderId)} onApply={apply} />
          </div>
          <aside aria-label="Account billing summary" className={styles.stack}>
            <DenseSectionPanel title="Your balance" headingLevel="h2" actions={<Button variant={hasOverdueInvoices ? 'destructive' : 'secondary'} size="sm" onClick={() => navigate('billing')}>View billing</Button>}>
              <p className={styles.amount}>{previewMoney(balance, 'USD')}</p>
              <p className={styles.muted}>{open.length} unpaid invoice{open.length === 1 ? '' : 's'}</p>
              {nextPayment && <DetailField label="Next payment" value={formatScheduleDate(nextPayment)} />}
            </DenseSectionPanel>
          </aside>
        </div>
      </> : section === 'billing' ? <>
        <div className={styles.intro}><div><h1>Billing</h1><p>Invoices billed to {account.holderName}.</p></div>{billingActions}</div>
        <DenseSectionPanel title={`${previewMoney(balance, 'USD')} due`} headingLevel="h2" actions={open.length > 1 ? <Button variant="secondary" onClick={() => setPayment({ kind: 'pay-all', invoiceIds: open.map(invoice => invoice.id) })}>Pay total</Button> : undefined}><span className={styles.muted}>Payments use the saved payment method you choose. You’ll review before confirming.</span></DenseSectionPanel>
        <section aria-label="Your invoices" className={styles.stack}><InvoiceHistoryFilter value={invoiceView} onChange={setInvoiceView} />{filterInvoiceHistory(visible.invoices, invoiceView).map(invoice => <InvoiceCard key={invoice.id} invoice={invoice} onView={() => setInvoiceId(invoice.id)} onPay={() => setPayment({ kind: 'pay', invoiceId: invoice.id })} />)}{!filterInvoiceHistory(visible.invoices, invoiceView).length && <EmptyState title={invoiceView === 'past' ? 'No past invoices' : invoiceView === 'unpaid' ? 'No unpaid invoices' : 'No invoices'} />}</section>
      </> : <>
        <BackControl label="Back to billing" showLabel onClick={() => navigate('billing')} /><div className={styles.intro}><div><h1>Payment methods</h1><p>Saved for {account.holderName}. A different name on a card does not change your account.</p></div></div>
        <DenseSectionPanel title="Your saved cards" headingLevel="h2"><Cards data={visible} account={account} intent={{ kind: 'cards' }} payerOptions={payers} onApply={apply} onClose={() => navigate('billing')} /></DenseSectionPanel>
      </>}
    </main>{paymentModal}
    <Modal isOpen={approvalRequired} onClose={() => setApprovalRequired(false)} ariaLabel="Staff approval required"><ModalHeader title="Staff approval required" onClose={() => setApprovalRequired(false)} /><ModalBody><p>Rescheduling less than 24 hours before a lesson requires staff approval. Contact the academy.</p><Button onClick={() => setApprovalRequired(false)}>Got it</Button></ModalBody></Modal>
    <Modal isOpen={Boolean(cancellingMakeup)} onClose={() => setCancelMakeupId(null)} ariaLabel="Cancel makeup lesson"><ModalHeader title="Cancel makeup lesson" onClose={() => setCancelMakeupId(null)} /><ModalBody><p>{cancellingMakeup && `${previewStudentName(cancellingMakeup.student)} · ${cancellingMakeup.program} · ${formatScheduleDate(cancellingMakeup.date)} · ${formatScheduleTime(cancellingMakeup.time)}`}</p><p>{cancellingMakeup && absenceEligible(cancellingMakeup.date, cancellingMakeup.time) ? 'Cancelling returns this makeup credit so you can book another time.' : 'Less than 24 hours remain. Cancelling will forfeit this makeup credit.'}</p><Button variant="secondary" onClick={() => setCancelMakeupId(null)}>Keep lesson</Button><ConfirmActionButton variant="destructive" onClick={() => { if (!cancellingMakeup) return; try { const next = applyParentScheduleAction(data, makeups, account.id, { kind: 'cancel-makeup', id: cancellingMakeup.id }); onMakeups(next.state); setCancelMakeupId(null); confirm('I’ve cancelled the makeup lesson.'); setScheduleError('') } catch (error) { setScheduleError(error instanceof Error ? error.message : 'Unable to cancel makeup.') } }}>Cancel makeup lesson</ConfirmActionButton>{scheduleError && <p role="alert">{scheduleError}</p>}</ModalBody></Modal>
  </div></InlineWorkspaceContext.Provider>
}