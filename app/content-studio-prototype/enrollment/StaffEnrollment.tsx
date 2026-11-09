'use client'

import { Select } from '@/components/ui/Select'
import { scheduleTeachers } from '@/lib/academy-enrollment-schedule'
import { SectionTitle } from '@/components/ui/SectionTitle'

import { useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, X } from 'lucide-react'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { SurfacePanel } from '@/components/ui/SurfacePanel'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Notice } from '@/components/ui/Notice'
import { Disclosure } from '@/components/ui/Disclosure'
import { enrollmentSteps as steps } from '@/lib/academy-staff-enrollment'
import type { EnrollmentDraftRecord } from '@/lib/academy-enrollment-drafts'
import { colors, spacing, typography } from '@/lib/tokens'
import {
  enrollmentServices, enrollmentInstruments, enrollmentGroupPrograms, enrollmentPeople, enrollmentStepError, enrollmentStudents, ensureStudentLessons, lessonStudent, lessonPrice, newLesson, personDetailsError,
  newStaffEnrollment, saveLocalEnrollment, searchEnrollmentPeople,
  type EnrollmentPerson, type LessonChoice, type StaffEnrollment as EnrollmentDraft,
} from '@/lib/academy-staff-enrollment'
import styles from './enrollment.module.css'
import LessonSchedule from './LessonSchedule'
import { availableScheduleTeachers, formatScheduleDate, formatScheduleTime } from '@/lib/academy-enrollment-schedule'
import { enrollmentBillingPreview } from '@/lib/academy-enrollment-pricing'

const fullName = (person: EnrollmentPerson | null) => person ? `${person.firstName} ${person.lastName}` : ''
const money = (amount: number) => `$${(amount / 100).toFixed(2)}`

const lessonEndTime = (lesson: LessonChoice) => {
  const minutes = Number(lesson.time.slice(0, 2)) * 60 + Number(lesson.time.slice(3)) + Number(lesson.duration)
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function PersonPicker({ title, value, people, onChange, onAdd, studentLookup = true, relationship, onRelationship, relationshipLabel = 'Relationship to contact' }: {
  title: string; value: EnrollmentPerson | null; people: readonly EnrollmentPerson[]
  onChange: (person: EnrollmentPerson | null) => void; onAdd: (person: EnrollmentPerson) => void
  studentLookup?: boolean
  relationship?: string; onRelationship?: (relationship: string) => void; relationshipLabel?: string
}) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(!value)
  const [finding, setFinding] = useState(false)
  const matches = searchEnrollmentPeople(query, people)

  function update(field: 'firstName' | 'lastName' | 'email' | 'phone' | 'birthday', text: string) {
    onChange({ ...(value || { id: `local-${crypto.randomUUID()}`, firstName: '', lastName: '', email: '', phone: '', activeTeacher: false }), [field]: text })
  }

  return <section className={styles.personPicker}>
    {title && <SectionTitle as="h3" variant="card">{title}</SectionTitle>}
    {studentLookup && (creating || finding || !value) && <label className={styles.lookupToggle}><input type="checkbox" checked={finding} onChange={event => { setFinding(event.target.checked); setQuery('') }} />Enroll an existing student or lead</label>}
    {value && !creating && !finding ? <div className={styles.person}><SurfacePanel appearance="flat" tone="muted" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, width: '100%' }}><div><strong>{fullName(value)}</strong>{value.email && <p>{value.email}</p>}{value.phone && <p>{value.phone}</p>}{value.birthday && <p>Birthday · {formatScheduleDate(value.birthday, { month: 'short', day: 'numeric', year: 'numeric' })}</p>}{onRelationship && <p>{relationshipLabel} · {relationship || 'Not specified'}</p>}</div><div className={styles.personActions}><Button type="button" variant="ghost" onClick={() => setCreating(true)}>Edit</Button></div></SurfacePanel></div>
      : !finding ? <div onBlur={event => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        // Collapsing fields during pointer-down moves the footer before its click.
        // Keep the editor stable while an action button receives focus.
        if (typeof HTMLElement !== 'undefined' && event.relatedTarget instanceof HTMLElement && event.relatedTarget.closest('button')) return
        if (value && !personDetailsError(value)) { onAdd(value); setCreating(false) }
      }}>
        <FieldGrid>
          <label>First name<input autoComplete="off" value={value?.firstName || ''} onChange={event => update('firstName', event.target.value)} /></label>
          <label>Last name<input autoComplete="off" value={value?.lastName || ''} onChange={event => update('lastName', event.target.value)} /></label>
          <label>Email<input type="email" autoComplete="off" value={value?.email || ''} onChange={event => update('email', event.target.value)} /></label>
          <label>Phone<input type="tel" autoComplete="off" value={value?.phone || ''} onChange={event => update('phone', event.target.value)} /></label>
          <label>Birthday<input type="date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} value={value?.birthday || ''} onChange={event => update('birthday', event.target.value)} /></label>
          {onRelationship && <label>{relationshipLabel}<select aria-label={relationshipLabel} value={relationship || ''} onChange={event => onRelationship(event.target.value)}><option value="">Choose relationship</option>{['Self', 'Child', 'Grandchild', 'Sibling', 'Other'].map(value => <option key={value}>{value}</option>)}</select></label>}
        </FieldGrid>
      </div> : <>
        <label>Find a person<input type="search" value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" /></label>
        {query.trim() && <div className={styles.results}>{matches.length ? matches.map(person => <button key={person.id} type="button" onClick={() => { onChange(person); setFinding(false); setCreating(false) }}><strong>{fullName(person)}</strong><span>{person.email}</span></button>) : <p>No people found.</p>}</div>}
        <Button type="button" variant="ghost" onClick={() => { setFinding(false); setCreating(true) }}>Enter details</Button>
      </>}
  </section>
}

