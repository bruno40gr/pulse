'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import EventExplorer, { type BetaWorkflowCompletion } from '@/beta-source/app/content-studio-prototype/event-explorer/EventExplorer'
import AcademyCalendar from '@/beta-source/app/odeon-demo/AcademyCalendar'
import TeacherExperience from '@/beta-source/app/odeon-demo/TeacherExperience'
import { betaPreviewToday, betaShiftDate, betaCalendarOccurrences } from '@/beta-source/lib/beta-academy-calendar'
import { projectBetaBandMembership, projectBetaEnrollment } from '@/beta-source/lib/beta-workflow-projection'
import { enrollmentBillingPreview } from '@/beta-source/lib/academy-enrollment-pricing'
import { betaAcademyRooms, betaAcademyTeachers, betaRoomFor, betaTeachingLoad } from '@/beta-source/lib/beta-academy-schedule'
import { lessonPrice, lessonStudent } from '@/beta-source/lib/academy-staff-enrollment'
import { betaScreen, betaWorkflowScreens, type BetaWorkflowScreen } from '@/beta-source/lib/beta-workspace-navigation'
import { betaEnrollmentPeople } from '@/beta-source/lib/academy-beta-people'
import { usePortalQueue } from '@/beta-source/lib/usePortalQueue'
import DashboardShell from '@/beta-source/app/dashboard/DashboardShell'
import ContactsPage, { type Contact } from '@/app/dashboard/contacts/page'
import { ContactPrototypeContext, ContactSampleContext } from '@/components/contacts/ContactPrototypeContext'
import StaffView from '@/beta-source/app/dashboard/staff/StaffView'
import StudentWorkspaceV3 from '@/beta-source/app/content-studio-prototype/students/StudentWorkspaceV3'
import SchoolSetup from '@/beta-source/app/content-studio-prototype/school-setup/SchoolSetup'
import type { SetupRecord } from '@/beta-source/app/content-studio-prototype/school-setup/setup-content'
import { createDemoWorkspace } from '@/beta-source/lib/odeon-demo-workspace'
import { upgradeAcademyModel } from '@/beta-source/lib/academy-model-upgrade'
import { upgradeDemoDensity } from '@/beta-source/lib/odeon-demo-upgrade'
import { upgradeDemoRoomNames } from '@/beta-source/lib/odeon-demo-rooms'
import { demoBandGroups } from '@/beta-source/lib/academy-demo-groups'
import { createDemoSetup, upgradeDemoBookingSetup } from '@/beta-source/lib/odeon-demo-setup'
import { previewContacts, type FamilyPreviewData } from '@/beta-source/lib/academy-family-preview'
import type { MakeupPreviewState } from '@/beta-source/lib/academy-makeup-preview'
import { expandPreviewCalendar } from '@/beta-source/lib/academy-makeup-preview'
import StaffSlidePanel, { type StaffMember } from '@/beta-source/components/contacts/StaffSlidePanel'
import { colors, spacing } from '@/beta-source/lib/tokens'
import { createCalendarEnrollment, saveCalendarEnrollment, matchingSubscriptions } from '@/beta-source/lib/academy-calendar-enrollment'
import { bookingReason, roomRecords, type CalendarBooking } from '@/beta-source/lib/academy-calendar-booking'
import { CalendarEnrollmentContext } from '@/beta-source/app/odeon-demo/CalendarEnrollmentContext'

