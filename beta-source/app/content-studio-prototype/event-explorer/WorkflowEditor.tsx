'use client'

import { ParticipantPicker } from '@/components/contacts/ParticipantPicker'
import { ParticipationPolicies } from '@/components/ui/ParticipationPolicies'

import { useCallback, useState } from 'react'
import { EnrollmentLayout } from '@/components/ui/EnrollmentLayout'
import { spacing } from '@/lib/tokens'
import { Button } from '@/components/ui/Button'
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react'
import { SurfacePanel } from '@/components/ui/SurfacePanel'
import enrollmentStyles from '../enrollment/enrollment.module.css'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { RadioOptionGroup } from '@/components/ui/RadioOptionGroup'
import { Switch } from '@/components/ui/Switch'
import { WeekdayToggleGroup } from '@/components/ui/WeekdayToggleGroup'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { Checkbox } from '@/components/ui/Checkbox'
import { Notice } from '@/components/ui/Notice'
import { EmptyState } from '@/components/ui/EmptyState'
import { ResponsiveDataTable } from '@/components/ui/DataGridTable'
import { PersonName } from '@/components/ui/PersonName'
import type { SetupRecord } from '../school-setup/setup-content'
import { completeEnrollmentDraft } from '@/beta-source/lib/academy-enrollment-drafts'
import StaffEnrollment from '../enrollment/StaffEnrollment'
import EventFields from './EventFields'
import EventReview from './EventReview'
import ProgramFields, { type ProgramActions } from './ProgramFields'
import { resumableWorkflowStep, workflowLabels, workflowName, workflowStepError, workflowSteps, type WorkflowContext, type WorkflowDraft } from '@/beta-source/lib/academy-workflow-drafts'
import styles from './explorer.module.css'
import { eventQuestions, eventHasMultipleSessions, eventRegistrationActivity, eventAlreadyRegistered, activitySpace, eventPaymentTiming } from '@/beta-source/lib/event-explorer'
import type { StaffEnrollment as EnrollmentData } from '@/beta-source/lib/academy-staff-enrollment'

