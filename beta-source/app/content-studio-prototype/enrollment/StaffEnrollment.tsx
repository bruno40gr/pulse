'use client'

import { useCalendarEnrollment } from '@/beta-source/app/odeon-demo/CalendarEnrollmentContext'
import { EnrollmentTimeError } from '@/beta-source/lib/academy-calendar-booking'
import { EnrollmentLayout } from '@/components/ui/EnrollmentLayout'
import { personFieldErrors } from '@/beta-source/lib/academy-staff-enrollment'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Checkbox'
import { RadioOptionGroup } from '@/components/ui/RadioOptionGroup'
import { Switch } from '@/components/ui/Switch'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Select } from '@/components/ui/Select'
import { scheduleTeachers } from '@/beta-source/lib/academy-enrollment-schedule'
import { SectionTitle } from '@/components/ui/SectionTitle'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, X } from 'lucide-react'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { SurfacePanel } from '@/components/ui/SurfacePanel'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { Disclosure } from '@/components/ui/Disclosure'
import { enrollmentSteps as steps } from '@/beta-source/lib/academy-staff-enrollment'
import type { EnrollmentDraftRecord } from '@/beta-source/lib/academy-enrollment-drafts'
import { colors, spacing, typography } from '@/lib/tokens'
import {
  enrollmentServices, enrollmentInstruments, enrollmentGroupPrograms, enrollmentPeople, enrollmentStepError, enrollmentStudents, ensureStudentLessons, lessonStudent, lessonPrice, newLesson, personDetailsError,
  newStaffEnrollment, saveLocalEnrollment, selectEnrollmentContact,
  type EnrollmentPerson, type LessonChoice, type StaffEnrollment as EnrollmentDraft,
} from '@/beta-source/lib/academy-staff-enrollment'
import styles from './enrollment.module.css'
import { EnrollmentCardPreview } from './EnrollmentCardPreview'
import LessonSchedule from './LessonSchedule'
import { availableScheduleTeachers, formatScheduleDate, formatScheduleTime } from '@/beta-source/lib/academy-enrollment-schedule'
import { enrollmentBillingPreview } from '@/beta-source/lib/academy-enrollment-pricing'

const fullName = (person: EnrollmentPerson | null) => person ? `${person.firstName} ${person.lastName}` : ''
const money = (amount: number) => `$${(amount / 100).toFixed(2)}`