import { loadLocalAcademyWorkspace, saveLocalAcademyWorkspace, validAcademyWorkspace, readAcademyWorkspaceResponse, type AcademyWorkspaceState } from '@/beta-source/lib/academy-workspace-storage'
import { Notice } from '@/components/ui/Notice'
import { Button } from '@/components/ui/Button'
export default function DemoWorkspace({ onboarding = false }: { onboarding?: boolean }) {
  const params = useSearchParams()
  const router = useRouter()
  const [queue, updateQueue] = usePortalQueue()
  const [workflowIntent, setWorkflowIntent] = useState<{ id: string; kind: 'enrollment' | 'opportunity' | 'group'; ids: string[] } | null>(null)
  const [snapshot, setSnapshot] = useState(createDemoWorkspace)
  const [setup, setSetup] = useState(createDemoSetup)
  const [ready, setReady] = useState(false)
  const [staffId, setStaffId] = useState<string | null>(null)
  const tenant = params.get('tenant') || ''
  const [storageError, setStorageError] = useState('')
  const blockedSave = useRef(false)
  const revision = useRef(0)
  const savedState = useRef('')
  const pendingState = useRef<AcademyWorkspaceState | null>(null)
  const saving = useRef(false)
  const [saveStatus, setSaveStatus] = useState('')
  useEffect(() => {
    let cancelled = false
    blockedSave.current = false
    setReady(false)
    setStorageError('')
    const load = async () => {
      try {
        if (tenant) {
          const response = await fetch(`/api/academy/workspace?tenant=${encodeURIComponent(tenant)}`, { cache: 'no-store' })
          const result = await readAcademyWorkspaceResponse(response)
          if (!response.ok) throw new Error(result.error || 'School workspace could not be loaded.')
          if (!validAcademyWorkspace(result.state) || result.state.snapshot.data.demoSchool) throw new Error('No live school workspace has been provisioned. Sample records will not be imported.')
          if (cancelled) return
          revision.current = result.revision
          savedState.current = JSON.stringify(result.state)
          setSnapshot(result.state.snapshot)
          setSetup(result.state.setup)
        } else {
          const parsed = loadLocalAcademyWorkspace(localStorage, sessionStorage)
          if (parsed) {
            if (!parsed.snapshot.data.demoSchool) throw new Error('Live records cannot be loaded into the sample school.')
            const upgraded = upgradeDemoDensity({ ...parsed.snapshot, data: upgradeAcademyModel(parsed.snapshot.data) }, parsed.setup, createDemoWorkspace(), createDemoSetup())
            if (cancelled) return
            const renamed = upgradeDemoRoomNames(upgraded.snapshot, upgradeDemoBookingSetup(upgraded.setup))
            setSnapshot(renamed.snapshot)
            setSetup(renamed.setup)
          }
        }
      } catch (error) {
        if (cancelled) return
        blockedSave.current = true
        setStorageError((error as Error).message)
      }
      if (!cancelled) setReady(true)
    }
    void load()
    return () => { cancelled = true }
  }, [tenant])
  useEffect(() => {
    if (!ready || blockedSave.current) return
    const state = { snapshot, setup }
    if (!tenant) {
      try { saveLocalAcademyWorkspace(localStorage, state); setSaveStatus('') }
      catch { blockedSave.current = true; setStorageError('Browser storage is unavailable or full. Changes are not saved. Keep this page open and free browser storage before reloading.') }
      return
    }
    pendingState.current = state
    const flush = async () => {
      if (saving.current || blockedSave.current) return
      saving.current = true
      try {
        while (pendingState.current && !blockedSave.current) {
          const next = pendingState.current
          pendingState.current = null
          const serialized = JSON.stringify(next)
          if (serialized === savedState.current) continue
          setSaveStatus('Saving school changes…')
          const response = await fetch(`/api/academy/workspace?tenant=${encodeURIComponent(tenant)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: revision.current, state: next }) })
          const result = await readAcademyWorkspaceResponse(response)
          if (!response.ok) throw new Error(result.error || 'School changes could not be saved.')
          revision.current = result.revision
          savedState.current = serialized
          setSaveStatus('Saved to school account')
        }
      } catch (error) { blockedSave.current = true; setStorageError((error as Error).message); setSaveStatus('Not saved') }
      finally { saving.current = false }
    }
    void flush()
  }, [snapshot, setup, ready, tenant])
  const onChange = useCallback((data: FamilyPreviewData, makeups: MakeupPreviewState) => setSnapshot({ data, makeups }), [])
  const onSetup = useCallback((data: Record<string, SetupRecord[]>) => setSetup(data), [])
  const parent = params.get('view') === 'parent', staff = params.get('screen') === 'staff'
  const screen = betaScreen(params.get('screen'), params.get('view'))
  const workflow = betaWorkflowScreens.includes(screen as BetaWorkflowScreen)
  const calendar = screen === 'calendar'
  useEffect(() => {
    if (!ready) return
    const people = betaEnrollmentPeople(snapshot.data)
    updateQueue(current => {
      const ids = new Set(people.map(person => person.id))
      const upgradeGroups = (current.demoDatasetVersion || 0) < (snapshot.data.datasetVersion || 0)
      const groupIds = new Set(current.academy.groups.map(group => group.id))
      const groups = upgradeGroups ? [...current.academy.groups, ...demoBandGroups(snapshot.data).filter(group => !groupIds.has(group.id))] : current.academy.groups
      const merged = [...people.map(person => {
        const existing = current.state.people.find(item => item.id === person.id)
        return existing ? { ...existing, ...person } : person
      }), ...current.state.people.filter(person => !ids.has(person.id))]
      return !upgradeGroups && JSON.stringify(merged) === JSON.stringify(current.state.people) ? current : { ...current, demoDatasetVersion: snapshot.data.datasetVersion, academy: { ...current.academy, groups }, state: { ...current.state, people: merged } }
    })
  }, [ready, snapshot.data, updateQueue])
  const beginWorkflow = useCallback((kind: 'enrollment' | 'opportunity' | 'group', ids: string[]) => {
    const students = [...new Set(ids.flatMap(id => {
      const account = snapshot.data.accounts.find(item => item.holderId === id)
      return account ? account.studentIds : [id]
    }))]
    setWorkflowIntent({ id: crypto.randomUUID(), kind, ids: students })
    const next = new URLSearchParams(params.toString())
    next.delete('view'); next.set('screen', kind === 'opportunity' ? 'opportunities' : 'book')
    router.push(`/odeon-demo?${next}`)
  }, [snapshot.data, params, router])
  const clearIntent = useCallback(() => setWorkflowIntent(null), [])
  // Staff shares School Setup's teacher records so both views describe the same team.
  const sampleStaff = useMemo(() => setup.teachers.map(record => {
    const [first, ...rest] = (record.values.name || '').split(' ')
    return { id: record.id, person_id: record.id, first_name: first || '', last_name: rest.join(' '), email: record.values.email || '', phone: record.values.phone || '', is_active: true }
  }), [setup])
  const teacherIdForName = useCallback((name: string) => setup.teachers.find(record => record.values.name === name)?.id, [setup])
  const academyTeachers = useMemo(() => betaAcademyTeachers(setup), [setup])
  const academyRooms = useMemo(() => betaAcademyRooms(setup), [setup])
  const staffDetail = useMemo((): StaffMember | undefined => {
    const teacher = setup.teachers.find(item => item.id === staffId)
    if (!teacher) return undefined
    const name = teacher.values.name || ''
    return { ...sampleStaff.find(item => item.id === teacher.id)!, role: 'teacher', date_of_birth: null, students: snapshot.data.students.flatMap(student => student.enrollments.filter(enrollment => enrollment.teacherId ? enrollment.teacherId === teacher.id : enrollment.teacher === name).map(enrollment => ({ enrollment_id: enrollment.id, student_id: student.id, person_id: student.id, name: `${student.firstName} ${student.lastName}`, phone: student.phone, email: student.email, client_status: 'Member', last_attended: '2026-10-31', instrument: enrollment.program, service_type: enrollment.service, lesson_day: enrollment.day, lesson_time: enrollment.time }))) }
  }, [setup, staffId, snapshot.data, sampleStaff])
  // Teaching already booked, so scheduling never offers a busy staff member.
  const teachingLoad = useMemo(() => {
    const expanded = expandPreviewCalendar(snapshot.data, betaShiftDate(betaPreviewToday, 84))
    return betaTeachingLoad(expanded.students, expanded.lessons.filter(lesson => lesson.date >= betaPreviewToday))
  }, [snapshot.data])
  // A finished workflow becomes a real record in the family's own Beta data.
  const onWorkflowCompleted = useCallback((completion: BetaWorkflowCompletion) => {
    if (completion.kind === 'enrollment' && completion.record.data.calendarRequest) {
      const result = saveCalendarEnrollment(queue, { data: snapshot.data, setup, groups: queue.academy.groups, occurrences: [] }, completion.record.data, true, 'staff')
      updateQueue(() => result.queue)
      setSnapshot(current => ({ ...current, data: result.data }))
      return
    }
    setSnapshot(current => {
      try {
        if (completion.kind === 'enrollment') {
          const draft = completion.record.data.draft
          const studentId = draft.student?.id || ''
          const payerId = draft.payer === 'manager' ? draft.manager?.id || draft.contact?.id || '' : draft.payer === 'other' ? draft.contact?.id || '' : draft.student?.id || draft.contact?.id || ''
          const lessons = draft.lessons.map(lesson => {
            const teacher = academyTeachers.find(item => item.name === lesson.teacher)
            return { service: lesson.service, instrument: lesson.instrument, teacher: lesson.teacher, teacherId: teacher?.id || teacherIdForName(lesson.teacher), time: lesson.time, start: lesson.start, duration: Number(lesson.duration), frequency: lesson.frequency === 'À-la-carte' ? 'One-off' as const : 'Weekly' as const, amountMinor: lessonPrice(lesson, lessonStudent(draft, lesson)).total, room: betaRoomFor(academyRooms, teacher, lesson.start, lesson.time, Number(lesson.duration), teachingLoad) }
          })
          // The staff sees this amount in the pricing step; the family record keeps the same figure.
          const billing = enrollmentBillingPreview(draft)
          return { ...current, data: projectBetaEnrollment(current.data, { enrollmentId: `beta:${completion.record.id}`, studentId, payerId, paymentMethod: draft.payment === 'later' ? 'Add payment later' : 'Demo Visa ···· 4242', amountMinor: billing.current.total, paid: draft.payment !== 'later', lessons }) }
        }
        const band = completion.band
        const account = current.data.accounts.find(item => item.studentIds.includes(completion.record.studentId))
        return { ...current, data: projectBetaBandMembership(current.data, { enrollmentId: `beta:band:${completion.record.id}`, studentId: completion.record.studentId, payerId: account?.holderId || '', paymentMethod: completion.record.paymentMethod === 'demo_card' ? 'Demo Visa ···· 4242' : 'Add payment later', amountMinor: Math.round(Number(completion.record.monthlyPrice || 0) * 100), paid: completion.record.paymentStatus === 'succeeded', bandName: band?.name || 'Band program', teacher: band?.leader || 'Staff team', teacherId: teacherIdForName(band?.leader || '') }) }
      } catch { return current }
    })
  }, [teacherIdForName, academyTeachers, academyRooms, teachingLoad, queue, snapshot.data, setup, updateQueue])
  if (!ready) return null
  const bookingContext = { data: snapshot.data, setup, groups: queue.academy.groups, occurrences: [] }
  const startCalendarEnrollment = (proposal: CalendarBooking, action: 'staff' | 'send') => {
    const expanded = expandPreviewCalendar(snapshot.data, proposal.date)
    const result = createCalendarEnrollment(queue, { ...bookingContext, data: expanded, occurrences: betaCalendarOccurrences(expanded, queue.academy.groups, queue.state.events, [proposal.date]) }, proposal, action === 'send')
    updateQueue(() => result.queue)
    if (action === 'staff') { const next = new URLSearchParams(params.toString()); next.delete('view'); next.set('screen', 'book'); next.set('draft', result.id); router.push(`/odeon-demo?${next}`) }
  }
  const enrollmentAdapter = {
    teachers: academyTeachers,
    availability: (date: string, time: string, lesson: import('@/beta-source/lib/academy-staff-enrollment').LessonChoice) => {
      if (!date || !time) return []
      const expanded = expandPreviewCalendar(snapshot.data, date)
      const occurrences = betaCalendarOccurrences(expanded, queue.academy.groups, queue.state.events, [date])
      const service = setup.services.find(item => item.id === lesson.serviceId || item.values.name === lesson.instrument || (lesson.instrument === 'Voice' && item.values.name === 'Voice & Vocals'))
      return academyTeachers.filter(teacher => roomRecords(setup).filter(room => !lesson.roomId || room.id === lesson.roomId).some(room => !bookingReason({ ...bookingContext, data: expanded, occurrences }, { id: 'probe', kind: 'lesson', title: '', date, time, duration: Number(lesson.duration), teacherId: teacher.id, roomId: room.id, serviceId: service?.id || '', studentIds: [lesson.studentId || ''], groupId: '', repeat: 'once', until: date, publicOnly: false, status: 'Scheduled' }))).map(teacher => ({ name: teacher.name }))
    },
    save: (record: import('@/beta-source/lib/academy-enrollment-drafts').EnrollmentDraftRecord, complete: boolean, actor: 'staff' | 'family', accountId?: string) => {
      const stored = queue.drafts.find(item => item.id === record.id)
      const acknowledged = stored?.kind === 'enrollment' ? stored.data.calendarRequest?.acknowledgedSubscriptionIds || [] : []
      const needsReview = complete && actor === 'staff' && record.draft.lessons.some(lesson => matchingSubscriptions(snapshot.data, lesson.studentId || record.draft.student?.id || '', lesson.serviceId || '', lesson.instrument).some(item => !acknowledged.includes(item.id)))
      if (needsReview && !window.confirm('A matching subscription was created elsewhere. This student already has an active subscription for this lesson type. Do you want to start a new subscription?')) throw new Error('Canceled. Review the matching subscription before completing this request.')
      const result = saveCalendarEnrollment(queue, bookingContext, record, complete, actor, accountId, needsReview)
      updateQueue(() => result.queue)
      if (complete) setSnapshot(current => ({ ...current, data: result.data }))
    },
  }
  if (tenant && storageError) return <Notice variant="error"><p>{storageError}</p><p>No changes have been written to the school account. Your saved browser workspace has not been cleared.</p><a href="/odeon-demo?screen=calendar">Open sample calendar</a></Notice>
  if (onboarding || screen === 'setup') return <>{storageError && <Notice variant="error">{storageError}</Notice>}<SchoolSetup bookingContext={bookingContext} demo configuredData={setup} onConfiguredChange={onSetup} /></>
  return <CalendarEnrollmentContext.Provider value={enrollmentAdapter}><DashboardShell sample sampleScreen={screen} hideNavigation={parent}>
    {!parent && <div style={{ padding: '6px 24px', background: colors.surfaceMuted, color: colors.textSecondary, fontSize: 12 }}>Beta · Sample data · Fictional records only · No real payments or messages · {tenant ? 'School account storage' : 'Saved on this browser · Not shared with other testers'}</div>}
    {storageError && <Notice variant="error">{storageError}</Notice>}
    {saveStatus && <span role="status" style={{ padding: '0 24px', fontSize: 12 }}>{saveStatus}</span>}
    {parent && params.get('impersonateReturn') && <div role="status" style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap', background: colors.cream }}><span>Impersonating {snapshot.data.accounts.find(account => account.id === params.get('account'))?.holderName || 'parent'} · Sample parent portal</span><Button size="sm" variant="secondary" onClick={() => {
      const target = params.get('impersonateReturn') || ''
      window.location.assign(target.startsWith('/odeon-demo?') ? target : '/odeon-demo')
    }}>Exit impersonation</Button></div>}
    {screen === 'teacher' ? <TeacherExperience data={snapshot.data} groups={queue.academy.groups} events={queue.state.events} setup={setup} today={betaPreviewToday} /> : calendar ? <AcademyCalendar
    data={snapshot.data}
    onSetup={onSetup}
    onEnroll={startCalendarEnrollment}
    makeups={snapshot.makeups}
    onDemoChange={onChange}
    groups={queue.academy.groups}
    events={queue.state.events}
    load={teachingLoad}
    setup={setup}
    today={betaPreviewToday}
    onExit={() => { const next = new URLSearchParams(params.toString()); next.delete('screen'); router.push(`/odeon-demo?${next}`) }}
    onApply={change => setSnapshot(current => ({ ...current, data: change(current.data) }))}
  /> : workflow ? <EventExplorer bookingContext={bookingContext} embedded initialScreen={screen as BetaWorkflowScreen} configuredData={setup} onConfiguredChange={onSetup} intent={workflowIntent} onIntentHandled={clearIntent} onWorkflowCompleted={onWorkflowCompleted} teachingLoad={teachingLoad} /> : staff ? <>
      <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'flex-end' }}><Button variant="secondary" onClick={() => { const next = new URLSearchParams(params.toString()); next.set('screen', 'teacher'); router.push(`/odeon-demo?${next}`) }}>Teacher experience · Preview</Button></div>
      <StaffView sampleStaff={sampleStaff} onOpenSample={setStaffId} />
      {staffDetail && <StaffSlidePanel staffId={staffDetail.id} sampleStaff={staffDetail} onClose={() => setStaffId(null)} onViewStudent={id => { const account = snapshot.data.accounts.find(item => item.studentIds.includes(id)); if (account) window.location.href = `/odeon-demo?view=quick&account=${encodeURIComponent(account.id)}&student=${encodeURIComponent(id)}` }} />}
    </> : <StudentWorkspaceV3 key={parent ? params.get('account') || 'parent' : 'staff'} initialData={snapshot.data} initialMakeups={snapshot.makeups} onDemoChange={onChange} renderContacts={({ data, onOpen }) => <SampleContacts data={data} onOpen={onOpen} onWorkflow={beginWorkflow} />} />}
  </DashboardShell></CalendarEnrollmentContext.Provider>
}

/** Published Contacts rows carry the account link the live table groups families by. */
type SandboxContact = Contact & {
  account_id: string | null
  account_holder_person_id: string | null
  account_holders: { person_id: string; name: string | null; phone: string | null; email: string | null; relationship: string | null; is_primary: boolean }[]
  is_student: boolean
  student_id: string | null
}

function SampleContacts({ data, onOpen, onWorkflow }: { data: FamilyPreviewData; onOpen: (accountId: string, studentId?: string) => void; onWorkflow: (kind: 'enrollment' | 'opportunity' | 'group', ids: string[]) => void }) {
  const contacts = useMemo((): SandboxContact[] => previewContacts(data).map(contact => {
    const student = data.students.find(item => item.id === contact.id), account = data.accounts.find(item => item.holderId === contact.id || item.studentIds.includes(contact.id))
    const isStudent = Boolean(student) && contact.id !== account?.holderId
    return { id: contact.id, first_name: contact.firstName, last_name: contact.lastName, email: contact.email || null, phone: contact.phone || null, client_status: 'Member', opted_out: false, last_attended: '2026-10-31', notes: null, family_name: account?.name || null, account_holder_name: account?.holderName || null, account_holder_email: account?.email || null, account_holder_phone: '(202) 555-0100', custom_fields: { program: student?.enrollments.map(item => item.program) || [], instructor: student?.enrollments.map(item => item.teacher) || [], service: student?.enrollments.map(item => item.service) || [] }, account_id: account?.id || null, account_holder_person_id: isStudent ? account?.holderId || null : null, account_holders: isStudent && account ? [{ person_id: account.holderId, name: account.holderName, phone: '(202) 555-0100', email: account.email, relationship: 'Parent', is_primary: true }] : [], is_student: isStudent, student_id: isStudent ? contact.id : null }
  }), [data])
  const onOpenContact = useCallback((id: string) => {
    const account = data.accounts.find(item => item.holderId === id || item.studentIds.includes(id))
    if (!account) return false
    onOpen(account.id, id === account.holderId ? undefined : id)
    return true
  }, [data, onOpen])
  return <ContactPrototypeContext.Provider value><ContactSampleContext.Provider value={{ contacts, onOpen: onOpenContact, onEnroll: ids => onWorkflow('enrollment', ids), onCreateOpportunity: ids => onWorkflow('opportunity', ids), onCreateBand: ids => onWorkflow('group', ids) }}><ContactsPage /></ContactSampleContext.Provider></ContactPrototypeContext.Provider>
}