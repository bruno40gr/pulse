'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { BetaWorkflowScreen } from '@/beta-source/lib/beta-workspace-navigation'
import { sendLessonEnrollment } from '@/beta-source/lib/academy-portal-actions'
import { usePortalQueue } from '@/beta-source/lib/usePortalQueue'
import type { PortalQueue } from '@/beta-source/lib/academy-portal-queue'
import type { SetStateAction } from 'react'
import Image from 'next/image'
import { Music, Users, CalendarDays, Sparkles } from 'lucide-react'
import { Modal, ModalHeader, ModalBody } from '@/components/ui/Modal'
import WorkflowEditor from './WorkflowEditor'
import BandEnrollment from './BandEnrollment'
import BandSlidePanel from './BandSlidePanel'
import ContactOpportunityForm from '@/beta-source/components/leads/ContactOpportunityForm'
import { createOpportunities } from '@/beta-source/lib/academy-opportunities'
import BandEnrollmentRequestPanel from './BandEnrollmentRequestPanel'
import { sendBandEnrollmentRequests, openBandEnrollmentRequest, resolveBandEnrollmentRequests, type BandEnrollmentRequest } from '@/beta-source/lib/academy-band-requests'
import ContactSlidePanel from '@/components/contacts/ContactSlidePanel'
import { ContactPrototypeContext, ContactBandEnrollmentContext } from '@/components/contacts/ContactPrototypeContext'
import { explorerContactDirectory } from '@/beta-source/lib/academy-explorer-contacts'
import { betaAcademyTeachers, betaAvailableTeachers, type BetaTeachingLoad } from '@/beta-source/lib/beta-academy-schedule'
import { newBandEnrollment, bandEnrollmentSteps, defaultBandInstrument, availableBandSubscriptions, addBandCandidates, scheduleBandParticipants, assignBandSubscription, completeBandEnrollment } from '@/beta-source/lib/academy-band-enrollment'
import { enrollmentPaymentLabel } from '@/beta-source/lib/academy-enrollment-drafts'
import type { EnrollmentPerson } from '@/beta-source/lib/academy-staff-enrollment'
import { ProgressStepper } from '@/components/ui/ProgressStepper'
import { newWorkflowDraft, hasEnrollmentName, workflowLabels, workflowName, workflowProgress, type WorkflowDraft } from '@/beta-source/lib/academy-workflow-drafts'
import { Button } from '@/components/ui/Button'
import { EntryPathCard } from '@/components/ui/EntryPathCard'
import { newLesson, selectEnrollmentContact, type LessonChoice } from '@/beta-source/lib/academy-staff-enrollment'
import { PageContainer } from '@/components/ui/PageContainer'
import ExplorerShell from './ExplorerShell'
import AcademySetup from './AcademySetup'
import type { BookingContext } from '@/beta-source/lib/academy-calendar-booking'
import { useCalendarEnrollment } from '@/beta-source/app/odeon-demo/CalendarEnrollmentContext'
import { sendCalendarEnrollment } from '@/beta-source/lib/academy-calendar-enrollment'
import ContactsWorkspace from './ContactsWorkspace'
import OpportunitiesWorkspace from './OpportunitiesWorkspace'
import { LeadWorkspaceContext } from '@/components/leads/LeadWorkspaceContext'
import { createOpportunityAdapter } from '@/beta-source/lib/academy-opportunity-adapter'
import { createDemoSetup } from '@/beta-source/lib/odeon-demo-setup'
import { createDiscounts, type SetupDiscount, type DiscountPolicy, type SetupRecord } from '../school-setup/setup-content'
import GroupsWorkspace from './GroupsWorkspace'
import ProgramPortal from './ProgramPortal'
import { createProgramStudent, requestProgramAvailability, submitProgramAvailability, confirmProgramSchedule, syncProgramLeads, scheduleSignature, programTotal, programScheduleError } from '@/beta-source/lib/academy-program-proposals'
import { academySettings, academyEventState, assembleGroup, type AcademyGroup, type AcademyKind, type AcademySettings } from '@/beta-source/lib/academy-explorer'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { ResponsiveDataTable, type DataTableColumn } from '@/components/ui/DataGridTable'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Checkbox } from '@/components/ui/Checkbox'
import { Notice } from '@/components/ui/Notice'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PersonName } from '@/components/ui/PersonName'
import EventFields from './EventFields'
import { colors, typography } from '@/lib/tokens'
import { createExplorerState, eventRegistrationActivity, activitySpace, newExplorerEvent, eventErrors, registerExplorerPerson, type ExplorerEvent, type ExplorerRegistration, type ExplorerInquiry } from '@/beta-source/lib/event-explorer'
import styles from './explorer.module.css'

type Screen = 'events' | 'people' | 'opportunities' | 'book' | 'groups' | 'setup'
type EventTab = 'details' | 'activities' | 'registration' | 'policies' | 'sharing' | 'participants'
const eventTabs: { key: EventTab; label: string }[] = [{ key: 'details', label: 'Details & image' }, { key: 'activities', label: 'Activities & schedule' }, { key: 'registration', label: 'Registration' }, { key: 'policies', label: 'Policies & forms' }, { key: 'sharing', label: 'Booking page & sharing' }, { key: 'participants', label: 'Participants' }]
function Table<Row extends { id: string }>({ rows, columns, label }: { rows: Row[]; columns: DataTableColumn<Row, string>[]; label: string }) {
  return <ResponsiveDataTable rows={rows} columns={columns} getRowKey={row => row.id} ariaLabel={label} minDesktopWidth={680} getRowStyle={(_, index) => ({ background: index % 2 ? colors.background : colors.surface })} emptyContent={<EmptyState title="Nothing here yet" description="No records match this view." />} />
}
function Stats({ items }: { items: [string, number][] }) {
  return <div className={styles.stats}>{items.map(([label, count]) => <DenseSectionPanel key={label}><span className={styles.muted}>{label}</span><strong className={styles.stat}>{count}</strong></DenseSectionPanel>)}</div>
}
/** A finished staff workflow that the Beta workspace can record in its own model. */
export type BetaWorkflowCompletion =
  | { kind: 'enrollment'; record: Extract<WorkflowDraft, { kind: 'enrollment' }> }
  | { kind: 'band'; record: import('@/beta-source/lib/academy-band-enrollment').BandEnrollment; band?: AcademyGroup }