const lessonEndTime = (lesson: LessonChoice) => {
  const minutes = Number(lesson.time.slice(0, 2)) * 60 + Number(lesson.time.slice(3)) + Number(lesson.duration)
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function PersonPicker({ title, value, people, onChange, onAdd, contactSelection = false, startWithLookup = false, relationship, onRelationship, relationshipLabel = 'Relationship to contact', showErrors = false, requireContact = false }: {
  title: string; value: EnrollmentPerson | null; people: readonly EnrollmentPerson[]
  onChange: (person: EnrollmentPerson | null) => void; onAdd: (person: EnrollmentPerson) => void
  contactSelection?: boolean
  studentLookup?: boolean
  startWithLookup?: boolean
  relationship?: string; onRelationship?: (relationship: string) => void; relationshipLabel?: string
  showErrors?: boolean; requireContact?: boolean
}) {
  const [creating, setCreating] = useState(!value)
  const [finding, setFinding] = useState((contactSelection || startWithLookup) && !value)
  const [mode, setMode] = useState<'existing' | 'new'>(() => !value || !value.id.startsWith('local-') && people.some(person => person.id === value.id) ? 'existing' : 'new')
  const choices = useRef<{ existing: EnrollmentPerson | null; new: EnrollmentPerson | null }>({ existing: mode === 'existing' ? value : null, new: mode === 'new' ? value : null })
  const [selectedExisting, setSelectedExisting] = useState(() => !!value && !value.id.startsWith('local-') && people.some(person => person.id === value.id))
  const existing = selectedExisting && !!value
  const errors: Partial<ReturnType<typeof personFieldErrors>> = showErrors ? personFieldErrors(value, requireContact) : {}

  // A saved/selected summary must not conceal fields that failed validation.
  useEffect(() => {
    if (showErrors && Object.values(personFieldErrors(value, requireContact)).some(Boolean)) {
      setCreating(true)
      setFinding(false)
      setMode('new')
    }
  }, [showErrors, value, requireContact])

  function update(field: 'firstName' | 'lastName' | 'email' | 'phone' | 'birthday', text: string) {
    onChange({ ...(value || { id: `local-${crypto.randomUUID()}`, firstName: '', lastName: '', email: '', phone: '', activeTeacher: false }), [field]: text })
  }

  return <section className={styles.personPicker}>
    {title && <SectionTitle as="h3" variant="card">{title}</SectionTitle>}
    {contactSelection && <RadioOptionGroup hideLabel label="Contact type" value={mode} options={[{ id: 'existing', label: 'Existing contact' }, { id: 'new', label: 'New contact' }]} onChange={next => {
      choices.current[mode] = value
      const selectedMode = next as 'existing' | 'new'
      setMode(selectedMode)
      const selected = choices.current[selectedMode]
      onChange(selected)
      setFinding(selectedMode === 'existing')
      setCreating(selectedMode === 'new')
      setSelectedExisting(selectedMode === 'existing' && !!selected)
    }} />}
    {value && !creating && !finding ? <div className={styles.person}><SurfacePanel appearance="flat" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, width: '100%', minWidth: 0, boxSizing: 'border-box', flexWrap: 'wrap' }}><div style={{ minWidth: 0, overflowWrap: 'anywhere', flex: '1 1 120px' }}><strong>{fullName(value)}</strong>{value.email && <p>{value.email}</p>}{value.phone && <p>{value.phone}</p>}{value.birthday && <p>Birthday · {formatScheduleDate(value.birthday, { month: 'short', day: 'numeric', year: 'numeric' })}</p>}{onRelationship && <p>{relationshipLabel} · {relationship || 'Not specified'}</p>}</div><div className={styles.personActions}><Button type="button" variant="ghost" onClick={() => { if (existing) { onChange(null); setFinding(contactSelection); setCreating(true); setSelectedExisting(false) } else setCreating(true) }}>{existing ? 'Remove' : 'Edit'}</Button></div></SurfacePanel></div>
      : !finding ? <div style={contactSelection ? { display: 'grid', gap: spacing.lg, marginTop: spacing.lg } : undefined}>
        {contactSelection && <SectionTitle as="h3">Contact details</SectionTitle>}
        <div onBlur={event => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        // Collapsing fields during pointer-down moves the footer before its click.
        // Keep the editor stable while an action button receives focus.
        if (typeof HTMLElement !== 'undefined' && event.relatedTarget instanceof HTMLElement && event.relatedTarget.closest('button')) return
        if (value && !personDetailsError(value)) { onAdd(value); if (!contactSelection) setCreating(false) }
      }}>
        <FieldGrid>
          <Input label="First name" error={errors.firstName} autoComplete="off" value={value?.firstName || ''} onChange={event => update('firstName', event.target.value)} />
          <Input label="Last name" error={errors.lastName} autoComplete="off" value={value?.lastName || ''} onChange={event => update('lastName', event.target.value)} />
          <Input label="Email" error={errors.email} type="email" autoComplete="off" value={value?.email || ''} onChange={event => update('email', event.target.value)} />
          <Input label="Phone" error={errors.phone} type="tel" autoComplete="off" value={value?.phone || ''} onChange={event => update('phone', event.target.value)} />
          <Input label="Birthday" error={errors.birthday} type="date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} value={value?.birthday || ''} onChange={event => update('birthday', event.target.value)} />
          {onRelationship && <Select label={relationshipLabel} value={relationship || ''} onChange={event => onRelationship(event.target.value)}><option value="">Choose relationship</option>{['Self', 'Child', 'Grandchild', 'Sibling', 'Other'].map(value => <option key={value}>{value}</option>)}</Select>}
        </FieldGrid>
      </div></div> : <div style={contactSelection ? { marginTop: spacing.lg } : undefined}>
        <SearchSelect fieldLabel={contactSelection ? "Search for a contact" : undefined} defaultOpen={false} label="Find a person" options={people.map(person => ({ value: person.id, label: `${fullName(person)} ${person.email} ${person.phone}`, content: <><strong>{fullName(person)}</strong><span> · {person.email}</span></> }))} onSelect={id => { const person = people.find(item => item.id === id); if (person) { onChange(person); setSelectedExisting(true); setFinding(false); setCreating(false) } }} onClose={() => { if (!contactSelection) { setFinding(false); setCreating(true) } }} />
        {!contactSelection && <Button type="button" variant="ghost" onClick={() => { setFinding(false); setCreating(true) }}>Enter details</Button>}
      </div>}
  </section>
}