export default function StaffEnrollment({ initialRecord, onSaveAndClose, onClose }: {
  initialRecord?: EnrollmentDraftRecord
  onSaveAndClose?: (draft: EnrollmentDraft, step: number, reviewedSteps: number[]) => void
  onClose?: () => void
} = {}) {
  const [draft, setDraft] = useState(() => initialRecord ? structuredClone(initialRecord.draft) : newStaffEnrollment())
  const [people, setPeople] = useState<readonly EnrollmentPerson[]>(enrollmentPeople)
  const [step, setStep] = useState(() => {
    if (!initialRecord) return 0
    // Saved choices are proposals, not reservations. Recheck before resuming
    // beyond scheduling, and return to the earliest now-invalid prerequisite.
    for (let index = 0; index < initialRecord.step; index++) {
      if (enrollmentStepError(initialRecord.draft, index)) return index
      if (index === 2 && initialRecord.draft.lessons.some(lesson => !availableScheduleTeachers(lesson, lesson.start, lesson.time, lessonStudent(initialRecord.draft, lesson), initialRecord.draft.lessons.map(item => ({ ...item, studentId: item.studentId || initialRecord.draft.student?.id }))).some(teacher => teacher.name === lesson.teacher))) return 2
    }
    return initialRecord.step
  })
  const [teacherPreferences, setTeacherPreferences] = useState<Record<string, string>>({})
  const [activeLessonId, setActiveLessonId] = useState('lesson-1')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<EnrollmentDraft | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [reviewedSteps, setReviewedSteps] = useState<number[]>(initialRecord?.reviewedSteps || [])
  const [baseline, setBaseline] = useState(() => JSON.stringify(initialRecord?.draft || newStaffEnrollment()))
  const dirty = JSON.stringify(draft) !== baseline
  const students = enrollmentStudents(draft)
  const lessonStudents = [...new Map([...students, ...(draft.contact ? [draft.contact] : [])].map(person => [person.id, person])).values()]
  const billing = enrollmentBillingPreview(draft)
  const activeLesson = draft.lessons.find(lesson => lesson.id === activeLessonId) || draft.lessons[0]
  const patch = (value: Partial<EnrollmentDraft>) => setDraft(current => ({ ...current, ...value }))
  const addPerson = (person: EnrollmentPerson) => setPeople(current => [...current.filter(item => item.id !== person.id), { ...person }])
  const updateLesson = (id: string, value: Partial<LessonChoice>) => setDraft(current => ({ ...current, lessons: current.lessons.map(lesson => lesson.id === id ? { ...lesson, ...value } : lesson) }))

  function move(next: number) {
    setError('')
    setStep(next)
    heading.current?.focus()
  }
  function jumpToStep(next: number) {
    if (next <= step) { move(next); return }
    const prepared = { ...draft, lessons: ensureStudentLessons(draft) }
    for (let index = 0; index < next; index++) {
      const problem = enrollmentStepError(prepared, index)
      if (problem) { setDraft(prepared); move(index); setError(problem); return }
      if (index === 2 && prepared.lessons.some(lesson => !availableScheduleTeachers(lesson, lesson.start, lesson.time, lessonStudent(prepared, lesson), prepared.lessons).some(teacher => teacher.name === lesson.teacher))) { move(2); setError('Choose an available time for each lesson.'); return }
    }
    setDraft(prepared)
    setReviewedSteps(current => [...new Set([...current, ...Array.from({ length: next }, (_, index) => index)])])
    move(next)
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    const problem = enrollmentStepError(draft, step)
    if (problem) { setError(problem); return }
    if (step >= 2 && draft.lessons.some(lesson => !availableScheduleTeachers(lesson, lesson.start, lesson.time, lessonStudent(draft, lesson), draft.lessons.map(item => ({ ...item, studentId: item.studentId || draft.student?.id }))).some(teacher => teacher.name === lesson.teacher))) {
      setError('Choose an available time for each lesson.'); return
    }
    if (step === 0) {
      const next = { ...draft, lessons: ensureStudentLessons(draft) }
      setDraft(next)
      // Automatically generated lesson rows are navigation, not a staff edit.
      if (!dirty) setBaseline(JSON.stringify(next))
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
      try { onSaveAndClose(saveLocalEnrollment(draft), step, reviewed) }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Please check the enrollment details.') }
      return
    }
    try { setSaved(saveLocalEnrollment(draft)); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Please check the enrollment details.') }
  }
  function reset() {
    setDraft(newStaffEnrollment()); setSaved(null); setActiveLessonId('lesson-1'); move(0)
  }

  return <main className={styles.workspace} style={{ background: colors.background, color: colors.text, fontFamily: typography.fontSans }}>
    {!onSaveAndClose && <header className={styles.header}><span className={styles.brand}>odeon</span><span className={styles.demo}>Local preview · changes stay on this page</span></header>}
    <div className={styles.container}>
      {onSaveAndClose ? <PageHeader title="Enroll a student" subtitle="Draft only · proposed times are not reserved." right={<Button type="button" variant="secondary" onClick={() => { if (!dirty && onClose) onClose(); else onSaveAndClose(draft, step, reviewedSteps) }}>{dirty ? 'Save & close' : 'Close'}</Button>} /> : <h1 ref={heading} tabIndex={-1}>{saved ? 'Enrollment saved' : 'Enroll a student'}</h1>}
      {initialRecord?.preferences?.some(item => item.interest || item.availability?.preferredDays || item.availability?.preferredTimes) && <Notice title="From the inquiry">
        {initialRecord.preferences.map(item => <p key={item.studentId}>{item.name}: {[item.interest, item.availability?.preferredDays, item.availability?.preferredTimes, item.availability?.preferredDate, item.availability?.timeWindow].filter(Boolean).join(' · ') || 'No preferences recorded'}</p>)}
      </Notice>}
      {saved ? <section className={styles.saved}>
        <Check size={26} aria-hidden="true" /><h2>{fullName(saved.student)}</h2><p>Saved on this page</p>
        <dl><dt>Payer</dt><dd>{saved.payer === 'other' ? saved.otherPayer?.name : fullName(saved.payer === 'manager' ? saved.manager : saved.student)}</dd><dt>Payment</dt><dd>{saved.payment === 'demo_card' ? 'Test card selected' : 'To be added'}</dd><dt>Status</dt><dd>Draft</dd></dl>
        {saved.lessons.map(lesson => <div key={lesson.id} className={styles.savedLesson}><strong>{fullName(lessonStudent(saved, lesson))} · {lesson.instrument} with {lesson.teacher}</strong><p>{lesson.frequency} · {lesson.day} at {lesson.time} · {lesson.duration} minutes</p><p>{money(lessonPrice(lesson, lessonStudent(saved, lesson)).total)} per lesson</p></div>)}
        <Button onClick={reset}>Enroll another student</Button>
      </section> : <>
        <nav aria-label="Enrollment steps" className={styles.steps}>{steps.map((label, index) => <button type="button" onClick={() => jumpToStep(index)} key={label} aria-current={step === index ? 'step' : undefined} className={step === index ? styles.current : ''}><span>{index < step ? <Check size={13} aria-hidden="true" /> : index + 1}</span>{label}</button>)}</nav>
        <div className={`${styles.layout} ${step === 2 ? styles.scheduleLayout : ''}`}>
          <form onSubmit={submit} noValidate className={styles.card}>
            {step === 0 && <>
              <h2>Contact details</h2>
              <PersonPicker studentLookup title="" value={draft.contact} people={people} onAdd={addPerson} onChange={contact => patch({ contact, manager: draft.contactIsStudent ? null : contact, student: draft.contactIsStudent ? contact : draft.student, consent: { termsAccepted: false, serviceSms: false }, lessons: draft.lessons.map(lesson => draft.contactIsStudent && lesson.studentId === draft.contact?.id ? { ...lesson, studentId: contact?.id, teacher: '', start: '', time: '' } : lesson) })} />
              <div className={styles.students}>
                <DenseSectionPanel title="Student 1" actions={<Button type="button" variant="secondary" size="sm" onClick={() => patch({ additionalStudents: [...draft.additionalStudents, null] })}><Plus size={15} aria-hidden="true" />Add another student</Button>}>
                  <label className={styles.selfToggle}><input type="checkbox" checked={draft.contactIsStudent} onChange={event => { const self = event.target.checked; patch({ contactIsStudent: self, student: self ? draft.contact : null, manager: self ? null : draft.contact, payer: self ? 'student' : 'manager', studentRelationships: self && draft.contact ? { ...draft.studentRelationships, [draft.contact.id]: 'Self' } : draft.studentRelationships, lessons: draft.lessons.filter(lesson => lesson.studentId !== draft.student?.id) }) }} />Classes are for this person</label>
                  {!draft.contactIsStudent && <PersonPicker studentLookup relationshipLabel="Student 1 relationship to contact" relationship={draft.studentRelationships[draft.student?.id || ''] || ''} onRelationship={value => { if (draft.student) patch({ studentRelationships: { ...draft.studentRelationships, [draft.student.id]: value } }) }} title="" value={draft.student} people={people.filter(person => person.id !== draft.contact?.id && !draft.additionalStudents.some(student => student?.id === person.id))} onChange={student => patch({ student, lessons: draft.lessons.map(lesson => !lesson.studentId || lesson.studentId === draft.student?.id ? { ...lesson, studentId: student?.id, teacher: '', start: '', time: '' } : lesson) })} onAdd={addPerson} />}
                </DenseSectionPanel>
                {draft.additionalStudents.map((person, index) => <DenseSectionPanel key={index} title={`Student ${index + 2}`} actions={<Button type="button" variant="ghost" aria-label={`Remove student ${index + 2}`} onClick={() => patch({ additionalStudents: draft.additionalStudents.filter((_, item) => item !== index), lessons: draft.lessons.filter(lesson => !person || lesson.studentId !== person.id) })}><X size={16} /></Button>}>
                  <PersonPicker studentLookup relationshipLabel={`Student ${index + 2} relationship to contact`} relationship={draft.studentRelationships[person?.id || ''] || ''} onRelationship={value => { if (person) patch({ studentRelationships: { ...draft.studentRelationships, [person.id]: value } }) }} title="" value={person} people={people.filter(item => item.id !== draft.contact?.id && !students.some(student => student.id === item.id && student.id !== person?.id))} onChange={value => patch({ additionalStudents: draft.additionalStudents.map((item, position) => position === index ? value : item), lessons: draft.lessons.map(lesson => person && lesson.studentId === person.id ? { ...lesson, studentId: value?.id || 'unassigned', teacher: '', time: '', start: '' } : lesson) })} onAdd={addPerson} />
                </DenseSectionPanel>)}
              </div>
            </>}
            {(step === 1 || step === 2) && <><h2>{step === 1 ? 'Set up lessons' : 'Choose times'}</h2><div className={step === 2 ? styles.bookingLayout : undefined}><div className={styles.studentCards} role="region" tabIndex={step === 2 ? 0 : undefined} aria-label="Student lessons">{draft.lessons.map((lesson, index) => <section key={lesson.id} className={`${styles.studentCard} ${activeLesson.id === lesson.id ? styles.selectedCard : ''}`} onFocus={() => setActiveLessonId(lesson.id)} onClick={() => setActiveLessonId(lesson.id)}>
              <div className={styles.sectionHeading}><button type="button" className={styles.cardSelect} aria-pressed={activeLesson.id === lesson.id} onClick={() => setActiveLessonId(lesson.id)}>{fullName(lessonStudent(draft, lesson)) || 'Choose a student'}</button>{<Button type="button" variant="ghost" className={styles.lessonDelete} size="sm" title="Remove lesson" aria-label={`Remove lesson ${index + 1}`} onClick={event => { event.stopPropagation(); if (!window.confirm(`Remove ${lesson.instrument} for ${fullName(lessonStudent(draft, lesson))}? This removes the lesson and its selected time from this enrollment draft and cannot be undone. Existing family bookings are not affected. If this is the student’s only lesson, you will return to lesson setup.`)) return; const remaining = draft.lessons.filter(item => item.id !== lesson.id); patch({ lessons: remaining }); setActiveLessonId(remaining[0]?.id || ''); if (step === 2 && !remaining.some(item => lessonStudent(draft, item)?.id === lessonStudent(draft, lesson)?.id)) move(1) }}><Trash2 size={16} aria-hidden="true" /></Button>}</div>
              {step === 1 ? <FieldGrid>
                {lesson.addedLesson && <label>Student<select value={lesson.studentId || ''} onChange={event => updateLesson(lesson.id, { studentId: event.target.value, teacher: '', start: '', time: '' })}><option value="">Choose a student</option>{lessonStudents.map(person => <option key={person.id} value={person.id}>{fullName(person)}</option>)}</select></label>}
                <label>Service<select value={lesson.service} onChange={event => { const service = event.target.value as LessonChoice['service']; updateLesson(lesson.id, { service, instrument: service === 'Group' ? 'Tiny Keys' : 'Piano', duration: service === 'Group' || service === 'Semi-private' ? '45' : '30', teacher: '', time: '', start: '' }) }}>{enrollmentServices.map(value => <option key={value}>{value}</option>)}</select></label>
                <label>Program<select value={lesson.instrument} onChange={event => updateLesson(lesson.id, { instrument: event.target.value, ...(lesson.service === 'Group' ? { duration: event.target.value === 'Band Program' ? '60' : '45' } : {}), teacher: '', time: '', start: '' })}><option value="">Choose a program</option>{(lesson.service === 'Group' ? enrollmentGroupPrograms : enrollmentInstruments).map(value => <option key={value}>{value}</option>)}</select></label>
                <label>Length<select disabled={lesson.service === 'Group'} value={lesson.duration} onChange={event => updateLesson(lesson.id, { duration: event.target.value, teacher: '', time: '', start: '' })}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label>
                <label>Cadence<select value={lesson.frequency} onChange={event => updateLesson(lesson.id, { frequency: event.target.value })}><option value="Monthly subscription">Weekly</option><option value="À-la-carte">One lesson</option></select></label>
              </FieldGrid> : <p>{lesson.service} · {lesson.instrument} · {lesson.frequency === 'Monthly subscription' ? 'Weekly' : 'One lesson'} · {lesson.duration} minutes</p>}
              {step === 2 && <Select label="Teacher preference" value={teacherPreferences[lesson.id] || ''} onChange={event => setTeacherPreferences(current => ({ ...current, [lesson.id]: event.target.value }))}><option value="">Any suitable teacher</option>{scheduleTeachers.filter(teacher => teacher.instruments.some(instrument => instrument === lesson.instrument)).map(teacher => <option key={teacher.name}>{teacher.name}</option>)}</Select>}
              {step === 2 && <p className={styles.lessonStatus}>{lesson.teacher && lesson.start && lesson.time ? <><span><Check className={styles.bookingCheck} size={13} aria-label="Time selected" />{formatScheduleDate(lesson.start, { weekday: 'short', month: 'short', day: 'numeric' })} · {formatScheduleTime(lesson.time)}–{formatScheduleTime(lessonEndTime(lesson))}</span></> : <span>Choose a time</span>}</p>}
            </section>)}</div>{step === 1 && <Button className={styles.addLesson} type="button" variant="secondary" onClick={() => { const id = crypto.randomUUID(); const nextStudent = lessonStudents.length === 1 ? lessonStudents[0] : null; patch({ lessons: [...draft.lessons, { ...newLesson(id), studentId: nextStudent?.id || '', addedLesson: true }] }); setActiveLessonId(id) }}><Plus size={15} aria-hidden="true" />Add another lesson</Button>}
              {step === 2 && activeLesson && <LessonSchedule teacherPreference={teacherPreferences[activeLesson.id]} key={`${activeLesson.id}-${activeLesson.instrument}-${activeLesson.duration}-${activeLesson.studentId}`} lesson={activeLesson} lessons={draft.lessons.map(lesson => ({ ...lesson, studentId: lesson.studentId || draft.student?.id }))} student={lessonStudent(draft, activeLesson)} students={students} manager={draft.manager} onSelectLesson={setActiveLessonId} onChange={value => updateLesson(activeLesson.id, value)} />}
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
                {[{ title: 'Due today', period: billing.current }, { title: formatScheduleDate(billing.nextDate, { month: 'long', day: 'numeric', year: 'numeric' }), period: billing.next }].map(({ title, period }) => <section key={title} className={styles.pricePeriod}>
                  <div className={styles.priceHeading}><SectionTitle as="h3" variant="card">{title}</SectionTitle><strong>{money(period.total)}</strong></div>
                  {period.lines.length > 0 && <Disclosure summary="Lesson breakdown" style={{ ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.sm }}>{period.lines.map(({ lesson, dates, price, total }) => <div key={lesson.id} className={styles.priceLine} style={typography.bodySmall}>
                    <div><strong>{fullName(lessonStudent(draft, lesson))}</strong><span>{lesson.instrument} · {lesson.duration} min · {dates.length} {dates.length === 1 ? 'lesson' : 'lessons'}</span><span>{dates.map(date => formatScheduleDate(date)).join(', ')}</span><span>{dates.length} × {money(price.total)}{price.discount > 0 ? ' (teacher discount applied)' : ''}</span></div><strong>{money(total)}</strong>
                  </div>)}</Disclosure>}
                </section>)}
              </div>
              <div className={styles.payerRow}><label>Who will pay?<select value={draft.payer} onChange={event => patch({ payer: event.target.value as EnrollmentDraft['payer'] })}><option value="student">{fullName(draft.student)}</option>{draft.manager && <option value="manager">{fullName(draft.manager)}</option>}{draft.otherPayer && <option value="other">{draft.otherPayer.name || 'Another payer'}</option>}</select></label>{!draft.otherPayer && <Button type="button" variant="secondary" onClick={() => patch({ otherPayer: { name: '', email: '', phone: '' }, payer: 'other' })}><Plus size={15} aria-hidden="true" />Add another payer</Button>}</div>
              {draft.payer === 'other' && draft.otherPayer && <section className={styles.payerEditor}><div className={styles.sectionHeading}><SectionTitle as="h3" variant="card">Another payer</SectionTitle><Button type="button" variant="ghost" onClick={() => patch({ otherPayer: null, payer: draft.manager ? 'manager' : 'student' })}>Remove payer</Button></div><FieldGrid><label>Name or organization<input value={draft.otherPayer.name} onChange={event => patch({ otherPayer: { ...draft.otherPayer!, name: event.target.value } })} /></label><label>Email<input type="email" value={draft.otherPayer.email} onChange={event => patch({ otherPayer: { ...draft.otherPayer!, email: event.target.value } })} /></label><label>Phone<input type="tel" value={draft.otherPayer.phone} onChange={event => patch({ otherPayer: { ...draft.otherPayer!, phone: event.target.value } })} /></label></FieldGrid></section>}
              <section className={styles.cardEntry} aria-label="Credit card">
                <SectionTitle as="h3" variant="card">Credit card</SectionTitle>
                <label className={`${styles.consentChoice} ${styles.deferPayment}`}><input type="checkbox" checked={draft.payment === 'later'} onChange={event => patch({ payment: event.target.checked ? 'later' : 'demo_card' })} />Add payment later</label>
                {draft.payment === 'demo_card' && <div className={styles.fields} aria-label="Credit card preview"><label>Cardholder name<input readOnly value={fullName(draft.payer === 'manager' ? draft.manager : draft.payer === 'student' ? draft.student : null) || draft.otherPayer?.name || ''} /></label><label>Card number<input readOnly value="4242 4242 4242 4242" /></label><label>Expiration<input readOnly value="12 / 30" /></label><label>Security code<input readOnly value="123" /></label></div>}
              </section>
            </>}
            {error && <p role="alert" className={styles.error}>{error}</p>}
            <div className={styles.formFooter}>{step > 0 ? <Button type="button" variant="ghost" onClick={() => move(step - 1)}><ArrowLeft size={15} aria-hidden="true" />Back</Button> : <span />}<Button type="submit" >{step === 3 ? 'Save draft' : 'Continue'}{step < 3 && <ArrowRight size={15} aria-hidden="true" />}</Button></div>
          </form>

        </div>
      </>}
    </div>
  </main>
}