export default function WorkflowEditor({ initial, context, staff, onSave, onUpdate, onComplete, onCreate, programActions, locations = [], availablePeople, academyTeachers, availability }: {
  availablePeople?: readonly import('@/beta-source/lib/academy-staff-enrollment').EnrollmentPerson[];
  academyTeachers?: readonly { name: string; instruments: string[] }[];
  availability?: (date: string, time: string, lesson: import('@/beta-source/lib/academy-staff-enrollment').LessonChoice, siblings?: readonly import('@/beta-source/lib/academy-staff-enrollment').LessonChoice[]) => readonly { name: string }[];
  initial: WorkflowDraft; context: WorkflowContext; staff: SetupRecord[]; locations?: SetupRecord[];
  onSave: (record: WorkflowDraft) => void; onCancel: () => void; onComplete: (record: WorkflowDraft) => void;
  programActions: ProgramActions;
  onUpdate: (record: WorkflowDraft) => void;
  onCreate: (record: WorkflowDraft, kind: 'group' | 'event') => void;
}) {
  const [record, setRecord] = useState<WorkflowDraft>(() => ({ ...initial, step: resumableWorkflowStep(initial, context) }))
  const [error, setError] = useState('')
  const [addingStudent, setAddingStudent] = useState(false)
  const [externalStudent, setExternalStudent] = useState({ name: '', email: '', guardian: '', instruments: '' })
  const [memberSearch, setMemberSearch] = useState('')
  const updateEnrollment = useCallback((draft: EnrollmentData, step: number, reviewedSteps: number[]) => {
    if (record.kind !== 'enrollment') return
    const next = { ...record, step, reviewedSteps, started: true, data: { ...record.data, draft, step, reviewedSteps, started: true, updatedAt: new Date().toISOString() } }
    onUpdate(next)
  }, [record, onUpdate])
  const patch = (next: WorkflowDraft) => {
    const updated = { ...next, started: true, updatedAt: new Date().toISOString() }
    setRecord(updated); onUpdate(updated); setError('')
  }
  const save = (next: WorkflowDraft) => onSave({ ...next, started: true, updatedAt: new Date().toISOString() })
  if (record.kind === 'enrollment') return <StaffEnrollment singleSession={!record.data.fromCalendar && record.data.entryLesson?.frequency === 'À-la-carte'} availablePeople={availablePeople} academyTeachers={academyTeachers} availability={availability} initialRecord={record.data} onComplete={(draft, step, reviewedSteps) => save({ ...record, step, reviewedSteps, data: completeEnrollmentDraft({ ...record.data, draft, step, reviewedSteps, started: true }, new Date().toISOString()) })} onDraftChange={updateEnrollment} onSaveAndClose={(draft, step, reviewedSteps) => save({ ...record, step, reviewedSteps, data: { ...record.data, draft, step, reviewedSteps, started: true, updatedAt: new Date().toISOString() } })} />
  const steps = workflowSteps(record)
  const lastStep = steps.length - 1
  const offering = record.kind === 'event' || record.kind === 'group'
  const move = (next: number) => {
    for (let index = 0; index < next; index++) {
      const problem = workflowStepError(record, index, context)
      if (problem) { setRecord({ ...record, step: index }); setError(problem); return }
    }
    patch({ ...record, step: next, reviewedSteps: [...new Set([...record.reviewedSteps, ...Array.from({ length: next }, (_, index) => index)])] })
  }
  const complete = () => {
    const problem = steps.map((_, index) => workflowStepError(record, index, context)).find(Boolean)
    if (problem) { setError(problem); return }
    try { onComplete({ ...record, reviewedSteps: steps.map((_, index) => index) }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Check the details.') }
  }
  const formingBand = record.kind === 'group' && record.data.formation
  const students = context.people.filter(person => person.enrolled || (formingBand && !person.roles.some(role => ['Parent', 'Account holder'].includes(role)))).filter(person => !formingBand || `${person.name} ${person.email} ${(person.instruments || []).join(' ')}`.toLowerCase().includes(memberSearch.toLowerCase()))
  const selectedIds = record.kind === 'group' || record.kind === 'membership' ? record.data.memberIds : []
  const updateMembers = (memberIds: string[]) => {
    if (record.kind === 'group') patch({ ...record, data: { ...record.data, memberIds } })
    if (record.kind === 'membership') patch({ ...record, data: { ...record.data, memberIds } })
  }
  const members = <ResponsiveDataTable rows={students} getRowKey={row => row.id} ariaLabel="Group students" emptyContent={<EmptyState title="No enrolled students" />} minDesktopWidth={500} selection={{ selectedKeys: new Set(selectedIds), allSelected: students.length > 0 && students.every(person => selectedIds.includes(person.id)), onToggle: row => {
    updateMembers(selectedIds.includes(row.id) ? selectedIds.filter(id => id !== row.id) : [...selectedIds, row.id])
  }, onToggleAll: () => {
    updateMembers(students.every(person => selectedIds.includes(person.id)) ? selectedIds.filter(id => !students.some(person => person.id === id)) : [...new Set([...selectedIds, ...students.map(person => person.id)])])
  }, selectAllLabel: 'Select all students', getRowLabel: row => row.name }} columns={[
    { id: 'name', header: 'Student', width: '1fr', render: row => <PersonName>{row.name}</PersonName> },
    { id: 'family', header: 'Account', width: '1.5fr', render: row => row.family },
  ]} />
  const group = record.kind === 'membership' ? context.academy.groups.find(group => group.id === record.data.groupId) : undefined
  const event = record.kind === 'registration' ? context.events.find(event => event.id === record.data.eventId) : undefined
  return <EnrollmentLayout title={formingBand ? 'Create band' : record.kind === 'program' ? context.academy.kind === 'music' ? 'Band / ensemble' : context.academy.kind === 'martial' ? 'Practice team' : 'Study group' : workflowLabels[record.kind]} actions={<Button variant="secondary" onClick={() => save(record)}>Save & close</Button>} steps={steps} currentStep={record.step} onStepChange={move} completedSteps={record.reviewedSteps.filter(index => !workflowStepError(record, index, context))}>
    <div className={offering ? styles.workflowSingle : styles.workflowLayout}>
    <SurfacePanel appearance="flat" padding={spacing.xl}>
    {error && <Notice variant="error" style={{ marginBottom: 24 }}>{error}</Notice>}
    <div className={styles.stack}>
    {record.kind === 'program' ? <ProgramFields proposalId={record.id} plan={record.data} step={record.step} context={context} staff={staff} actions={programActions} onChange={data => patch({ ...record, data })} /> : record.kind === 'event' && record.step === lastStep ? <EventReview event={record.data} typeName={context.academy.eventTypes.find(type => type.id === record.data.typeId)?.name} onChange={change => patch({ ...record, data: { ...record.data, ...change } })} /> : record.step === lastStep ? <DenseSectionPanel headingLevel="h2" title="Review" style={{ border: 0, padding: 0 }}><div className={styles.stack}><strong>{workflowName(record, context)}</strong>
      {formingBand && record.kind === 'group' ? <><p>{record.data.description ?? record.data.goals}</p>{record.data.leader && <p>{staff.find(person => person.id === record.data.leader)?.values.name}</p>}<p>{record.data.memberIds.map(id => context.people.find(person => person.id === id)?.name).join(', ') || 'No candidates selected'}</p></> : record.kind === 'group' && <><p>{staff.find(person => person.id === record.data.leader)?.values.name} · {record.data.schedule}</p><p>{record.data.memberIds.length} members · Capacity {record.data.capacity} · Trial limit {record.data.trialMax}</p></>}
      {record.kind === 'membership' && <><p>{record.data.memberIds.map(id => context.people.find(person => person.id === id)?.name).join(', ')}</p><p>{group?.schedule}</p><Notice>Prototype roster only. No subscriptions, invoices or payments are created.</Notice></>}
      {record.kind === 'registration' && <><p>{event?.name} · {event?.activities.find(activity => activity.id === record.data.activityId)?.name}</p>{event && <p>{eventPaymentTiming(event)}</p>}</>}
    </div></DenseSectionPanel> : <>
      {record.kind === 'event' && <EventFields embedded event={record.data} academy={context.academy} staff={staff} locations={locations} section={['details', 'activities', 'registration', 'policies'][record.step]} updateEvent={change => patch({ ...record, data: { ...record.data, ...change } })} />}
      {record.kind === 'group' && <DenseSectionPanel title={steps[record.step]} actions={formingBand && record.step === 0 ? <Button variant="secondary" onClick={() => setAddingStudent(true)}>Add external student</Button> : undefined} style={{ border: 0, padding: 0 }}><div className={styles.stack}>
        {record.step === 0 && <>
          <RadioOptionGroup label="Group type" value={record.data.typeId} options={context.academy.groupTypes.filter(type => type.enabled).map(type => ({ id: type.id, label: type.name, description: type.description }))} onChange={typeId => patch({ ...record, data: { ...record.data, typeId } })} />
          <Input label={formingBand ? "Band name" : "Group name"} value={record.data.name} onChange={event => patch({ ...record, data: { ...record.data, name: event.target.value } })} />
          {formingBand && <Textarea label="Band description" value={record.data.description ?? record.data.goals ?? ''} onChange={event => patch({ ...record, data: { ...record.data, description: event.target.value } })} />}
          {record.data.typeId && <Select label="Teacher / staff" value={record.data.leader} onChange={event => patch({ ...record, data: { ...record.data, leader: event.target.value } })}><option value="">{formingBand ? 'Assign later' : 'Choose teacher or staff'}</option>{staff.map(person => <option key={person.id} value={person.id}>{person.values.name}</option>)}</Select>}
        </>}
        {!formingBand && record.step === 1 && (record.data.dailySchedule ? <>
          <WeekdayToggleGroup value={record.data.dailySchedule.days} onChange={days => {
            const dailySchedule = { ...record.data.dailySchedule!, days }
            patch({ ...record, data: { ...record.data, dailySchedule, schedule: `${days.join(', ')} · ${dailySchedule.from}–${dailySchedule.to}` } })
          }} />
          <FieldGrid>{(['from', 'to'] as const).map(key => <Input key={key} label={key === 'from' ? 'Start time' : 'End time'} type="time" value={record.data.dailySchedule![key]} onChange={event => {
            const dailySchedule = { ...record.data.dailySchedule!, [key]: event.target.value }
            patch({ ...record, data: { ...record.data, dailySchedule, schedule: `${dailySchedule.days.join(', ')} · ${dailySchedule.from}–${dailySchedule.to}` } })
          }} />)}</FieldGrid>
        </> : <Textarea label="Recurring schedule" value={record.data.schedule} onChange={event => patch({ ...record, data: { ...record.data, schedule: event.target.value } })} />)}
        {!formingBand && record.step === 2 && <>
          <div style={{ maxWidth: 220 }}><Input label="Total capacity" type="number" min={1} step={1} value={record.data.capacity} onChange={event => patch({ ...record, data: { ...record.data, capacity: Number(event.target.value) } })} /></div>
          <div style={{ maxWidth: 620 }}><Switch label="Allow trial students" checked={record.data.trialMax > 0} onChange={event => patch({ ...record, data: { ...record.data, trialMax: event.target.checked ? Math.min(2, record.data.capacity) : 0 } })} /></div>
          {record.data.trialMax > 0 && <div style={{ maxWidth: 220 }}><Input label="Trial limit per session" type="number" min={1} max={record.data.capacity} step={1} value={record.data.trialMax} onChange={event => patch({ ...record, data: { ...record.data, trialMax: Number(event.target.value) } })} /></div>}
        </>}
        {(formingBand ? record.step === 0 : record.step === 3) && <>
          {formingBand && <Input label="Find candidates (optional)" value={memberSearch} onChange={event => setMemberSearch(event.target.value)} />}
          {members}
        </>}
      </div></DenseSectionPanel>}
      {record.kind === 'membership' && <DenseSectionPanel title={steps[record.step]} style={{ border: 0, padding: 0 }}><div className={styles.stack}>
        {record.step === 0 && members}
        {record.step === 1 && <><div className={styles.selectorAction}><Select label="Group" value={record.data.groupId} onChange={event => patch({ ...record, data: { ...record.data, groupId: event.target.value } })}><option value="">Choose a group</option>{context.academy.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</Select><Button variant="secondary" onClick={() => onCreate(record, 'group')}><Plus size={16} aria-hidden="true" />Create group</Button></div>{group && <p>{group.schedule} · {group.memberIds.length} / {group.capacity} members</p>}</>}
        {record.step === 2 && <><Notice>Prototype roster only. Billing and live enrollment are not implemented.</Notice><Checkbox label="I understand no subscription, invoice or payment will be created" checked={record.data.billingReviewed} onChange={event => patch({ ...record, data: { ...record.data, billingReviewed: event.target.checked } })} /></>}
      </div></DenseSectionPanel>}
      {record.kind === 'registration' && <DenseSectionPanel title={steps[record.step]} style={{ border: 0, padding: 0 }}><div className={styles.stack}>
        {record.step === 1 && <ParticipantPicker
          options={context.people.map(person => ({ id: person.id, name: person.name, detail: `${person.email} ${person.family}`, disabled: !!event && eventAlreadyRegistered(event, context.registrations || [], person.id, record.data.activityId) }))}
          selectedIds={record.data.personId && record.data.personId !== 'new' ? [record.data.personId] : []}
          onSelectionChange={ids => patch({ ...record, data: { ...record.data, personId: ids[0] || '', agreed: false, responses: {}, policyOverrides: [] } })}
          mode={record.data.personId === 'new' ? 'new' : 'existing'}
          onModeChange={mode => patch({ ...record, data: { ...record.data, personId: mode === 'new' ? 'new' : '', agreed: false, responses: {}, policyOverrides: [] } })}
          draft={{ firstName: record.data.firstName ?? record.data.name.split(' ')[0], lastName: record.data.lastName ?? record.data.name.split(' ').slice(1).join(' '), email: record.data.email, phone: record.data.phone || '', birthday: record.data.birthday || '' }}
          onDraftChange={draft => patch({ ...record, data: { ...record.data, ...draft, name: `${draft.firstName} ${draft.lastName}`.trim() } })} />}
        {record.step === 0 && <><div className={styles.selectorAction}><Select label="Event" value={record.data.eventId} onChange={e => { const chosen = context.events.find(item => item.id === e.target.value); patch({ ...record, data: { ...record.data, eventId: e.target.value, activityId: chosen ? eventRegistrationActivity(chosen, '') : '', personId: record.parentId ? record.data.personId : '', agreed: false, responses: {}, policyOverrides: [] } }) }}><option value="">Choose an event</option>{context.events.map(event => <option key={event.id} value={event.id} disabled={!event.activities.some(activity => activitySpace(event, activity.id, context.registrations || []) > 0)}>{event.name}{event.published ? '' : ' (staff draft)'}</option>)}</Select><Button variant="secondary" onClick={() => onCreate(record, 'event')}><Plus size={16} aria-hidden="true" />Create event</Button></div>{event && eventHasMultipleSessions(event) && <Select label="Session" value={record.data.activityId} onChange={e => patch({ ...record, data: { ...record.data, activityId: e.target.value, personId: record.parentId ? record.data.personId : '', agreed: false } })}><option value="">Choose a session</option>{event.activities.map(activity => <option key={activity.id} value={activity.id} disabled={activitySpace(event, activity.id, context.registrations || []) === 0}>{activity.name} · {activitySpace(event, activity.id, context.registrations || []) || 'Full'}{activitySpace(event, activity.id, context.registrations || []) > 0 ? ' spaces' : ''}</option>)}</Select>}</>}
        {record.step === 2 && <>
          <ParticipationPolicies agreements={[{ id: event?.id || record.id, title: 'Participation agreement', content: event?.waiver || '' }]} accepted={record.data.agreed} onAccept={agreed => patch({ ...record, data: { ...record.data, agreed } })} />
          {eventQuestions(event).map(question => <section key={question} className={styles.stack}>
            <Textarea label={question} disabled={context.registrationAudience !== 'family' && record.data.policyOverrides?.includes(question)} value={record.data.responses?.[question] || ''} onChange={e => patch({ ...record, data: { ...record.data, responses: { ...record.data.responses, [question]: e.target.value } } })} />
            {context.registrationAudience !== 'family' && <Checkbox label={`Staff override: ${question}`} checked={record.data.policyOverrides?.includes(question) || false} onChange={e => patch({ ...record, data: { ...record.data, policyOverrides: e.target.checked ? [...(record.data.policyOverrides || []), question] : record.data.policyOverrides?.filter(value => value !== question) } })} />}
          </section>)}
        </>}

      </div></DenseSectionPanel>}
    </>}
    </div>
    <div className={enrollmentStyles.formFooter}>
      {record.step > 0 ? <Button variant="ghost" onClick={() => move(record.step - 1)}><ArrowLeft size={15} aria-hidden="true" />Back</Button> : <span />}
      {record.step < lastStep ? <Button onClick={() => move(record.step + 1)}>Continue<ArrowRight size={15} aria-hidden="true" /></Button> : <Button onClick={complete}>{record.parentId ? 'Save & return' : record.kind === 'program' ? 'Confirm booking' : formingBand ? 'Create band' : record.kind === 'group' ? 'Save group' : record.kind === 'event' ? 'Save event' : record.kind === 'membership' ? 'Save membership' : 'Save registration'}</Button>}
    </div>
    </SurfacePanel>
    <Modal isOpen={addingStudent} onClose={() => setAddingStudent(false)} ariaLabel="Add external student"><ModalHeader title="Add external student" onClose={() => setAddingStudent(false)} /><ModalBody><div className={styles.stack}>
      <Input label="Student name" value={externalStudent.name} onChange={event => setExternalStudent({ ...externalStudent, name: event.target.value })} />
      <Input label="Contact email" type="email" value={externalStudent.email} onChange={event => setExternalStudent({ ...externalStudent, email: event.target.value })} />
      <Input label="Parent / guardian" value={externalStudent.guardian} onChange={event => setExternalStudent({ ...externalStudent, guardian: event.target.value })} />
      <Input label="Instruments / voice" value={externalStudent.instruments} onChange={event => setExternalStudent({ ...externalStudent, instruments: event.target.value })} />
      {error && <Notice variant="error">{error}</Notice>}
    </div></ModalBody><ModalFooter><Button onClick={() => {
      try { const person = programActions.onStudent(externalStudent); updateMembers([...selectedIds, person.id]); setAddingStudent(false); setExternalStudent({ name: '', email: '', guardian: '', instruments: '' }) }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Check student details.') }
    }}>Add student</Button></ModalFooter></Modal>
    {!offering && <aside className={enrollmentStyles.summary} aria-label="Enrollment summary">
      <h2>Enrollment</h2>
      <div><strong>{workflowName(record, context)}</strong>
        {record.kind === 'program' && <><p>{record.data.name || 'Unnamed proposal'}</p><p>{record.data.mode === 'once' ? 'One session / à-la-carte' : 'Ongoing / subscription'}</p><p>{record.data.date} {record.data.time}</p></>}
        {record.kind === 'membership' && <><p>{record.data.memberIds.map(id => context.people.find(person => person.id === id)?.name).join(', ') || 'Students not selected'}</p><p>{group?.schedule || 'Group not selected'}</p><p>Prototype roster only</p></>}
        {record.kind === 'registration' && <><p>{event?.name || 'Event not selected'}</p><p>{event && !eventHasMultipleSessions(event) ? 'Whole event' : event?.activities.find(activity => activity.id === record.data.activityId)?.name || 'Session not selected'}</p></>}
      </div>
    </aside>}
    </div>
  </EnrollmentLayout>
}