export default function StaffEnrollment({ initialRecord, onSaveAndClose, onDraftChange, onComplete, availablePeople, singleSession = false, academyTeachers, availability }: {
  availablePeople?: readonly EnrollmentPerson[]
  singleSession?: boolean
  /** The academy's own staff, used for scheduling instead of the sample roster. */
  academyTeachers?: readonly { name: string; instruments: string[] }[]
  availability?: (date: string, time: string, lesson: LessonChoice, siblings?: readonly LessonChoice[]) => readonly { name: string }[]
  initialRecord?: EnrollmentDraftRecord
  onSaveAndClose?: (draft: EnrollmentDraft, step: number, reviewedSteps: number[]) => void
  onComplete?: (draft: EnrollmentDraft, step: number, reviewedSteps: number[]) => void
  onDraftChange?: (draft: EnrollmentDraft, step: number, reviewedSteps: number[]) => void
} = {}) {
  const configuredServices = useCalendarEnrollment()?.services?.filter(service => !['room', 'rehearsal', 'event'].includes(service.values.bookingKind))
  const configuredDurations = (serviceId: string) => (configuredServices?.find(service => service.id === serviceId)?.values.durations || '').split(',').map(Number).filter(value => value > 0)
  const [draft, setDraft] = useState(() => initialRecord ? structuredClone(initialRecord.draft) : newStaffEnrollment())
  const [people, setPeople] = useState<readonly EnrollmentPerson[]>(availablePeople || enrollmentPeople)
  // The academy's own availability decides which teacher can take a booked slot.
  const scopedLessons = (current: EnrollmentDraft) => current.lessons.map(lesson => ({ ...lesson, studentId: lesson.studentId || current.student?.id }))
  const availableFor = (current: EnrollmentDraft, lesson: LessonChoice) => availability
    ? availability(lesson.start, lesson.time, { ...lesson, studentId: lesson.studentId || current.student?.id }, scopedLessons(current))
    : availableScheduleTeachers(lesson, lesson.start, lesson.time, lessonStudent(current, lesson), current.lessons.map(item => ({ ...item, studentId: item.studentId || current.student?.id })))
  const [step, setStep] = useState(() => {
    if (!initialRecord) return 0
    // Saved choices are proposals, not reservations. Recheck before resuming
    // beyond scheduling, and return to the earliest now-invalid prerequisite.
    for (let index = 0; index < initialRecord.step; index++) {
      if (enrollmentStepError(initialRecord.draft, index)) return index
      if (index === 2 && initialRecord.draft.lessons.some(lesson => !availableFor(initialRecord.draft, lesson).some(teacher => teacher.name === lesson.teacher))) return 2
    }
    return initialRecord.step
  })
  // A booked slot already knows its teacher; keep that as the schedule preference.
  const [teacherPreferences, setTeacherPreferences] = useState<Record<string, string>>(() => Object.fromEntries((initialRecord?.draft.lessons || []).flatMap(lesson => lesson.teacher ? [[lesson.id, lesson.teacher] as [string, string]] : [])))
  const [activeLessonId, setActiveLessonId] = useState('lesson-1')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<EnrollmentDraft | null>(initialRecord?.completedAt ? initialRecord.draft : null)
  const [reviewedSteps, setReviewedSteps] = useState<number[]>(initialRecord?.reviewedSteps || [])
  useEffect(() => { onDraftChange?.(draft, step, reviewedSteps) }, [draft, step, reviewedSteps, onDraftChange])
  const students = enrollmentStudents(draft)
  const lessonStudents = [...new Map([...students, ...(draft.contact ? [draft.contact] : [])].map(person => [person.id, person])).values()]
  const billing = enrollmentBillingPreview(draft)
  const activeLesson = draft.lessons.find(lesson => lesson.id === activeLessonId) || draft.lessons[0]
  const contactReady = !!draft.contact && (draft.contact.id.startsWith('local-')
    ? !Object.values(personFieldErrors(draft.contact, true)).some(Boolean)
    : people.some(person => person.id === draft.contact?.id))
  const contactFieldError = step === 0 && Object.values(personFieldErrors(draft.contact, true)).some(Boolean)
  const separateStudents = useRef<Pick<EnrollmentDraft, 'student' | 'additionalStudents' | 'lessons' | 'studentRelationships'> | null>(null)
  const patch = (value: Partial<EnrollmentDraft>) => setDraft(current => ({ ...current, ...value }))
  const addPerson = (person: EnrollmentPerson) => setPeople(current => [...current.filter(item => item.id !== person.id), { ...person }])
  const updateLesson = (id: string, value: Partial<LessonChoice>) => { setError(''); setDraft(current => ({ ...current, lessons: current.lessons.map(lesson => lesson.id === id ? { ...lesson, ...value } : lesson) })) }

  function move(next: number) {
    setError('')
    setStep(next)
  }
  function jumpToStep(next: number) {
    if (next <= step) { move(next); return }
    const prepared = { ...draft, lessons: ensureStudentLessons(draft, initialRecord?.entryLesson) }
    for (let index = 0; index < next; index++) {
      const problem = enrollmentStepError(prepared, index)
      if (problem) { setDraft(prepared); move(index); setError(problem); return }
      if (index === 2 && prepared.lessons.some(lesson => !availableFor(prepared, lesson).some(teacher => teacher.name === lesson.teacher))) { move(2); setError('Choose an available time for each lesson.'); return }
    }
    setDraft(prepared)
    setReviewedSteps(current => [...new Set([...current, ...Array.from({ length: next }, (_, index) => index)])])
    move(next)
  }
  // The academy's own availability decides which teacher can take a booked slot.
  function submit(event: FormEvent) {
    event.preventDefault()
    const problem = enrollmentStepError(draft, step)
    if (problem) { setError(problem); return }
    const unavailable = step >= 2 && draft.lessons.find(lesson => !availableFor(draft, lesson).some(teacher => teacher.name === lesson.teacher))
    if (unavailable) {
      setActiveLessonId(unavailable.id); move(2); setError(`${fullName(lessonStudent(draft, unavailable))} · ${unavailable.instrument}: choose another available time.`); return
    }
    if (step === 0) {
      const next = { ...draft, lessons: ensureStudentLessons(draft, initialRecord?.entryLesson) }
      setDraft(next)
      if (draft.contact) addPerson(draft.contact)
      if (draft.student) addPerson(draft.student)
      if (draft.manager) addPerson(draft.manager)
      draft.additionalStudents.forEach(person => { if (person) addPerson(person) })
    }
    if (step === 1 && draft.lessons[0]) setActiveLessonId(draft.lessons[0].id)
    const reviewed = [...new Set([...reviewedSteps, step])]
    setReviewedSteps(reviewed)
    if (step < 3) { move(step + 1); return }
    if (onSaveAndClose) {
      try { (onComplete || onSaveAndClose)(saveLocalEnrollment(draft), step, reviewed) }
      catch (cause) {
        if (cause instanceof EnrollmentTimeError) { setActiveLessonId(cause.lessonId); move(2) }
        setError(cause instanceof Error ? cause.message : 'Please check the enrollment details.')
      }
      return
    }
    try { setSaved(saveLocalEnrollment(draft)); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Please check the enrollment details.') }
  }
  function reset() {
    setDraft(newStaffEnrollment()); setSaved(null); setActiveLessonId('lesson-1'); move(0)
  }

  const teacherOptions = activeLesson ? (academyTeachers?.length ? academyTeachers : scheduleTeachers).filter(teacher => teacher.instruments.some(instrument => instrument === activeLesson.instrument)) : []
  const calendar = activeLesson ? <LessonSchedule enrollmentPicker compactCopy toolbarActions={<div style={{ minWidth: 220, maxWidth: '100%', marginLeft: 'auto' }}><Select label="Teacher" value={teacherPreferences[activeLesson.id] || ''} onChange={event => setTeacherPreferences(current => ({ ...current, [activeLesson.id]: event.target.value }))}><option value="">Any suitable teacher</option>{teacherOptions.map(teacher => <option key={teacher.name}>{teacher.name}</option>)}</Select></div>} teacherPreference={teacherPreferences[activeLesson.id]} key={`${activeLesson.id}-${activeLesson.instrument}-${activeLesson.duration}-${activeLesson.studentId}`} lesson={activeLesson} lessons={draft.lessons.map(lesson => ({ ...lesson, studentId: lesson.studentId || draft.student?.id }))} student={lessonStudent(draft, activeLesson)} students={students} manager={draft.manager} onSelectLesson={setActiveLessonId} onChange={value => updateLesson(activeLesson.id, value)} availability={availability ? (date, time) => availability(date, time, { ...activeLesson, studentId: activeLesson.studentId || draft.student?.id }, scopedLessons(draft)) : undefined} /> : null

  return <main className={styles.workspace} style={{ background: colors.background, color: colors.text, fontFamily: typography.fontSans }}>
    {!onSaveAndClose && <header className={styles.header}><span className={styles.brand}>odeon</span><span className={styles.demo}>Local preview · changes stay on this page</span></header>}
    <EnrollmentLayout title={saved ? 'Booking' : singleSession ? 'Single lesson / trial' : 'Enroll a student'} width={!saved && step === 2 ? 'expanded' : 'focused'} fullWidth={!saved && step === 2} currentStep={step} steps={saved ? undefined : steps} onStepChange={jumpToStep} actions={onSaveAndClose ? <Button type="button" variant="secondary" onClick={() => onSaveAndClose(draft, step, reviewedSteps)}>{saved ? 'Close' : 'Save & close'}</Button> : undefined}>
      {initialRecord?.preferences?.some(item => item.interest || item.availability?.preferredDays || item.availability?.preferredTimes) && <Notice title="From the inquiry">
        {initialRecord.preferences.map(item => <p key={item.studentId}>{item.name}: {[item.interest, item.availability?.preferredDays, item.availability?.preferredTimes, item.availability?.preferredDate, item.availability?.timeWindow].filter(Boolean).join(' · ') || 'No preferences recorded'}</p>)}
      </Notice>}
      {saved ? <section className={styles.saved}>
        <Check size={26} aria-hidden="true" /><h2>{fullName(saved.student)}</h2>
        <dl><dt>Payer</dt><dd>{saved.payer === 'other' ? saved.otherPayer?.name : fullName(saved.payer === 'manager' ? saved.manager : saved.student)}</dd><dt>Payment</dt><dd>{initialRecord?.paymentStatus === 'paid' ? 'Paid' : saved.payment === 'later' ? 'Unpaid' : 'Paid'}</dd><dt>Status</dt><dd>Booked</dd></dl>
        {saved.lessons.map(lesson => <div key={lesson.id} className={styles.savedLesson}><strong>{fullName(lessonStudent(saved, lesson))} · {lesson.instrument} with {lesson.teacher}</strong><p>{lesson.frequency} · {lesson.day} at {lesson.time} · {lesson.duration} minutes</p><p>{money(lessonPrice(lesson, lessonStudent(saved, lesson)).total)} per lesson</p></div>)}
        {!onSaveAndClose && <Button onClick={reset}>Enroll another student</Button>}
      </section> : <>
        <div className={`${styles.layout} ${step === 2 ? styles.scheduleLayout : ''}`}>
          <form onSubmit={submit} noValidate className={styles.card}>
            {step === 0 && <>
              <SectionTitle as="h2">Add a contact</SectionTitle>
              <PersonPicker contactSelection showErrors={!!error} requireContact studentLookup startWithLookup title="" value={draft.contact} people={people} onAdd={addPerson} onChange={contact => setDraft(current => selectEnrollmentContact(current, contact, people))} />
              {contactReady && <div className={styles.selfToggle}><Switch inline label="Classes are for this person" checked={draft.contactIsStudent} onChange={event => {
                const self = event.target.checked
                if (self) separateStudents.current = { student: draft.student, additionalStudents: draft.additionalStudents, lessons: draft.lessons, studentRelationships: draft.studentRelationships }
                patch({ contactIsStudent: self, student: self ? draft.contact : separateStudents.current?.student || null, additionalStudents: self ? [] : separateStudents.current?.additionalStudents || [], manager: self ? null : draft.contact, payer: self ? 'student' : 'manager', studentRelationships: self && draft.contact ? { ...draft.studentRelationships, [draft.contact.id]: 'Self' } : separateStudents.current?.studentRelationships || draft.studentRelationships, lessons: self ? draft.lessons.filter(lesson => lesson.studentId === draft.contact?.id) : separateStudents.current?.lessons || [] })
              }} /></div>}
              {contactReady && !draft.contactIsStudent && <div className={styles.students}>
                <DenseSectionPanel title="Student 1" actions={<Button type="button" variant="secondary" size="sm" onClick={() => patch({ additionalStudents: [...draft.additionalStudents, null] })}><Plus size={15} aria-hidden="true" />Add another student</Button>}>

                  {!draft.contactIsStudent && <PersonPicker showErrors={!!error} studentLookup relationshipLabel="Student 1 relationship to contact" relationship={draft.studentRelationships[draft.student?.id || ''] || ''} onRelationship={value => { if (draft.student) patch({ studentRelationships: { ...draft.studentRelationships, [draft.student.id]: value } }) }} title="" value={draft.student} people={people.filter(person => person.id !== draft.contact?.id && !draft.additionalStudents.some(student => student?.id === person.id))} onChange={student => patch({ student, lessons: draft.lessons.map(lesson => !lesson.studentId || lesson.studentId === draft.student?.id ? { ...lesson, studentId: student?.id, teacher: '', start: '', time: '' } : lesson) })} onAdd={addPerson} />}
                </DenseSectionPanel>
                {draft.additionalStudents.map((person, index) => <DenseSectionPanel key={index} title={`Student ${index + 2}`} actions={<Button type="button" variant="ghost" aria-label={`Remove student ${index + 2}`} onClick={() => patch({ additionalStudents: draft.additionalStudents.filter((_, item) => item !== index), lessons: draft.lessons.filter(lesson => !person || lesson.studentId !== person.id) })}><X size={16} /></Button>}>
                  <PersonPicker showErrors={!!error} studentLookup relationshipLabel={`Student ${index + 2} relationship to contact`} relationship={draft.studentRelationships[person?.id || ''] || ''} onRelationship={value => { if (person) patch({ studentRelationships: { ...draft.studentRelationships, [person.id]: value } }) }} title="" value={person} people={people.filter(item => item.id !== draft.contact?.id && !students.some(student => student.id === item.id && student.id !== person?.id))} onChange={value => patch({ additionalStudents: draft.additionalStudents.map((item, position) => position === index ? value : item), lessons: draft.lessons.map(lesson => person && lesson.studentId === person.id ? { ...lesson, studentId: value?.id || 'unassigned', teacher: '', time: '', start: '' } : lesson) })} onAdd={addPerson} />
                </DenseSectionPanel>)}
              </div>}
            </>}
            {(step === 1 || step === 2) && <><h2>{step === 1 ? 'Set up lessons' : 'Choose times'}</h2><div className={step === 2 ? styles.bookingLayout : undefined}><div className={styles.studentCards} role="region" tabIndex={step === 2 ? 0 : undefined} aria-label="Student lessons">{draft.lessons.map((lesson, index) => <section key={lesson.id} className={`${styles.studentCard} ${activeLesson.id === lesson.id ? styles.selectedCard : ''}`} onFocus={() => setActiveLessonId(lesson.id)} onClick={() => setActiveLessonId(lesson.id)}>
              <div className={styles.sectionHeading}><h3><button type="button" className={styles.cardSelect} aria-pressed={activeLesson.id === lesson.id} onClick={() => setActiveLessonId(lesson.id)}>{fullName(lessonStudent(draft, lesson)) || 'Choose a student'}</button></h3>{draft.lessons.length > 1 && <Button type="button" variant="ghost" className={styles.lessonDelete} size="sm" title="Remove lesson" aria-label={`Remove lesson ${index + 1}`} onClick={event => { event.stopPropagation(); const remaining = draft.lessons.filter(item => item.id !== lesson.id); patch({ lessons: remaining }); setActiveLessonId(remaining[0]?.id || ''); if (step === 2 && !remaining.some(item => lessonStudent(draft, item)?.id === lessonStudent(draft, lesson)?.id)) move(1) }}><Trash2 size={16} aria-hidden="true" /></Button>}</div>
              {step === 1 ? <FieldGrid>
                {lesson.addedLesson ? <Select label="Student" value={lesson.studentId || ''} onChange={event => updateLesson(lesson.id, { studentId: event.target.value, teacher: '', start: '', time: '' })}><option value="">Choose a student</option>{lessonStudents.map(person => <option key={person.id} value={person.id}>{fullName(person)}</option>)}</Select> : <Input label="Student" value={fullName(lessonStudent(draft, lesson))} readOnly />}
                {configuredServices ? <>
                  <Select label="Service" value={lesson.serviceId || ''} onChange={event => {
                    const service = configuredServices.find(item => item.id === event.target.value)
                    if (!service) return
                    const formats = (() => { try { return JSON.parse(service.values.formats || '[]') as string[] } catch { return [] as string[] } })()
                    updateLesson(lesson.id, { serviceId: service.id, service: formats.includes('group') && !formats.includes('private') ? 'Group' : 'Private', instrument: service.values.name === 'Voice & Vocals' ? 'Voice' : service.values.name === 'Band' ? 'Band Program' : service.values.name, duration: String(configuredDurations(service.id)[0] || 30), teacher: '', time: '', start: '', roomId: undefined })
                  }}><option value="">Choose a service</option>{configuredServices.map(service => <option key={service.id} value={service.id}>{service.values.name}</option>)}</Select>
                  <Select label="Length" disabled={!lesson.serviceId} value={lesson.duration} onChange={event => updateLesson(lesson.id, { duration: event.target.value, teacher: '', time: '', start: '' })}>{(configuredDurations(lesson.serviceId || '').length ? configuredDurations(lesson.serviceId || '') : [30, 60]).map(duration => <option key={duration} value={duration}>{duration} minutes</option>)}</Select>
                </> : <><Select label="Service" value={lesson.service} onChange={event => { const service = event.target.value as LessonChoice['service']; updateLesson(lesson.id, { service, instrument: service === 'Group' ? 'Tiny Keys' : 'Piano', duration: initialRecord?.fromCalendar ? '30' : service === 'Group' || service === 'Semi-private' ? '45' : '30', serviceId: undefined, roomId: undefined, teacher: '', time: '', start: '' }) }}>{enrollmentServices.map(value => <option key={value}>{value}</option>)}</Select>
                <Select label={lesson.service === 'Group' ? 'Program' : 'Instrument'} value={lesson.instrument} onChange={event => updateLesson(lesson.id, { instrument: event.target.value, serviceId: undefined, roomId: undefined, ...(lesson.service === 'Group' ? { duration: event.target.value === 'Band Program' ? '60' : '45' } : {}), teacher: '', time: '', start: '' })}><option value="">Choose a program</option>{(lesson.service === 'Group' ? enrollmentGroupPrograms : enrollmentInstruments).map(value => <option key={value}>{value}</option>)}</Select></>
                }
                {!configuredServices && (lesson.service !== 'Group' || lesson.instrument === 'Band Program') && <Select label="Length" value={lesson.duration} onChange={event => updateLesson(lesson.id, { duration: event.target.value, teacher: '', time: '', start: '' })}>{(lesson.instrument === 'Band Program' ? Array.from({ length: 24 }, (_, index) => (index + 1) * 30) : [30, 45, 60]).map(duration => <option key={duration} value={duration}>{duration} minutes</option>)}</Select>}
                {singleSession ? <Input label="Booking" value="One session / à-la-carte" readOnly /> : <Select label="Booking" value={lesson.frequency} onChange={event => updateLesson(lesson.id, { frequency: event.target.value, trialDiscount: undefined, start: '', time: '' })}><option value="Monthly subscription">Ongoing / subscription</option><option value="À-la-carte">One session / à-la-carte</option></Select>}
                {lesson.frequency === 'À-la-carte' && <Input label="Trial discount (%)" type="number" min={0} max={100} value={lesson.trialDiscount || 0} onChange={event => updateLesson(lesson.id, { trialDiscount: Number(event.target.value) })} />}
              </FieldGrid> : <p>{lesson.service} · {lesson.instrument} · {lesson.frequency === 'Monthly subscription' ? 'Weekly' : 'One lesson'} · {lesson.duration} minutes</p>}
              {step === 2 && <p className={styles.lessonStatus}>{lesson.teacher && lesson.start && lesson.time ? <><span><Check className={styles.bookingCheck} size={13} aria-label="Time selected" />{formatScheduleDate(lesson.start, { weekday: 'short', month: 'short', day: 'numeric' })} · {formatScheduleTime(lesson.time)}–{formatScheduleTime(lessonEndTime(lesson))}</span><span>{lesson.teacher}</span></> : <span>Choose a time</span>}</p>}
            </section>)}</div>{step === 1 && <Button className={styles.addLesson} type="button" variant="secondary" onClick={() => { const id = crypto.randomUUID(); const nextStudent = lessonStudents.length === 1 ? lessonStudents[0] : null; patch({ lessons: [...draft.lessons, { ...newLesson(id), ...initialRecord?.entryLesson, studentId: nextStudent?.id || '', addedLesson: true }] }); setActiveLessonId(id) }}><Plus size={15} aria-hidden="true" />Add another lesson</Button>}
              {step === 2 && activeLesson && calendar}
            </div></>}
            {step === 3 && <>
              <h2>Pricing & payment</h2>
              <section className={styles.lessonReview} aria-label="Review selected lessons">
                {draft.lessons.map(lesson => <div key={lesson.id} className={styles.person}><SurfacePanel appearance="flat" tone="muted" style={{ width: '100%' }}>
                  <div><strong>{fullName(lessonStudent(draft, lesson))} · {lesson.service} · {lesson.instrument}</strong>
                    <p>{lesson.day} · {formatScheduleTime(lesson.time)}–{formatScheduleTime(lessonEndTime(lesson))} · {lesson.teacher}</p>
                    <p>{lesson.frequency === 'Monthly subscription' ? 'Weekly · Starts' : 'One lesson ·'} {formatScheduleDate(lesson.start, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                </SurfacePanel></div>)}
              </section>
              <div className={styles.priceSummary}>
                {[{ title: 'Due today', period: billing.current }, { title: formatScheduleDate(billing.nextDate, { month: 'long', day: 'numeric', year: 'numeric' }), period: billing.next }].filter((_, index) => !(singleSession || draft.lessons.length > 0 && draft.lessons.every(lesson => lesson.frequency === 'À-la-carte')) || index === 0).map(({ title, period }) => <section key={title} className={styles.pricePeriod}>
                  <div className={styles.priceHeading}><SectionTitle as="h3" variant="card">{title}</SectionTitle><strong>{money(period.total)}</strong></div>
                  {period.lines.length > 0 && <Disclosure summary="Lesson breakdown" style={{ ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.sm }}>{period.lines.map(({ lesson, dates, price, total }) => <div key={lesson.id} className={styles.priceLine} style={typography.bodySmall}>
                    <div><strong>{fullName(lessonStudent(draft, lesson))}</strong><span>{lesson.instrument} · {lesson.duration} min · {dates.length} {dates.length === 1 ? 'lesson' : 'lessons'}</span><span>{dates.map(date => formatScheduleDate(date)).join(', ')}</span><span>{dates.length} × {money(price.total)}{price.discount > 0 ? ' (teacher discount applied)' : ''}</span></div><strong>{money(total)}</strong>
                  </div>)}</Disclosure>}
                </section>)}
              </div>
              <div className={styles.payerRow}><Select label="Who will pay?" value={draft.payer} onChange={event => patch({ payer: event.target.value as EnrollmentDraft['payer'] })}><option value="student">{fullName(draft.student)}</option>{draft.manager && <option value="manager">{fullName(draft.manager)}</option>}{draft.otherPayer && <option value="other">{draft.otherPayer.name || 'Another payer'}</option>}</Select>{!draft.otherPayer && <Button type="button" variant="secondary" onClick={() => patch({ otherPayer: { name: '', email: '', phone: '' }, payer: 'other' })}><Plus size={15} aria-hidden="true" />Add another payer</Button>}</div>
              {draft.payer === 'other' && draft.otherPayer && <section className={styles.payerEditor}><div className={styles.sectionHeading}><SectionTitle as="h3" variant="card">Another payer</SectionTitle><Button type="button" variant="ghost" onClick={() => patch({ otherPayer: null, payer: draft.manager ? 'manager' : 'student' })}>Remove payer</Button></div><FieldGrid><Input label="Name or organization" error={error && !draft.otherPayer.name.trim() ? "Enter the payer’s name." : undefined} value={draft.otherPayer.name} onChange={event => patch({ otherPayer: { ...draft.otherPayer!, name: event.target.value } })} /><Input label="Email" error={error && draft.otherPayer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.otherPayer.email.trim()) ? "Enter a valid payer email address." : undefined} type="email" value={draft.otherPayer.email} onChange={event => patch({ otherPayer: { ...draft.otherPayer!, email: event.target.value } })} /><Input label="Phone" type="tel" value={draft.otherPayer.phone} onChange={event => patch({ otherPayer: { ...draft.otherPayer!, phone: event.target.value } })} /></FieldGrid></section>}
              <section className={styles.cardEntry} aria-label="Credit card">
                <SectionTitle as="h3" variant="card">Credit card</SectionTitle>
                <div className={styles.deferPayment}><Checkbox label="Add payment later" checked={draft.payment === 'later'} onChange={event => patch({ payment: event.target.checked ? 'later' : 'demo_card' })} /></div>
                {draft.payment === 'demo_card' && <EnrollmentCardPreview cardholder={fullName(draft.payer === 'manager' ? draft.manager : draft.payer === 'student' ? draft.student : null) || draft.otherPayer?.name || ''} />}
              </section>
            </>}
            {error && !contactFieldError && <p role="alert" className={styles.error}>{error}</p>}
            <div className={styles.formFooter}>{step > 0 ? <Button type="button" variant="ghost" onClick={() => move(step - 1)}><ArrowLeft size={15} aria-hidden="true" />Back</Button> : <span />}<Button type="submit" >{step === 3 ? singleSession || draft.lessons.length > 0 && draft.lessons.every(lesson => lesson.frequency === 'À-la-carte') ? 'Book single lesson' : 'Complete booking' : 'Continue'}{step < 3 && <ArrowRight size={15} aria-hidden="true" />}</Button></div>
          </form>

        </div>
      </>}
    </EnrollmentLayout>
  </main>
}
