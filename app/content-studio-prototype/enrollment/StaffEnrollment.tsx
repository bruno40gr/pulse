'use client'

import { useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { colors, typography } from '@/lib/tokens'
import {
  enrollmentPeople, enrollmentStepError, enrollmentStudents, ensureStudentLessons, lessonStudent, lessonPrice, newLesson, personDetailsError,
  newStaffEnrollment, saveLocalEnrollment, searchEnrollmentPeople,
  type EnrollmentPerson, type LessonChoice, type StaffEnrollment as EnrollmentDraft,
} from '@/lib/academy-staff-enrollment'
import styles from './enrollment.module.css'
import LessonSchedule from './LessonSchedule'
import { availableScheduleTeachers, formatScheduleDate } from '@/lib/academy-enrollment-schedule'
import { enrollmentBillingPreview } from '@/lib/academy-enrollment-pricing'

const steps = ['Family', 'Lessons', 'Times', 'Pricing', 'Payment']
const fullName = (person: EnrollmentPerson | null) => person ? `${person.firstName} ${person.lastName}` : ''
const money = (amount: number) => `$${(amount / 100).toFixed(2)}`

export function PersonPicker({ title, value, people, onChange, onAdd, studentLookup = false }: {
  title: string; value: EnrollmentPerson | null; people: readonly EnrollmentPerson[]
  onChange: (person: EnrollmentPerson | null) => void; onAdd: (person: EnrollmentPerson) => void
  studentLookup?: boolean
}) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(!value)
  const [finding, setFinding] = useState(false)
  const matches = searchEnrollmentPeople(query, people)

  function update(field: 'firstName' | 'lastName' | 'email' | 'phone', text: string) {
    onChange({ ...(value || { id: `local-${crypto.randomUUID()}`, firstName: '', lastName: '', email: '', phone: '', activeTeacher: false }), [field]: text })
  }

  return <section className={styles.personPicker}>
    {title && <h3>{title}</h3>}
    {studentLookup && <label className={styles.lookupToggle}><input type="checkbox" checked={finding} onChange={event => { setFinding(event.target.checked); setQuery('') }} />Enroll an existing student or lead</label>}
    {value && !creating && !finding ? <div className={styles.person}><div><strong>{fullName(value)}</strong>{value.email && <p>{value.email}</p>}{value.phone && <p>{value.phone}</p>}</div><div className={styles.personActions}><Button type="button" variant="ghost" onClick={() => setCreating(true)}>Edit</Button><Button type="button" variant="ghost" onClick={() => setFinding(true)}>Use an existing person</Button></div></div>
      : !finding ? <div onBlur={event => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        if (value && !personDetailsError(value)) { onAdd(value); setCreating(false) }
      }}>
        <div className={styles.fields}>
          <label>First name<input autoComplete="off" value={value?.firstName || ''} onChange={event => update('firstName', event.target.value)} /></label>
          <label>Last name<input autoComplete="off" value={value?.lastName || ''} onChange={event => update('lastName', event.target.value)} /></label>
          <label>Email<input type="email" autoComplete="off" value={value?.email || ''} onChange={event => update('email', event.target.value)} /></label>
          <label>Phone<input type="tel" autoComplete="off" value={value?.phone || ''} onChange={event => update('phone', event.target.value)} /></label>
        </div>
        {!studentLookup && <Button type="button" variant="ghost" onClick={() => setFinding(true)}>Use an existing person</Button>}
      </div> : <>
        <label>Find a person<input type="search" value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" /></label>
        {query.trim() && <div className={styles.results}>{matches.length ? matches.map(person => <button key={person.id} type="button" onClick={() => { onChange(person); setFinding(false); setCreating(false) }}><strong>{fullName(person)}</strong><span>{person.email}</span></button>) : <p>No people found.</p>}</div>}
        <Button type="button" variant="ghost" onClick={() => { setFinding(false); setCreating(true) }}>Enter details</Button>
      </>}
  </section>
}