export default function EventExplorer({ embedded = false, initialScreen = 'events', configuredData, onConfiguredChange, intent, onIntentHandled, onWorkflowCompleted, onEnrollmentFocus, teachingLoad = [], bookingContext }: {
  bookingContext?: BookingContext; embedded?: boolean; initialScreen?: BetaWorkflowScreen; configuredData?: Record<string, SetupRecord[]>;
  onConfiguredChange?: (data: Record<string, SetupRecord[]>) => void;
  intent?: { id: string; kind: 'enrollment' | 'opportunity' | 'group'; ids: string[]; calendarLesson?: Partial<LessonChoice> } | null;
  onIntentHandled?: () => void;
  onEnrollmentFocus?: (focused: boolean) => void;
  onWorkflowCompleted?: (completion: BetaWorkflowCompletion) => void;
  /** Teaching already booked in the academy's own records. */
  teachingLoad?: readonly BetaTeachingLoad[];
}) {
  const [queue, updateQueue] = usePortalQueue()
  const calendarEnrollment = useCalendarEnrollment()
  function queueSetter<K extends keyof PortalQueue>(key: K) {
    return (value: SetStateAction<PortalQueue[K]>) => updateQueue(current => ({ ...current, [key]: typeof value === 'function' ? (value as (previous: PortalQueue[K]) => PortalQueue[K])(current[key]) : value }))
  }
  const state = queue.state, setState = queueSetter('state')
  const [discountSetup, setDiscountSetup] = useState({ discounts: createDiscounts('configured'), policy: { combination: 'best', order: 'percentage-first' } as DiscountPolicy })
  const saveDiscountSetup = useCallback((discounts: SetupDiscount[], policy: DiscountPolicy) => setDiscountSetup({ discounts, policy }), [])
  const [setupData, setSetupData] = useState<Partial<Record<AcademyKind, Record<string, SetupRecord[]>>>>({})
  const drafts = queue.drafts, setDrafts = queueSetter('drafts')
  const [activeId, setActiveId] = useState<string | null>(null)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('draft')
    if (id) setActiveId(id)
  }, [])
  const draftContent = (record: WorkflowDraft) => JSON.stringify(record.kind === 'enrollment' ? record.data.draft : record.data)
  const draftBaselines = useRef(new Map<string, string>())
  const [lessonChooser, setLessonChooser] = useState(false)
  useEffect(() => {
    if (lessonChooser && calendarEnrollment?.openBooking) {
      calendarEnrollment.openBooking()
      setLessonChooser(false)
    }
  }, [lessonChooser, calendarEnrollment])
  const [portal, setPortal] = useState(false)
  const tasks = queue.tasks, setTasks = queueSetter('tasks')
  const bookings = queue.bookings, setBookings = queueSetter('bookings')
  const academy = queue.academy, setAcademy = queueSetter('academy')
  const enrollmentRequests = queue.requests, setEnrollmentRequests = queueSetter('requests')
  const [requestTargets, setRequestTargets] = useState<{ bandId: string; ids: string[] } | null>(null)
  const [requestAccount, setRequestAccount] = useState<string | null>(null)
  const bandEnrollments = queue.enrollments, setBandEnrollments = queueSetter('enrollments')
  const [activeBandEnrollment, setActiveBandEnrollment] = useState<string | null>(null)
  const [bandPanelId, setBandPanelId] = useState<string | null>(null)
  const [studentPanelId, setStudentPanelId] = useState<string | null>(null)
  const configuredSetup = useMemo(() => academy.kind === 'music' && configuredData ? configuredData : setupData[academy.kind] || (academy.kind === 'music' ? createDemoSetup() : { services: [], locations: [], teachers: [] }), [academy.kind, configuredData, setupData])
  const locations = configuredSetup.locations || []
  const configuredServices = configuredSetup.services || []
  const formatsFor = (record: SetupRecord): string[] => { try { return JSON.parse(record.values.formats || '[]') } catch { return [] } }
  const lessonServices = configuredServices.filter(record => formatsFor(record).some(format => format === 'private' || format === 'semi'))
  const groupServices = configuredServices.filter(record => formatsFor(record).includes('group'))
  const [savedAcademies, setSavedAcademies] = useState<Partial<Record<AcademyKind, { academy: AcademySettings; state: ReturnType<typeof createExplorerState>; inquiries: ExplorerInquiry[] }>>>({})
  const saveSetup = useCallback((value: Record<string, SetupRecord[]>) => { setSetupData(current => ({ ...current, [academy.kind]: value })); if (academy.kind === 'music') onConfiguredChange?.(value) }, [academy.kind, onConfiguredChange])
  const changeInstitution = (kind: AcademyKind) => {
    setSavedAcademies(current => ({ ...current, [academy.kind]: { academy, state, inquiries } }))
    setAcademy(savedAcademies[kind]?.academy || academySettings(kind))
    setState(savedAcademies[kind]?.state || { ...academyEventState(kind), people: state.people, registrations: [] })
    setInquiries(savedAcademies[kind]?.inquiries || [])
    setActiveId(null); setEventId(null); setPersonId(null); setErrors([]); setNotice('')
    setActiveBandEnrollment(null); setBandPanelId(null); setStudentPanelId(null)
  }
  const staff = configuredSetup.teachers || []
  // The academy's own staff drives Beta scheduling.
  const academyTeachers = useMemo(() => betaAcademyTeachers(configuredSetup), [configuredSetup])
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [eventId, setEventId] = useState<string | null>(null)
  const [tab, setTab] = useState<EventTab>('details')
  const [, setPersonId] = useState<string | null>(null)
  const [opportunityIds, setOpportunityIds] = useState<string[] | null>(null)
  const inquiries = queue.inquiries, setInquiries = queueSetter('inquiries')
  const opportunityState = useRef({ people: state.people, inquiries })
  opportunityState.current = { people: state.people, inquiries }
  const creationIds = useRef(opportunityIds)
  creationIds.current = opportunityIds
  const enrollmentNavigation = useRef<(studentId: string, bandId: string) => void>(() => {})
  const [opportunityAdapter] = useState(() => createOpportunityAdapter({
    getState: () => opportunityState.current,
    getCreationIds: () => creationIds.current,
    onBandEnrollment: (studentId, bandId) => enrollmentNavigation.current(studentId, bandId),
    onChange: next => {
      opportunityState.current = next
      setState(current => ({ ...current, people: next.people }))
      setInquiries(next.inquiries)
    },
  }))
  const startBandEnrollment = (studentId = '', bandId = '', request?: BandEnrollmentRequest) => {
    const existing = bandEnrollments.find(record => !record.completedAt && record.studentId === studentId && record.bandId === bandId && record.requestId === request?.id)
    const record = existing || newBandEnrollment(studentId, bandId)
    if (!existing) {
      const person = state.people.find(person => person.id === studentId)
      const payer = person && (state.people.find(item => item.accountId === person.accountId && item.roles.some(role => ['Parent', 'Account holder'].includes(role))) || person)
      record.instrument = academy.groups.find(group => group.id === bandId)?.memberInstruments?.[studentId] || defaultBandInstrument(person)
      if (payer) { record.payerName = payer.name; record.payerEmail = payer.email }
      if (request) { record.pricing = request.pricing; record.requestId = request.id; record.monthlyPrice = request.monthlyPrice; record.payerName = request.recipientName; record.payerEmail = request.recipientEmail }
      setBandEnrollments(current => [...current, record])
    }
    setActiveBandEnrollment(record.id); setActiveId(null); setBandPanelId(null); setStudentPanelId(null); setScreen('book'); setPortal(false); setLessonChooser(false)
  }
  const openEnrollmentRequest = (id: string, accountId: string) => {
    const request = openBandEnrollmentRequest(enrollmentRequests, id, accountId, academy.groups)
    setRequestAccount(accountId)
    startBandEnrollment(request.studentId, request.bandId, request)
  }
  enrollmentNavigation.current = startBandEnrollment
  opportunityAdapter.onBandEnrollment = startBandEnrollment
  opportunityAdapter.onSendEnrollment = id => updateQueue(current => sendLessonEnrollment(current, id))
  opportunityAdapter.matching = { bands: academy.groups.map(group => ({ id: group.id, name: group.name })) }
  const [creationKey, setCreationKey] = useState('')
  const beginOpportunity = (ids: string[]) => {
    setOpportunityIds(ids)
    setCreationKey(crypto.randomUUID())
  }
  opportunityAdapter.onCreationClosed = () => { setCreationKey(''); setOpportunityIds(null); creationIds.current = null }
  // Keep transport identity stable while updating only the explicit creation intent.
  opportunityAdapter.creation = undefined

  const [notice, setNotice] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [preview, setPreview] = useState(false)
  const [bookingActivity, setBookingActivity] = useState('')
  const event = state.events.find(item => item.id === eventId)
  const rootStyle = { '--explore-background': colors.background, '--explore-surface': colors.surface, '--explore-text': colors.text, '--explore-secondary': colors.textSecondary, '--explore-border': colors.border, '--explore-link': colors.link, '--explore-font': typography.fontSans } as CSSProperties
  const updateEvent = (change: Partial<ExplorerEvent>) => setState(current => ({ ...current, events: current.events.map(item => item.id === eventId ? { ...item, ...change } : item) }))
  const context = { academy, people: state.people, staffIds: staff.map(person => person.id), events: state.events, tasks: tasks.filter(task => task.institution === academy.kind), registrations: state.registrations }
  const active = drafts.find(record => record.id === activeId && record.institution === academy.kind)
  const enrollmentFocused = active?.kind === 'enrollment'
  useLayoutEffect(() => {
    onEnrollmentFocus?.(enrollmentFocused)
    return () => onEnrollmentFocus?.(false)
  }, [enrollmentFocused, onEnrollmentFocus])
  // Scheduling offers the academy's own staff, free in the slot they keep.
  const activeStudentId = active?.kind === 'enrollment' ? active.data.draft.student?.id || '' : ''
  const academyAvailability = useMemo(() => {
    if (!academyTeachers.length) return undefined
    return (date: string, time: string, lesson: LessonChoice) => betaAvailableTeachers(academyTeachers, { instrument: lesson.instrument, duration: Number(lesson.duration) }, date, time, teachingLoad, lesson.studentId || activeStudentId).map(teacher => ({ name: teacher.name }))
  }, [academyTeachers, teachingLoad, activeStudentId])
  const putDraft = useCallback((record: WorkflowDraft) => {
    updateQueue(current => {
      const stored = current.drafts.find(item => item.id === record.id)
      if (stored?.kind === 'enrollment' && stored.data.calendarRequest && stored.data.completedAt) return current
      if (stored?.kind === 'enrollment' && stored.data.calendarRequest && record.kind === 'enrollment') record = { ...record, data: { ...record.data, calendarRequest: stored.data.calendarRequest } }
      return { ...current, drafts: [...current.drafts.filter(item => item.id !== record.id), record], inquiries: record.kind === 'program' ? syncProgramLeads(current.inquiries, record.id, record.data) : current.inquiries }
    })
  }, [updateQueue])
  const navigate = (next: Screen) => { setScreen(next); setActiveId(null); setActiveBandEnrollment(null); setBandPanelId(null); setStudentPanelId(null); setEventId(null); setPersonId(null); setErrors([]); setNotice(''); setPreview(false); setLessonChooser(false); setPortal(false) }
  const externalScreen = useRef(initialScreen)
  useEffect(() => {
    if (embedded && externalScreen.current !== initialScreen) {
      externalScreen.current = initialScreen
      navigate(initialScreen)
    }
  }, [embedded, initialScreen])
  const openEvent = (id: string) => { navigate('events'); setEventId(id); setTab('details') }
  const startDraft = (kind: WorkflowDraft['kind'], origin: WorkflowDraft['origin'] = 'hub', members?: string[], lesson?: Pick<LessonChoice, 'service' | 'instrument'> & Partial<Pick<LessonChoice, 'frequency'>>, calendarLesson?: Partial<LessonChoice>) => {
    const record = newWorkflowDraft(kind, academy, origin)
    if (record.kind === 'event') record.data.location = locations[0]?.values.name || ''
    if (record.kind === 'enrollment' && lesson) {
      record.data.entryLesson = { ...lesson, duration: lesson.service === 'Group' ? /band/i.test(lesson.instrument) ? '60' : '45' : lesson.service === 'Semi-private' ? '45' : '30' }
      record.data.draft.lessons = [{ ...newLesson(crypto.randomUUID()), ...record.data.entryLesson }]
    }
    if (record.kind === 'program' && members) record.data.memberIds = members
    if (record.kind === 'enrollment' && members?.length) {
      const people: EnrollmentPerson[] = state.people.map(person => ({ id: person.id, firstName: person.name.split(' ')[0], lastName: person.name.split(' ').slice(1).join(' '), email: person.email, phone: '', activeTeacher: false, accountId: person.accountId || person.id, accountHolder: person.roles.some(role => ['Parent', 'Account holder'].includes(role)) }))
      record.data.draft = selectEnrollmentContact(record.data.draft, people.find(person => person.id === members[0]) || null, people)
      record.data.draft.additionalStudents = people.filter(person => members.slice(1).includes(person.id))
    }
    if (record.kind === 'group' && members) record.data.memberIds = members.filter(id => state.people.some(person => person.id === id && (person.enrolled || !person.roles.some(role => ['Parent', 'Account holder'].includes(role)))))
    if (record.kind === 'enrollment' && calendarLesson) {
      record.data.fromCalendar = true
      record.data.entryLesson = calendarLesson
      record.data.draft.lessons = [{ ...newLesson(crypto.randomUUID()), ...calendarLesson }]
      record.data.started = true
    }
    draftBaselines.current.set(record.id, draftContent(record))
    putDraft(record); setActiveId(record.id); setScreen('book'); setLessonChooser(false); setErrors([]); setNotice('')
  }
  const handledIntent = useRef('')
  const intentActions = useRef({ beginOpportunity, startDraft })
  intentActions.current = { beginOpportunity, startDraft }
  useEffect(() => {
    if (!intent || handledIntent.current === intent.id) return
    handledIntent.current = intent.id
    if (intent.kind === 'opportunity') intentActions.current.beginOpportunity(intent.ids)
    else if (intent.kind === 'enrollment' && !intent.ids.length) setLessonChooser(true)
    else intentActions.current.startDraft(intent.kind, 'hub', intent.ids, undefined, intent.calendarLesson)
    onIntentHandled?.()
  }, [intent, onIntentHandled])
  const completedEnrollments = useRef(new Set<string>())
  const completedBands = useRef(new Set<string>())
  const leaveDraft = (record: WorkflowDraft, discard: boolean) => {
    if (record.kind === 'enrollment' && record.data.calendarRequest && !discard) {
      const stored = queue.drafts.find(item => item.id === record.id)
      if (stored?.kind === 'enrollment' && stored.data.completedAt) { setActiveId(null); return }
      if (!calendarEnrollment) throw new Error('Connected enrollment unavailable.')
      calendarEnrollment.save(record.data, Boolean(record.data.completedAt), 'staff')
      setActiveId(null); setErrors([]); return
    }
    // A finished booking is recorded once; the Beta workspace owns the family's records.
    if (!discard && record.kind === 'enrollment' && record.data.completedAt && !completedEnrollments.current.has(record.id)) {
      onWorkflowCompleted?.({ kind: 'enrollment', record })
      completedEnrollments.current.add(record.id)
    }
    if (discard && draftContent(record) !== (draftBaselines.current.get(record.id) || draftContent(record)) && !window.confirm('Discard this draft?')) return
    if (discard || !hasEnrollmentName(record, state.people) || (record.kind !== 'enrollment' && draftContent(record) === draftBaselines.current.get(record.id))) { setDrafts(current => current.filter(item => item.id !== record.id)); setTasks(current => current.filter(task => task.proposalId !== record.id)); setInquiries(current => current.filter(inquiry => inquiry.proposalId !== record.id)) }
    else { if (record.kind === 'enrollment') draftBaselines.current.delete(record.id); putDraft(record) }
    setErrors([])
    if (record.parentId) { setActiveId(record.parentId); setScreen('book') }
    else { setActiveId(null); setScreen(record.kind === 'event' ? 'events' : record.kind === 'group' ? 'groups' : discard && record.origin !== 'hub' ? record.origin : 'book') }
  }
  const completeDraft = (record: WorkflowDraft) => {
    if (record.kind === 'program') {
      const plan = record.data
      const proposalTasks = tasks.filter(task => task.proposalId === record.id && task.institution === academy.kind)
      const problem = programScheduleError(plan, proposalTasks)
      if (problem || plan.memberIds.some(id => !proposalTasks.some(task => task.studentId === id && task.confirmedSchedule === scheduleSignature(plan)))) throw new Error(problem || 'Every family must confirm the current schedule.')
      const existing = academy.groups.find(group => group.id === plan.groupId)
      if (existing && !existing.formation && new Set([...existing.memberIds, ...plan.memberIds]).size > existing.capacity) throw new Error('This program does not have enough capacity.')
      const groupId = existing?.id || crypto.randomUUID()
      const schedule = `${plan.date} · ${plan.time} · ${plan.duration} min${plan.mode === 'ongoing' ? ' · Weekly' : ' · One session'}`
      // Structured weekly schedule so the academy calendar can render the class without parsing prose.
      const endMinute = Number(plan.time.slice(0, 2)) * 60 + Number(plan.time.slice(3)) + Number(plan.duration)
      const dailySchedule = plan.mode === 'ongoing' ? { days: [new Date(`${plan.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })], from: plan.time, to: `${String(Math.floor(endMinute / 60)).padStart(2, '0')}:${String(endMinute % 60).padStart(2, '0')}` } : undefined
      if (academy.kind !== 'music') setAcademy(current => ({ ...current, groups: existing ? current.groups.map(group => group.id === groupId ? { ...group, memberIds: [...new Set([...group.memberIds, ...plan.memberIds])], schedule: plan.mode === 'ongoing' ? schedule : group.schedule } : group) : [...current.groups, { id: groupId, typeId: current.groupTypes.find(type => type.enabled)?.id || '', name: plan.name, leader: plan.leader, capacity: Math.max(12, plan.memberIds.length), trialMax: 2, memberIds: [...plan.memberIds], schedule, resources: [], eventIds: [], message: '' }] }))
      if (academy.kind === 'music') {
        const band = existing || { id: groupId, typeId: academy.groupTypes.find(type => type.enabled)?.id || '', name: plan.name, leader: plan.leader, capacity: Math.max(12, plan.memberIds.length), trialMax: 2, memberIds: [], formation: true, schedule: '', resources: [], eventIds: [], message: '' }
        const scheduled = scheduleBandParticipants(band, plan.memberIds, schedule, state.people, inquiries)
        const scheduledGroup = { ...scheduled.group, dailySchedule: dailySchedule || scheduled.group.dailySchedule, ...(dailySchedule ? { seriesId: groupId } : {}) }
        setAcademy(current => ({ ...current, groups: existing ? current.groups.map(group => group.id === groupId ? scheduledGroup : group) : [...current.groups, scheduledGroup] })); setInquiries(scheduled.inquiries)
      }
      setBookings(current => [...current, { id: crypto.randomUUID(), institution: academy.kind, proposalId: record.id, groupId, plan: structuredClone(plan), totalPerPerson: programTotal(plan) }])
      setState(current => ({ ...current, people: current.people.map(person => plan.memberIds.includes(person.id) ? { ...person, roles: [...new Set([...person.roles, 'Student'])], customer: true, enrolled: (academy.kind !== 'music' && plan.mode === 'ongoing') || person.enrolled } : person) }))
      if (academy.kind !== 'music' && plan.mode === 'ongoing') {
        setInquiries(current => current.map(inquiry => inquiry.proposalId === (plan.leadProposalId || record.id) ? { ...inquiry, stage: 'Enrolled' } : inquiry))
      }
    } else if (record.kind === 'group') {
      const assembled = assembleGroup(record.data, state.people, staff.map(person => person.id))
      if (academy.kind === 'music') {
        const pending = addBandCandidates({ ...assembled, memberIds: [], formation: true, formedAt: new Date().toISOString(), stage: 'Just Created' }, assembled.memberIds, state.people, inquiries)
        setAcademy(current => ({ ...current, groups: [...current.groups, pending.group] }))
        setInquiries(pending.inquiries)
      } else setAcademy(current => ({ ...current, groups: [...current.groups, assembled] }))
    } else if (record.kind === 'event') setState(current => ({ ...current, events: [...current.events, record.data] }))
    else if (record.kind === 'membership') {
      if (academy.kind === 'music') throw new Error('Complete band enrollment to confirm membership.')
      setAcademy(current => ({ ...current, groups: current.groups.map(group => group.id === record.data.groupId ? { ...group, memberIds: [...new Set([...group.memberIds, ...record.data.memberIds])] } : group) }))
    }
    else if (record.kind === 'registration') {
      const event = state.events.find(event => event.id === record.data.eventId)
      if (!event) throw new Error('Choose an event.')
      if (activitySpace(event, eventRegistrationActivity(event, record.data.activityId), state.registrations) === 0) throw new Error('This activity is full. Choose another activity.')
      const person = record.data.personId === 'new' ? { id: crypto.randomUUID(), name: record.data.name.trim(), email: record.data.email, family: 'New contact', enrolled: false, customer: false, roles: [] } : state.people.find(person => person.id === record.data.personId)
      if (!person) throw new Error('Choose a participant.')
      const registrations = registerExplorerPerson(event, state.registrations, person.id, eventRegistrationActivity(event, record.data.activityId)).map(registration => registration.personId === person.id && registration.eventId === event.id && registration.activityId === eventRegistrationActivity(event, record.data.activityId) ? { ...registration, responses: { ...record.data.responses }, policyOverrides: [...(record.data.policyOverrides || [])] } : registration)
      setState(current => ({ ...current, registrations, people: current.people.some(item => item.id === person.id) ? current.people : [...current.people, person] }))
    }
    setDrafts(current => current.filter(item => item.id !== record.id).map(parent => {
      if (parent.id !== record.parentId) return parent
      if (parent.kind === 'membership' && record.kind === 'group') return { ...parent, reviewedSteps: parent.reviewedSteps.filter(step => step < 1), data: { ...parent.data, groupId: record.data.id, billingReviewed: false } }
      if (parent.kind === 'registration' && record.kind === 'event') return { ...parent, reviewedSteps: parent.reviewedSteps.filter(step => step < 1), data: { ...parent.data, eventId: record.data.id, activityId: record.data.activities[0]?.id || '', agreed: false } }
      return parent
    }))
    setActiveId(record.parentId || null); setScreen(record.parentId || record.origin === 'hub' ? 'book' : record.origin); setNotice(`${workflowLabels[record.kind]} saved.`)
  }
  const startBooking = (target?: ExplorerEvent, selectedPerson?: string, activityId?: string) => {
    const record = newWorkflowDraft('registration', academy)
    if (record.kind !== 'registration') return
    record.data = { ...record.data, personId: selectedPerson || '', eventId: target?.id || '', activityId: activityId || target?.activities[0]?.id || '' }
    draftBaselines.current.set(record.id, draftContent(record))
    putDraft(record); setActiveId(record.id); setScreen('book'); setErrors([]); setNotice('')
  }
  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setNotice('Copied to clipboard.') }
    catch { setNotice('Clipboard unavailable. Select and copy the displayed text instead.') }
  }
  const renderEventTable = () => <Table label="Events" rows={state.events} columns={[
    { id: 'name', header: 'Event', width: '2fr', render: row => <PersonName as="button" onClick={() => openEvent(row.id)}>{row.name || 'Untitled event'}</PersonName> },
    { id: 'dates', header: 'Date range', width: '1.5fr', render: row => `${row.start || 'Not set'} – ${row.end || 'Not set'}` },
    { id: 'activities', header: 'Activities', width: '.6fr', render: row => row.activities.length },
    { id: 'registrations', header: 'Registrations', width: '.8fr', render: row => state.registrations.filter(item => item.eventId === row.id && item.status !== 'Cancelled').length },
    { id: 'state', header: 'Booking page', width: '1fr', render: row => <StatusBadge status={row.published ? 'active' : 'pending'} label={row.published ? 'Published' : 'Draft'} /> },
  ]} />
  const renderCreationDrafts = (kind: 'event' | 'group') => {
    const rows = drafts.filter(record => record.kind === kind && record.institution === academy.kind && draftContent(record) !== draftBaselines.current.get(record.id))
    if (!rows.length) return null
    return <DenseSectionPanel title={kind === 'event' ? 'Event drafts' : academy.kind === 'music' ? 'Band drafts' : 'Group drafts'} headingLevel="h2">
      <Table label={kind === 'event' ? 'Event drafts' : 'Group drafts'} rows={rows} columns={[
        { id: 'name', header: 'Name', width: '2fr', render: record => <PersonName as="button" onClick={() => setActiveId(record.id)}>{workflowName(record, context)}</PersonName> },
        { id: 'progress', header: 'Progress', width: '1fr', render: record => { const progress = workflowProgress(record, context); return `${progress.steps.filter(step => step.complete).length} / ${progress.steps.length} complete` } },
        { id: 'actions', header: 'Actions', width: '1fr', render: record => <Button variant="secondary" onClick={() => setActiveId(record.id)}>Continue</Button> },
      ]} />
    </DenseSectionPanel>
  }
  let content: ReactNode
  const bandEnrollment = bandEnrollments.find(record => record.id === activeBandEnrollment && !record.completedAt)
  const addEnrollmentStudent = (person: EnrollmentPerson) => {
    setState(current => ({ ...current, people: current.people.some(item => item.id === person.id) ? current.people.map(item => item.id === person.id ? { ...item, name: `${person.firstName} ${person.lastName}`, email: person.email } : item) : [...current.people, { id: person.id, name: `${person.firstName} ${person.lastName}`, email: person.email, accountId: person.id, family: 'Self', roles: ['Student'], enrolled: false, customer: false }] }))
  }
  if (bandEnrollment) {
    content = <BandEnrollment request={enrollmentRequests.find(request => request.id === bandEnrollment.requestId)} key={bandEnrollment.id} draft={bandEnrollment} people={state.people} groups={academy.groups} policies={enrollmentRequests.find(request => request.id === bandEnrollment.requestId)?.policies || [{ id: 'band-agreement', values: { name: 'Participation agreement', waiver: (academy.eventDefaults || newExplorerEvent('defaults')).waiver } }]} onStudent={addEnrollmentStudent} onChange={next => {
      setBandEnrollments(current => current.map(record => record.id === next.id ? next : record))
    }} onClose={() => { if (!state.people.find(person => person.id === bandEnrollment.studentId)?.name.trim()) setBandEnrollments(current => current.filter(record => record.id !== bandEnrollment.id)); setActiveBandEnrollment(null); if (bandEnrollment.requestId) setPortal(true); setScreen('book') }} onComplete={draft => {
      let completedBand: AcademyGroup | undefined
      let completedReceipt: import('@/beta-source/lib/academy-band-enrollment').BandEnrollment | undefined
      updateQueue(current => {
        if (draft.requestId) {
          const request = openBandEnrollmentRequest(current.requests, draft.requestId, requestAccount || '', current.academy.groups)
          if (request.studentId !== draft.studentId || request.bandId !== draft.bandId || request.monthlyPrice !== draft.monthlyPrice || JSON.stringify(request.pricing) !== JSON.stringify(draft.pricing)) throw new Error('This enrollment does not match the family request.')
        }
        const stored = current.enrollments.find(record => record.id === draft.id)
        if (!stored || stored.completedAt) throw new Error('Enrollment unavailable or already completed.')
        if (draft.bandId && availableBandSubscriptions(current.enrollments, draft.studentId).length) throw new Error('Assign the available paid subscription instead of charging again.')
        const result = completeBandEnrollment(draft, current.academy.groups, current.state.people, current.inquiries)
        completedBand = result.groups.find(group => group.id === draft.bandId)
        completedReceipt = result.receipt
        return { ...current, academy: { ...current.academy, groups: result.groups }, state: { ...current.state, people: result.people }, inquiries: result.inquiries, enrollments: current.enrollments.map(record => record.id === draft.id ? result.receipt : record), requests: resolveBandEnrollmentRequests(current.requests, draft.studentId, draft.bandId) }
      })
      // A confirmed membership is recorded once; the Beta workspace owns the student's programs.
      if (!completedBands.current.has(draft.id)) {
        completedBands.current.add(draft.id)
        onWorkflowCompleted?.({ kind: 'band', record: completedReceipt || draft, band: completedBand })
      }
      setActiveBandEnrollment(null); setBandPanelId(draft.bandId || null); setScreen(draft.bandId ? 'groups' : 'book'); setNotice('Band enrollment completed.')
      if (draft.requestId) { setBandPanelId(null); setPortal(true) }
    }} />
  } else if (portal) {
    const plans = Object.fromEntries([...bookings.filter(booking => booking.institution === academy.kind).map(booking => [booking.proposalId, booking.plan]), ...drafts.flatMap(record => record.kind === 'program' && record.institution === academy.kind ? [[record.id, record.data]] : [])])
    content = <ProgramPortal requests={enrollmentRequests.filter(request => academy.kind === 'music' && !request.completedAt)} onEnroll={openEnrollmentRequest} completedIds={bookings.filter(booking => booking.institution === academy.kind).map(booking => booking.proposalId)} people={state.people} tasks={context.tasks || []} plans={plans} onBack={() => setPortal(false)} onSubmit={(id, allowed, blocks) => setTasks(submitProgramAvailability(tasks, id, allowed, blocks))} onConfirm={(id, allowed, plan) => setTasks(confirmProgramSchedule(tasks, id, allowed, plan))} />
  } else if (active) {
    content = <WorkflowEditor availablePeople={state.people.map(person => ({ id: person.id, firstName: person.name.split(' ')[0], lastName: person.name.split(' ').slice(1).join(' '), email: person.email, phone: '', activeTeacher: false, accountId: person.accountId || person.id, accountHolder: person.roles.some(role => ['Parent', 'Account holder'].includes(role)) }))} academyTeachers={academyTeachers} availability={calendarEnrollment?.availability || academyAvailability} key={`${active.id}:${active.kind === 'enrollment' ? active.data.completedAt || '' : ''}`} initial={active} context={context} staff={staff} locations={locations} onUpdate={putDraft} onSave={record => leaveDraft(record, false)} onCancel={() => leaveDraft(active, true)} onComplete={completeDraft} onCreate={(parent, kind) => { putDraft(parent); const child = newWorkflowDraft(kind, academy, 'hub', parent.id); putDraft(child); setActiveId(child.id) }} programActions={{
      onStudent: input => { const person = createProgramStudent(state.people, input); setState(current => ({ ...current, people: [...current.people, person] })); return person },
      onRequest: plan => { if (!plan.week || !plan.memberIds.length) throw new Error('Choose participants and a requested week.'); setTasks(current => requestProgramAvailability(current, active.id, academy.kind, plan)) },
      onPropose: plan => { const problem = programScheduleError(plan, (context.tasks || []).filter(task => task.proposalId === active.id)); if (problem) throw new Error(problem); const signature = scheduleSignature(plan); setTasks(current => current.map(task => task.proposalId === active.id && plan.memberIds.includes(task.studentId) ? { ...task, schedule: signature, confirmedSchedule: task.schedule === signature ? task.confirmedSchedule : undefined } : task)) },
      onPortal: () => setPortal(true),
      onResponse: (id, allowed, blocks) => { const next = submitProgramAvailability(tasks, id, allowed, blocks); setTasks(next) },
      onConfirm: (id, allowed, plan) => { const next = confirmProgramSchedule(tasks, id, allowed, plan); setTasks(next) },
    }} />
  } else if (screen === 'setup') {
    content = <AcademySetup bookingContext={bookingContext} configuredDiscountPolicy={discountSetup.policy} configuredDiscounts={discountSetup.discounts} onDiscountsChange={saveDiscountSetup} events={state.events} configuredData={configuredSetup} onDataChange={saveSetup} key={academy.kind} academy={academy} onChange={setAcademy} onInstitution={changeInstitution} onExit={() => navigate('events')} />
  } else if (screen === 'groups') {
    content = <GroupsWorkspace creationDrafts={renderCreationDrafts('group')} matchingQueue={academy.kind === 'music' ? <OpportunitiesWorkspace adapter={opportunityAdapter} matching /> : undefined} onOpenBand={academy.kind === 'music' ? setBandPanelId : undefined} onCreate={() => startDraft('group', 'groups')} staff={staff} academy={academy} people={state.people} events={state.events} onChange={setAcademy} onOpenEvent={openEvent} />
  } else if (screen === 'events' && event) {
    const registrations = state.registrations.filter(item => item.eventId === event.id)
    const link = `https://academy.example.invalid/events/${encodeURIComponent(event.id)}`
    content = <>
      <PageHeader title={event.name || 'Event'} onBack={() => { setEventId(null); setErrors([]); setNotice('') }} right={<Button onClick={() => { const problems = eventErrors(event); setErrors(problems); if (!problems.length) { updateEvent({ published: !event.published }); setNotice(event.published ? 'Booking page unpublished.' : 'Booking page published.') } }}>{event.published ? 'Unpublish' : 'Publish'}</Button>} />
      <div className={styles.tabs}><Tabs items={eventTabs} activeKey={tab} onChange={next => { setTab(next); setErrors([]); setPreview(false) }} /></div>
      <EventFields staff={staff} locations={locations} event={event} academy={academy} section={tab} updateEvent={updateEvent} />
      {tab === 'sharing' && <><DenseSectionPanel title="Booking page & sharing" headingLevel="h2" actions={<Button variant="secondary" onClick={() => setPreview(!preview)}>{preview ? 'Hide preview' : 'Preview booking page'}</Button>}><div className={styles.stack}><Input label="Event booking link" readOnly value={link} /><Button variant="secondary" onClick={() => copyText(link)}>Copy link</Button><Select label="Activity-specific link" value={bookingActivity} onChange={e => setBookingActivity(e.target.value)}><option value="">Choose activity</option>{event.activities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><code className={styles.code}>{`${link}?activity=${encodeURIComponent(bookingActivity)}`}</code><code className={styles.code}>{`<iframe title="${event.name.replace(/["<>]/g, '')} registration" src="${link}/embed" width="100%" height="720"></iframe>`}</code><Button variant="secondary" onClick={() => copyText(`<iframe title="Event registration" src="${link}/embed" width="100%" height="720"></iframe>`)}>Copy embed</Button></div></DenseSectionPanel>{preview && <DenseSectionPanel title="Booking page" headingLevel="h2"><div className={styles.stack}>{event.image && <Image className={styles.hero} src={event.image} alt={event.name} width={960} height={360} unoptimized />}<h2>{event.name || 'Untitled event'}</h2><p>{event.description}</p><p className={styles.muted}>{event.start} – {event.end} · {event.location}</p>{event.activities.map(activity => <DenseSectionPanel key={activity.id} title={activity.name} actions={<Button onClick={() => startBooking(event, undefined, activity.id)}>{activitySpace(event, activity.id, state.registrations) ? 'Register' : 'Join waitlist'}</Button>}><p>{activity.ages} · {activity.schedule || event.schedule || `${event.start} – ${event.end}`}</p><p className={styles.muted}>{activitySpace(event, activity.id, state.registrations)} spaces · {event.payment} · {event.payment === 'Free' ? 'No charge' : `USD ${event.price}${event.payment === 'Deposit' ? ` (deposit USD ${event.deposit})` : ''}`}</p></DenseSectionPanel>)}</div></DenseSectionPanel>}</>}
      {tab === 'participants' && <><Stats items={[[ 'Confirmed', registrations.filter(item => item.status === 'Confirmed').length ], ['Needs action', registrations.filter(item => ['Awaiting approval', 'Awaiting payment'].includes(item.status)).length], ['Waitlisted', registrations.filter(item => item.status === 'Waitlisted').length]]} /><DenseSectionPanel title="Participants" headingLevel="h2" actions={<Button onClick={() => startBooking(event)}>Register participant</Button>}><Table label="Event participants" rows={registrations} columns={[
        { id: 'name', header: 'Participant', width: '1.4fr', render: row => <PersonName as="button" onClick={() => { setPersonId(row.personId); setScreen('people'); setEventId(null) }}>{state.people.find(item => item.id === row.personId)?.name || 'Unknown contact'}</PersonName> },
        { id: 'activity', header: 'Activity', width: '1.2fr', render: row => event.activities.find(item => item.id === row.activityId)?.name || 'Removed activity' },
        { id: 'status', header: 'Registration', width: '1.4fr', render: row => <Select aria-label={`Registration status ${row.id}`} value={row.status} onChange={e => setState({ ...state, registrations: state.registrations.map(item => item.id === row.id ? { ...item, status: e.target.value as ExplorerRegistration['status'], attended: e.target.value === 'Confirmed' && item.attended } : item) })}>{['Confirmed', 'Awaiting approval', 'Awaiting payment', 'Waitlisted', 'Cancelled'].map(value => <option key={value}>{value}</option>)}</Select> },
        { id: 'attendance', header: 'Check-in', width: '1fr', render: row => <Checkbox label="Attended" disabled={row.status !== 'Confirmed'} checked={row.attended} onChange={e => setState({ ...state, registrations: state.registrations.map(item => item.id === row.id ? { ...item, attended: e.target.checked } : item) })} /> },
      ]} /></DenseSectionPanel><DenseSectionPanel title="Participant message" actions={<Button variant="secondary" onClick={() => setNotice(event.message.trim() ? 'Message draft saved.' : 'Write a message first.')}>Save draft</Button>}><Textarea label="Message draft" value={event.message} onChange={e => updateEvent({ message: e.target.value })} /></DenseSectionPanel></>}
    </>
  } else if (screen === 'events') {
    content = <><PageHeader title="Events" right={<Button onClick={() => startDraft('event', 'events')}>Create event</Button>} /><Stats items={[[ 'Events', state.events.length ], ['Published', state.events.filter(item => item.published).length], ['Registrations', state.registrations.filter(item => item.status !== 'Cancelled').length]]} />{renderCreationDrafts('event')}{renderEventTable()}</>
  } else if (screen === 'people') {
    content = <ContactsWorkspace onCreate={beginOpportunity} people={state.people.map(person => academy.singleLessons.some(booking => booking.personId === person.id) ? { ...person, clientTypes: [...new Set([...(person.clientTypes || []), 'Lessons' as const])] } : person)} registrations={state.registrations} onBook={() => setLessonChooser(true)} />
  } else if (screen === 'opportunities') {
    content = <OpportunitiesWorkspace adapter={opportunityAdapter} />
  } else {
    const workflowRows = drafts.filter(record => record.kind !== 'event' && record.kind !== 'group' && record.institution === academy.kind && hasEnrollmentName(record, state.people) && draftContent(record) !== draftBaselines.current.get(record.id)).map(record => {
      const progress = workflowProgress(record, context)
      const complete = record.kind === 'enrollment' && !!record.data.completedAt
      return {
        id: record.id, name: workflowName(record, context), open: () => setActiveId(record.id), complete,
        payment: record.kind === 'enrollment' ? <StatusBadge status={record.data.paymentStatus === 'paid' ? 'active' : 'pending'} label={enrollmentPaymentLabel(record.data)} /> : '—',
        type: record.kind === 'program' ? 'Program proposal / booking' : workflowLabels[record.kind],
        offering: record.kind === 'program' ? record.data.name || 'Not named' : record.kind === 'enrollment' ? record.data.draft.lessons.map(lesson => lesson.service === 'Group' ? lesson.instrument : `${lesson.service} lessons`).join(', ') || '—' : '—',
        progress: complete ? <StatusBadge status="active" label="Booked" /> : <div className={styles.stack}><ProgressStepper label="Workflow progress" steps={progress.steps} currentStep={progress.current} notStarted={!record.started} /><span>{progress.steps.filter(step => step.complete).length} / {progress.steps.length} complete</span></div>,
      }
    })
    const bandRows = academy.kind === 'music' ? bandEnrollments.filter(record => !!state.people.find(person => person.id === record.studentId)?.name.trim()).map(record => ({
      id: record.id, name: state.people.find(person => person.id === record.studentId)!.name, complete: !!record.completedAt,
      open: () => { if (record.completedAt) { if (record.bandId) { setBandPanelId(record.bandId); setScreen('groups') } else setStudentPanelId(record.studentId) } else setActiveBandEnrollment(record.id) },
      payment: <StatusBadge status={record.paymentStatus === 'succeeded' ? 'active' : 'pending'} label={record.paymentStatus === 'succeeded' ? 'Paid' : 'Not paid'} />,
      type: 'Band enrollment', offering: academy.groups.find(group => group.id === record.bandId)?.name || 'Band not assigned',
      progress: record.completedAt ? <StatusBadge status="active" label="Enrolled" /> : <div className={styles.stack}><ProgressStepper label="Workflow progress" steps={bandEnrollmentSteps.map((label, index) => ({ id: String(index), label, complete: index < record.step }))} currentStep={record.step} /><span>{record.step} / {bandEnrollmentSteps.length} complete</span></div>,
    })) : []
    const rows = [...workflowRows, ...bandRows]
    content = <>
      <PageHeader title="Enroll & Book" right={<Button onClick={() => calendarEnrollment?.openBooking ? calendarEnrollment.openBooking() : setLessonChooser(true)}>Add booking</Button>} />
      <ResponsiveDataTable rows={rows} getRowKey={record => record.id} ariaLabel="Enrollments" minDesktopWidth={700} emptyContent={<EmptyState title="No enrollments" />} columns={[
        { id: 'name', header: 'People', width: '1.5fr', render: record => <PersonName as="button" onClick={record.open}>{record.name}</PersonName> },
        { id: 'payment', header: 'Payment', width: '1fr', render: record => record.payment },
        { id: 'type', header: 'Type', width: '1fr', render: record => record.type },
        { id: 'offering', header: 'Offering', width: '1fr', render: record => record.offering },
        { id: 'progress', header: 'Progress', width: '1.5fr', render: record => record.progress },
        { id: 'actions', header: 'Actions', width: '1fr', render: record => <><Button variant="secondary" onClick={record.open}>{record.complete ? 'View' : 'Continue'}</Button>{(() => { const draft = drafts.find(item => item.id === record.id); return draft?.kind === 'enrollment' && draft.data.calendarRequest && !draft.data.completedAt ? <Button variant="secondary" onClick={() => { try { updateQueue(current => sendCalendarEnrollment(current, record.id)); setNotice('Enrollment request sent. The family can complete this same draft in the portal.') } catch (error) { setErrors([error instanceof Error ? error.message : 'Unable to send request.']) } }}>{draft.data.calendarRequest.sentAt ? 'Resend enrollment request' : 'Send enrollment request'}</Button> : null })()}</> },
      ]} />
    </>

  }
  const bandMemberships = (id: string) => {
    const bands = academy.groups.filter(group => group.memberIds.includes(id) || group.pendingMemberIds?.includes(id))
    return <div className={styles.stack}>{bands.length ? bands.map(group => <DenseSectionPanel key={group.id} title={group.name} actions={group.memberIds.includes(id) ? <Button variant="secondary" onClick={() => { setStudentPanelId(null); setBandPanelId(group.id) }}>View band</Button> : <Button onClick={() => startBandEnrollment(id, group.id)}>Complete band enrollment</Button>}><p>{group.memberIds.includes(id) ? 'Confirmed' : 'Pending'} · {group.memberIds.length} confirmed members</p>{bandEnrollments.filter(record => record.completedAt && record.studentId === id && record.bandId === group.id).map(record => <p key={record.id}>{record.pricing?.recurring === false ? 'Enrollment paid' : 'Subscription active'} · ${Number(record.monthlyPrice).toFixed(2)} {record.pricing?.unit || '/ month'} · Visa ending in 4242</p>)}</DenseSectionPanel>) : <EmptyState title="No band enrollments" />}</div>
  }
  const selectedBand = academy.kind === 'music' ? academy.groups.find(group => group.id === bandPanelId) : undefined
  const selectedStudent = studentPanelId ? explorerContactDirectory(state.people, [studentPanelId], state.registrations).contacts.find(contact => contact.id === studentPanelId) : undefined
  return <LeadWorkspaceContext.Provider value={opportunityAdapter}><ContactBandEnrollmentContext.Provider value={academy.kind === 'music' ? bandMemberships : undefined}><ExplorerShell embedded={embedded || enrollmentFocused} groupLabel={academy.kind === 'music' ? 'Bands & ensembles' : academy.kind === 'martial' ? 'Practice teams' : 'Study groups'} screen={screen} onNavigate={navigate}><div className={styles.root} style={rootStyle}><PageContainer style={{ boxSizing: 'border-box' }}><div className={styles.stack}>{notice && <Notice variant="success" onDismiss={() => setNotice('')}>{notice}</Notice>}{errors.length > 0 && <Notice variant="error">{errors.join(' ')}</Notice>}{content}      <Modal isOpen={lessonChooser && !calendarEnrollment?.openBooking} onClose={() => setLessonChooser(false)} size="wide" layout="content" ariaLabel="Enroll">
        <ModalHeader title="Enroll" onClose={() => setLessonChooser(false)} />
        <ModalBody><div className={styles.choices}>
          {lessonServices.some(record => formatsFor(record).includes('private')) && <EntryPathCard title="Private lessons" action="Enroll" onChoose={() => startDraft('enrollment', 'hub', undefined, { service: 'Private', instrument: lessonServices.find(record => formatsFor(record).includes('private'))!.values.name })}><Music size={28} color={colors.textSecondary} /></EntryPathCard>}
          {lessonServices.some(record => formatsFor(record).includes('semi')) && <EntryPathCard title="Semi-private lessons" action="Enroll" onChoose={() => startDraft('enrollment', 'hub', undefined, { service: 'Semi-private', instrument: lessonServices.find(record => formatsFor(record).includes('semi'))!.values.name })}><Users size={28} color={colors.textSecondary} /></EntryPathCard>}
          {lessonServices.length > 0 && <EntryPathCard title="Single lesson / trial" action="Book" onChoose={() => startDraft('enrollment', 'hub', undefined, { service: 'Private', instrument: lessonServices[0].values.name, frequency: 'À-la-carte' })}><Sparkles size={28} color={colors.textSecondary} /></EntryPathCard>}
          {groupServices.map(service => <EntryPathCard key={service.id} title={service.values.name} action="Enroll" onChoose={() => academy.kind === 'music' && /band|ensemble/i.test(service.values.name) ? startBandEnrollment() : startDraft('enrollment', 'hub', undefined, { service: 'Group', instrument: service.values.name })}><Users size={28} color={colors.textSecondary} /></EntryPathCard>)}
          {academy.eventTypes.some(type => type.enabled) && <EntryPathCard title="Event registration" action="Register" onChoose={() => startDraft('registration')}><CalendarDays size={28} color={colors.textSecondary} /></EntryPathCard>}
        </div></ModalBody>
      </Modal>
      {selectedBand && <BandSlidePanel key={selectedBand.id} band={selectedBand} requests={enrollmentRequests} onEnrollmentRequest={ids => setRequestTargets({ bandId: selectedBand.id, ids })} people={state.people} staff={staff} tasks={context.tasks || []} enrollments={bandEnrollments} onBook={band => {
        const record = newWorkflowDraft('program', academy, 'groups')
        if (record.kind !== 'program') return
        record.data = { ...record.data, groupId: band.id, name: band.name, memberIds: [...band.memberIds, ...(band.pendingMemberIds || [])], leader: band.leader }
        draftBaselines.current.set(record.id, draftContent(record)); putDraft(record); setBandPanelId(null); setActiveId(record.id); setScreen('book'); setErrors([])
      }} onClose={() => setBandPanelId(null)} onChange={band => setAcademy(current => ({ ...current, groups: current.groups.map(group => group.id === band.id ? band : group) }))} onRemove={studentId => {
        const id = selectedBand.id
        setAcademy(current => ({ ...current, groups: current.groups.map(band => band.id === id ? { ...band, memberIds: band.memberIds.filter(member => member !== studentId), pendingMemberIds: band.pendingMemberIds?.filter(member => member !== studentId), memberInstruments: Object.fromEntries(Object.entries(band.memberInstruments || {}).filter(([member]) => member !== studentId)) } : band) }))
        setInquiries(current => current.map(inquiry => inquiry.bandId === id && inquiry.personId === studentId && !['Lost', 'Spam', 'Ghosted us'].includes(inquiry.stage) ? { ...inquiry, stage: 'Lost' } : inquiry))
        setEnrollmentRequests(current => resolveBandEnrollmentRequests(current, studentId, id))
      }} onEnroll={startBandEnrollment} onStudent={setStudentPanelId} onAdd={(id, ids, subscriptions) => {
        const group = academy.groups.find(group => group.id === id)
        if (!group) return
        const result = addBandCandidates(group, ids, state.people, inquiries)
        result.group.memberInstruments = { ...group.memberInstruments, ...Object.fromEntries(ids.filter(studentId => !group.memberInstruments?.[studentId]).map(studentId => [studentId, defaultBandInstrument(state.people.find(person => person.id === studentId))])) }
        let next = { groups: academy.groups.map(band => band.id === id ? result.group : band), inquiries: result.inquiries, people: state.people, enrollments: bandEnrollments }
        for (const studentId of ids) if (subscriptions[studentId]) next = assignBandSubscription(subscriptions[studentId], studentId, id, next.enrollments, next.groups, next.people, next.inquiries)
        setAcademy(current => ({ ...current, groups: next.groups })); setInquiries(next.inquiries); setState(current => ({ ...current, people: next.people })); setBandEnrollments(next.enrollments); setEnrollmentRequests(current => ids.reduce((result, studentId) => subscriptions[studentId] ? resolveBandEnrollmentRequests(result, studentId, id) : result, current))
      }} onRequest={(band, week) => setTasks(current => requestProgramAvailability(current, `band:${band.id}`, academy.kind, { name: band.name, groupId: band.id, memberIds: [...band.memberIds, ...(band.pendingMemberIds || [])], leader: band.leader, roles: {}, week, date: '', time: '', duration: 60, mode: 'ongoing', price: '', discount: 0 }))} onResponse={(id, allowed, blocks) => setTasks(current => submitProgramAvailability(current, id, allowed, blocks))} onPortal={() => { setBandPanelId(null); setPortal(true) }} />}
      {requestTargets && academy.groups.find(group => group.id === requestTargets.bandId) && <BandEnrollmentRequestPanel band={academy.groups.find(group => group.id === requestTargets.bandId)!} ids={requestTargets.ids} people={state.people} services={configuredServices} plans={configuredSetup.plans || []} discounts={discountSetup.discounts} discountPolicy={discountSetup.policy} onClose={() => setRequestTargets(null)} onSend={(price, pricing) => {
        const band = academy.groups.find(group => group.id === requestTargets.bandId)!
        const next = sendBandEnrollmentRequests(enrollmentRequests, band, requestTargets.ids, state.people, bandEnrollments, price, [{ id: 'band-agreement', values: { name: 'Participation agreement', waiver: (academy.eventDefaults || newExplorerEvent('defaults')).waiver } }], undefined, pricing)
        setEnrollmentRequests(next); setRequestTargets(null); setNotice('Enrollment request sent.')
      }} />}
      {creationKey && <ContactOpportunityForm students={state.people.filter(person => opportunityIds?.includes(person.id)).map(person => person.name)} onCreateBand={() => { const ids = opportunityIds || []; setCreationKey(''); setOpportunityIds(null); startDraft('group', 'people', ids) }} services={configuredServices.map(service => ({ id: service.id, name: service.values.name }))} bands={academy.groups.map(band => ({ id: band.id, name: band.name }))} onClose={() => { setCreationKey(''); setOpportunityIds(null) }} onSave={({ type, serviceId, bandId }) => {
        const service = configuredServices.find(service => service.id === serviceId)
        const band = type === 'band' ? academy.groups.find(band => band.id === bandId) : undefined
        const result = createOpportunities(inquiries, state.people, { personIds: opportunityIds || [], interest: type === 'band' ? band?.name || 'Band program' : service?.values.name || '', category: type === 'band' ? 'Program inquiries' : type === 'lesson' ? 'Lesson requests' : 'Service inquiries', origin: 'staff_initiated', programId: type === 'band' ? undefined : serviceId, bandId: band?.id, serviceType: type === 'band' ? 'band' : undefined, followUp: '', note: '' })
        setInquiries(result.inquiries); setCreationKey(''); setOpportunityIds(null); setNotice('Opportunities saved.')
      }} />}
      {selectedStudent && <ContactPrototypeContext.Provider value><ContactSlidePanel prototype contact={selectedStudent} tenantFields={[]} initialPanelTab="enrollments" onClose={() => setStudentPanelId(null)} onUpdated={() => {}} /></ContactPrototypeContext.Provider>}
</div></PageContainer></div></ExplorerShell></ContactBandEnrollmentContext.Provider></LeadWorkspaceContext.Provider>
}