export default function StaffEnrollment() {
  const [draft, setDraft] = useState(newStaffEnrollment)
  const [people, setPeople] = useState<readonly EnrollmentPerson[]>(enrollmentPeople)
  const [step, setStep] = useState(0)
  const [showManager, setShowManager] = useState(false)
  const [activeLessonId, setActiveLessonId] = useState('lesson-1')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<EnrollmentDraft | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const payerName = draft.payer === 'other' ? draft.otherPayer?.name || '' : fullName(draft.payer === 'manager' ? draft.manager : draft.student)
  const students = enrollmentStudents(draft)
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
  function submit(event: FormEvent) {
    event.preventDefault()
    const problem = enrollmentStepError(draft, step)
    if (problem) { setError(problem); return }
    if (step >= 2 && draft.lessons.some(lesson => !availableScheduleTeachers(lesson, lesson.start, lesson.time, lessonStudent(draft, lesson), draft.lessons.map(item => ({ ...item, studentId: item.studentId || draft.student?.id }))).some(teacher => teacher.name === lesson.teacher))) {
      setError('Choose an available time for each lesson.'); return
    }
    if (step === 0) {
      patch({ lessons: ensureStudentLessons(draft) })
      if (draft.student) addPerson(draft.student)
      if (draft.manager) addPerson(draft.manager)
      draft.additionalStudents.forEach(person => { if (person) addPerson(person) })
    }
    if (step === 1 && draft.lessons[0]) setActiveLessonId(draft.lessons[0].id)
    if (step < 4) { move(step + 1); return }
    try { setSaved(saveLocalEnrollment(draft)); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Please check the enrollment details.') }
  }
  function reset() {
    setDraft(newStaffEnrollment()); setSaved(null); setShowManager(false); setActiveLessonId('lesson-1'); move(0)
  }

  return <main className={styles.workspace} style={{ background: colors.background, color: colors.text, fontFamily: typography.fontSans }}>
    <header className={styles.header}><span className={styles.brand}>odeon</span><span className={styles.demo}>Local preview · changes stay on this page</span></header>
    <div className={styles.container}>
      <h1 ref={heading} tabIndex={-1}>{saved ? 'Enrollment saved' : 'Enroll a student'}</h1>
      {saved ? <section className={styles.saved}>
        <Check size={26} aria-hidden="true" /><h2>{fullName(saved.student)}</h2><p>Saved on this page</p>
        <dl><dt>Payer</dt><dd>{saved.payer === 'other' ? saved.otherPayer?.name : fullName(saved.payer === 'manager' ? saved.manager : saved.student)}</dd><dt>Payment</dt><dd>{saved.payment === 'demo_card' ? 'Test card selected' : 'To be added'}</dd><dt>Status</dt><dd>Draft</dd></dl>
        {saved.lessons.map(lesson => <div key={lesson.id} className={styles.savedLesson}><strong>{fullName(lessonStudent(saved, lesson))} · {lesson.instrument} with {lesson.teacher}</strong><p>{lesson.frequency} · {lesson.day} at {lesson.time} · {lesson.duration} minutes</p><p>{money(lessonPrice(lesson, lessonStudent(saved, lesson)).total)} per lesson</p></div>)}
        <Button onClick={reset}>Enroll another student</Button>
      </section> : <>
        <nav aria-label="Enrollment steps" className={styles.steps}>{steps.map((label, index) => <span key={label} aria-current={step === index ? 'step' : undefined} className={step === index ? styles.current : ''}><span>{index < step ? <Check size={13} aria-hidden="true" /> : index + 1}</span>{label}</span>)}</nav>
        <div className={`${styles.layout} ${step === 2 ? styles.scheduleLayout : ''}`}>
          <form onSubmit={submit} noValidate className={styles.card}>
            {step === 0 && <>
              <h2>Family details</h2>
              {showManager ? <><div className={styles.sectionHeading}><h3>Parent or guardian</h3><Button type="button" variant="ghost" aria-label="Remove parent or guardian" onClick={() => { setShowManager(false); patch({ manager: null, payer: 'student' }) }}><X size={16} /></Button></div><PersonPicker title="" value={draft.manager} people={people.filter(person => person.id !== draft.student?.id)} onChange={manager => patch({ manager, payer: manager ? 'manager' : 'student' })} onAdd={addPerson} /></>
                : <Button type="button" variant="secondary" onClick={() => setShowManager(true)}><Plus size={15} aria-hidden="true" />Add parent or guardian</Button>}
              <div className={styles.students}>
                <PersonPicker studentLookup title="Student 1" value={draft.student} people={people.filter(person => person.id !== draft.manager?.id)} onChange={student => patch({ student, lessons: draft.lessons.map(lesson => !lesson.studentId || lesson.studentId === draft.student?.id ? { ...lesson, studentId: student?.id, teacher: '', start: '', time: '' } : lesson) })} onAdd={addPerson} />
                {draft.additionalStudents.map((person, index) => <section key={index}>
                  <div className={styles.sectionHeading}><h3>Student {index + 2}</h3><Button type="button" variant="ghost" aria-label={`Remove student ${index + 2}`} onClick={() => patch({ additionalStudents: draft.additionalStudents.filter((_, item) => item !== index), lessons: draft.lessons.filter(lesson => !person || lesson.studentId !== person.id) })}><X size={16} /></Button></div>
                  <PersonPicker studentLookup title="" value={person} people={people.filter(item => item.id !== draft.manager?.id && !students.some(student => student.id === item.id && student.id !== person?.id))} onChange={value => patch({ additionalStudents: draft.additionalStudents.map((item, position) => position === index ? value : item), lessons: draft.lessons.map(lesson => person && lesson.studentId === person.id ? { ...lesson, studentId: value?.id || 'unassigned', teacher: '', time: '', start: '' } : lesson) })} onAdd={addPerson} />
                </section>)}
                <Button type="button" variant="secondary" onClick={() => patch({ additionalStudents: [...draft.additionalStudents, null] })}><Plus size={15} aria-hidden="true" />Add another student</Button>
              </div>
              {draft.student && <label className={styles.payer}>Who will pay?<select value={draft.payer} onChange={event => patch({ payer: event.target.value as EnrollmentDraft['payer'] })}><option value="student">{fullName(draft.student)}</option>{draft.manager && <option value="manager">{fullName(draft.manager)}</option>}{draft.otherPayer && <option value="other">{draft.otherPayer.name || 'Another payer'}</option>}</select></label>}
            </>}
            {(step === 1 || step === 2) && <><h2>{step === 1 ? 'Set up lessons' : 'Choose times'}</h2><div className={step === 2 ? styles.bookingLayout : undefined}><div className={styles.studentCards} aria-label="Student lessons">{draft.lessons.map((lesson, index) => <section key={lesson.id} className={`${styles.studentCard} ${activeLesson.id === lesson.id ? styles.selectedCard : ''}`} onFocus={() => setActiveLessonId(lesson.id)} onClick={() => setActiveLessonId(lesson.id)}>
              <div className={styles.sectionHeading}><button type="button" className={styles.cardSelect} aria-pressed={activeLesson.id === lesson.id} onClick={() => setActiveLessonId(lesson.id)}>{fullName(lessonStudent(draft, lesson)) || 'Choose a student'}</button>{step === 1 && draft.lessons.filter(item => lessonStudent(draft, item)?.id === lessonStudent(draft, lesson)?.id).length > 1 && <Button type="button" variant="ghost" aria-label={`Remove lesson ${index + 1}`} onClick={event => { event.stopPropagation(); patch({ lessons: draft.lessons.filter(item => item.id !== lesson.id) }) }}><X size={16} /></Button>}</div>
              {step === 1 ? <div className={styles.fields}>
                {lesson.addedLesson && students.length > 1 && <label>Student<select value={lesson.studentId || ''} onChange={event => updateLesson(lesson.id, { studentId: event.target.value, teacher: '', start: '', time: '' })}><option value="">Choose a student</option>{students.map(person => <option key={person.id} value={person.id}>{fullName(person)}</option>)}</select></label>}
                <label>Instrument<select value={lesson.instrument} onChange={event => updateLesson(lesson.id, { instrument: event.target.value, teacher: '', time: '', start: '' })}>{['Piano', 'Guitar', 'Voice', 'Drums', 'Violin'].map(value => <option key={value}>{value}</option>)}</select></label>
                <label>Length<select value={lesson.duration} onChange={event => updateLesson(lesson.id, { duration: event.target.value, teacher: '', time: '', start: '' })}><option value="30">30 minutes</option><option value="60">60 minutes</option></select></label>
                <label>Cadence<select value={lesson.frequency} onChange={event => updateLesson(lesson.id, { frequency: event.target.value })}><option value="Monthly subscription">Weekly</option><option value="À-la-carte">One lesson</option></select></label>
              </div> : <p>{lesson.instrument} · {lesson.frequency === 'Monthly subscription' ? 'Weekly' : 'One lesson'} · {lesson.duration} minutes</p>}
            </section>)}{step === 1 && <Button type="button" variant="secondary" onClick={() => { const id = crypto.randomUUID(); const nextStudent = students.length === 1 ? students[0] : null; patch({ lessons: [...draft.lessons, { ...newLesson(id), studentId: nextStudent?.id || '', addedLesson: true }] }); setActiveLessonId(id) }}><Plus size={15} aria-hidden="true" />Add another lesson</Button>}</div>
              {step === 2 && activeLesson && <LessonSchedule key={`${activeLesson.id}-${activeLesson.instrument}-${activeLesson.duration}-${activeLesson.studentId}`} lesson={activeLesson} lessons={draft.lessons.map(lesson => ({ ...lesson, studentId: lesson.studentId || draft.student?.id }))} student={lessonStudent(draft, activeLesson)} students={students} manager={draft.manager} onSelectLesson={setActiveLessonId} onChange={value => updateLesson(activeLesson.id, value)} />}
            </div></>}
            {step === 3 && <><h2>Review pricing</h2><p className={styles.payerLine}>Billing preview · {formatScheduleDate(billing.today, { month: 'long', day: 'numeric', year: 'numeric' })}</p><p>Billed monthly on the 1st for the lessons scheduled that month.</p>{[{ title: 'Due today', period: billing.current }, { title: `Due on ${formatScheduleDate(billing.nextDate, { month: 'long', day: 'numeric', year: 'numeric' })}`, period: billing.next }].map(({ title, period }) => <section key={title} className={styles.lesson}><h3>{title}</h3>{period.lines.map(({ lesson, dates, price, total }) => <div key={lesson.id} className={styles.billingLine}><strong>{fullName(lessonStudent(draft, lesson))} · {lesson.instrument} · {lesson.duration} minutes</strong><p>{dates.length} {formatScheduleDate(dates[0], { weekday: 'long' })}{dates.length === 1 ? '' : 's'} · {dates.map(date => formatScheduleDate(date)).join(', ')}</p><p>{lesson.frequency === 'Monthly subscription' ? 'Monthly subscription' : 'One lesson'} · {money(price.base)} per lesson{price.discount > 0 ? ` − ${money(price.discount)} teacher discount = ${money(price.total)}` : ''}</p><p>{dates.length} × {money(price.total)} = <strong>{money(total)}</strong></p></div>)}{period.lines.length === 0 && <p>No lessons to bill.</p>}<dl><dt className={styles.total}>{title}</dt><dd className={styles.total}>{money(period.total)}</dd></dl></section>)}<p className={styles.payerLine}>Paid by {payerName}</p></>}
            {step === 4 && <><h2>Payment</h2><label>Who will pay?<select value={draft.payer} onChange={event => patch({ payer: event.target.value as EnrollmentDraft['payer'] })}><option value="student">{fullName(draft.student)}</option>{draft.manager && <option value="manager">{fullName(draft.manager)}</option>}{draft.otherPayer && <option value="other">{draft.otherPayer.name || 'Another payer'}</option>}</select></label>{draft.otherPayer ? <section className={styles.payerEditor}><div className={styles.sectionHeading}><h3>Another payer</h3><Button type="button" variant="ghost" onClick={() => patch({ otherPayer: null, payer: draft.payer === 'other' ? 'student' : draft.payer })}>Remove payer</Button></div><div className={styles.fields}><label>Name or organization<input value={draft.otherPayer.name} onChange={event => patch({ otherPayer: { ...draft.otherPayer!, name: event.target.value } })} /></label><label>Email<input type="email" value={draft.otherPayer.email} onChange={event => patch({ otherPayer: { ...draft.otherPayer!, email: event.target.value } })} /></label><label>Phone<input type="tel" value={draft.otherPayer.phone} onChange={event => patch({ otherPayer: { ...draft.otherPayer!, phone: event.target.value } })} /></label></div></section> : <Button type="button" variant="secondary" onClick={() => patch({ otherPayer: { name: '', email: '', phone: '' }, payer: 'other' })}><Plus size={15} aria-hidden="true" />Add another payer</Button>}<div className={styles.paymentOptions}>
              <label><input type="radio" name="payment" checked={draft.payment === 'later'} onChange={() => patch({ payment: 'later' })} />Add payment later</label>
              <label><input type="radio" name="payment" checked={draft.payment === 'demo_card'} onChange={() => patch({ payment: 'demo_card' })} />Use a test card</label>
            </div></>}
            {error && <p role="alert" className={styles.error}>{error}</p>}
            <div className={styles.formFooter}>{step > 0 ? <Button type="button" variant="ghost" onClick={() => move(step - 1)}><ArrowLeft size={15} aria-hidden="true" />Back</Button> : <span />}<Button type="submit">{step === 4 ? 'Save draft' : 'Continue'}{step < 4 && <ArrowRight size={15} aria-hidden="true" />}</Button></div>
          </form>
          <aside className={styles.summary} aria-label="Enrollment summary"><h2>Enrollment</h2>{draft.manager && <p>{fullName(draft.manager)} · Parent / guardian</p>}{students.map(person => <p key={person.id}><strong>{fullName(person)}</strong></p>)}{draft.lessons.map(lesson => <div key={lesson.id}><strong>{fullName(lessonStudent(draft, lesson))} · {lesson.instrument} · {lesson.duration} min</strong>{lesson.teacher && <p>{lesson.teacher}</p>}{lesson.start && <p>{lesson.start}</p>}{lesson.time && <p>{lesson.day} · {lesson.time}</p>}<p>{lesson.frequency}</p>{step >= 3 && <p>{money(lessonPrice(lesson, lessonStudent(draft, lesson)).total)} per lesson</p>}</div>)}</aside>
        </div>
      </>}
    </div>
  </main>
}