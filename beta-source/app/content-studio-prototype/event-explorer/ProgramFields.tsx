'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { Checkbox } from '@/components/ui/Checkbox'
import { Notice } from '@/components/ui/Notice'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import type { SetupRecord } from '../school-setup/setup-content'
import type { ExplorerPerson } from '@/beta-source/lib/event-explorer'
import { programTotal, programScheduleError, scheduleSignature, type ProgramTask, type ProgramPlan, type AvailabilityBlock } from '@/beta-source/lib/academy-program-proposals'
import type { WorkflowContext } from '@/beta-source/lib/academy-workflow-drafts'
import ProgramAvailability from './ProgramAvailability'
import styles from './explorer.module.css'

export type ProgramActions = {
  onStudent: (input: { name: string; email: string; guardian: string; instruments: string; accountId?: string }) => ExplorerPerson;
  onRequest: (plan: ProgramPlan) => void; onPropose: (plan: ProgramPlan) => void; onPortal: () => void;
  onResponse: (id: string, allowed: string[], blocks: AvailabilityBlock[]) => void;
  onConfirm: (id: string, allowed: string[], plan: ProgramPlan) => void;
}
export default function ProgramFields({ proposalId, plan, step, context, staff, onChange, actions }: { proposalId: string; plan: ProgramPlan; step: number; context: WorkflowContext; staff: SetupRecord[]; onChange: (plan: ProgramPlan) => void; actions: ProgramActions }) {
  const [search, setSearch] = useState('')
  const [instrument, setInstrument] = useState('')
  const [adding, setAdding] = useState(false)
  const [student, setStudent] = useState({ name: '', email: '', guardian: '', instruments: '', accountId: '' })
  const [error, setError] = useState('')
  const [response, setResponse] = useState<ProgramTask | null>(null)
  const tasks = (context.tasks || []).filter(task => task.proposalId === proposalId)
  const patch = (change: Partial<ProgramPlan>) => { onChange({ ...plan, ...change }); setError('') }
  const names = plan.memberIds.map(id => context.people.find(person => person.id === id)?.name).join(', ')
  let total: number | null = null
  try { total = programTotal(plan) } catch { /* Validation is displayed on continue. */ }
  const invoke = (fn: () => void) => { try { fn(); setError('') } catch (cause) { setError((cause as Error).message) } }
  return <div className={styles.stack}>
    {error && <Notice variant="error">{error}</Notice>}
    {step === 0 && <>
      <h2>People & proposal</h2>
      <Input label="Proposal name" value={plan.name} onChange={event => patch({ name: event.target.value })} />
      <div className={styles.selectorAction}><Select label="Band / group program" value={plan.groupId} onChange={event => { const group = context.academy.groups.find(group => group.id === event.target.value); patch({ groupId: group?.id || '', name: group?.name || plan.name, leader: group?.leader || plan.leader }) }}><option value="">New proposal around these people</option>{context.academy.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</Select><Button variant="secondary" onClick={() => patch({ groupId: '', name: '' })}>{context.academy.kind === 'music' ? '+ Create band / ensemble' : '+ Create group'}</Button></div>
      <Select label="Teacher / staff" value={plan.leader} onChange={event => patch({ leader: event.target.value })}><option value="">Choose teacher or staff</option>{staff.map(person => <option key={person.id} value={person.id}>{person.values.name}</option>)}</Select>
      <FieldGrid><Input label="Find students or contacts" value={search} onChange={event => setSearch(event.target.value)} /><Select label="Instrument / voice" value={instrument} onChange={event => setInstrument(event.target.value)}><option value="">All instruments</option>{[...new Set(context.people.flatMap(person => person.instruments || []))].sort().map(name => <option key={name}>{name}</option>)}</Select></FieldGrid>
      <p>{plan.memberIds.length} selected. Selection is retained when searching or changing instruments.</p>
      {context.people.filter(person => `${person.name} ${person.email}`.toLowerCase().includes(search.toLowerCase()) && (!instrument || person.instruments?.includes(instrument))).map(person => <Checkbox key={person.id} label={`${person.name}${person.instruments?.length ? ` · ${person.instruments.join(', ')}` : ''}`} checked={plan.memberIds.includes(person.id)} onChange={event => patch({ memberIds: event.target.checked ? [...plan.memberIds, person.id] : plan.memberIds.filter(id => id !== person.id) })} />)}
      <Button variant="secondary" onClick={() => setAdding(true)}>+ Add new student</Button>
      {plan.memberIds.map(id => <Input key={id} label={`${context.people.find(person => person.id === id)?.name} · Role / instrument in this program`} value={plan.roles[id] || ''} onChange={event => patch({ roles: { ...plan.roles, [id]: event.target.value } })} />)}
      <p>Selected people become leads for this proposal. Existing enrollments stay unchanged.</p>
    </>}
    {step === 1 && <>
      <h2>Availability</h2><Input label="Requested week starting" type="date" value={plan.week} onChange={event => patch({ week: event.target.value })} />
      <div className={styles.inlineActions}><Button variant="secondary" onClick={() => invoke(() => actions.onRequest(plan))}>Request availability</Button><Button variant="secondary" onClick={actions.onPortal}>Open family portal preview</Button></div>
      <p>Each student receives a separate task for this proposal, even if they have other requests. Changing the requested week requires new responses.</p>
      {plan.memberIds.map(id => { const task = tasks.find(task => task.studentId === id && task.week === plan.week); return <DenseSectionPanel key={id} title={context.people.find(person => person.id === id)?.name} actions={task && <Button variant="secondary" onClick={() => setResponse(task)}>Record family response</Button>}><p>{task?.submitted ? 'Availability submitted' : task ? 'Awaiting response' : 'Not requested'}</p>{task?.blocks.map(block => <p key={block.id}>{block.date} · {block.from}–{block.to}</p>)}</DenseSectionPanel> })}
    </>}
    {step === 2 && <>
      <h2>Schedule & pricing</h2><Select label="Booking" value={plan.mode} onChange={event => patch({ mode: event.target.value as ProgramPlan['mode'] })}><option value="once">Book one session / à-la-carte</option><option value="ongoing">{context.academy.kind === 'music' ? 'Book recurring rehearsals' : 'Book ongoing / subscription'}</option></Select>
      <FieldGrid><Input label={plan.mode === 'once' ? 'Session date' : 'First session date'} type="date" value={plan.date} onChange={event => patch({ date: event.target.value })} /><Input label="Session time" type="time" value={plan.time} onChange={event => patch({ time: event.target.value })} /><Select label="Duration" value={plan.duration} onChange={event => patch({ duration: Number(event.target.value) })}>{[30, 45, 60, 90, 120].map(value => <option key={value} value={value}>{value} minutes</option>)}</Select></FieldGrid>
      {plan.mode === 'ongoing' && <p>Weekly from this date. Standard rate: ${Number(plan.price || 0).toFixed(2)} per person / session. {context.academy.kind === 'music' ? '' : 'Subscription preview; no live billing.'}</p>}
      <FieldGrid><Input label="Price per person / session (USD)" type="number" min={0} value={plan.price} onChange={event => patch({ price: event.target.value })} /><Input label="Trial discount (%)" type="number" min={0} max={100} value={plan.discount} onChange={event => patch({ discount: Number(event.target.value) })} /></FieldGrid>
      <strong>{total === null ? 'Check pricing' : `Per person${plan.mode === 'ongoing' ? ', per session' : ''}: $${total.toFixed(2)}${total === 0 ? ' · Free' : ''}`}</strong>
      <p>{plan.mode === 'ongoing' ? 'The discount applies to the first session only; subsequent sessions use the standard rate.' : 'A 100% trial discount makes this session free. It does not start a subscription.'}</p>
      <div className={styles.inlineActions}><Button variant="secondary" onClick={() => invoke(() => { const problem = programScheduleError(plan, tasks); if (problem) throw new Error(problem); actions.onPropose(plan) })}>Propose schedule to families</Button><Button variant="secondary" onClick={actions.onPortal}>Open family portal preview</Button></div>
      {plan.memberIds.map(id => { const task = tasks.find(task => task.studentId === id); return <DenseSectionPanel key={id} title={context.people.find(person => person.id === id)?.name} actions={task?.schedule === scheduleSignature(plan) && task.confirmedSchedule !== task.schedule && <Button variant="secondary" onClick={() => invoke(() => actions.onConfirm(task.id, [id], plan))}>Record offline confirmation</Button>}><p>{task?.confirmedSchedule === scheduleSignature(plan) ? 'Schedule confirmed' : task?.schedule === scheduleSignature(plan) ? 'Awaiting schedule confirmation' : 'Schedule not proposed'}</p></DenseSectionPanel> })}
    </>}
    {step === 3 && <><h2>Review & book</h2><strong>{plan.name}</strong><p>{names}</p><p>{plan.date} · {plan.time} · {plan.duration} minutes{plan.mode === 'ongoing' ? ' · Weekly' : ''}</p><p>{plan.mode === 'once' ? 'One session / à-la-carte' : (context.academy.kind === 'music' ? 'Recurring rehearsals' : 'Ongoing / subscription')} · ${total?.toFixed(2)} per person{plan.mode === 'ongoing' ? ' for the first session' : ''}</p><Notice>{plan.mode === 'once' ? 'Confirms the assembled program and this session only. Program leads remain open; no ongoing enrollment or subscription is started.' : (context.academy.kind === 'music' ? 'Books rehearsals without changing band enrollment or subscriptions.' : 'Confirms the ongoing program enrollment. This prototype does not create operational invoices, charges or reservations.')}</Notice></>}
    <Modal isOpen={adding} onClose={() => setAdding(false)} ariaLabel="Create student"><ModalHeader title="Create student" onClose={() => setAdding(false)} /><ModalBody><div className={styles.stack}><Input label="Student name" value={student.name} onChange={event => setStudent({ ...student, name: event.target.value })} /><Select label="Existing family / contact" value={student.accountId} onChange={event => { const person = context.people.find(person => (person.accountId || person.id) === event.target.value); setStudent({ ...student, accountId: event.target.value, email: person?.email || '', guardian: person?.family || '' }) }}><option value="">New family / self</option>{[...new Map(context.people.map(person => [person.accountId || person.id, person])).values()].map(person => <option key={person.accountId || person.id} value={person.accountId || person.id}>{person.family}</option>)}</Select><Input label="Parent / guardian or self" value={student.guardian} onChange={event => setStudent({ ...student, guardian: event.target.value })} /><Input label="Contact email" type="email" value={student.email} onChange={event => setStudent({ ...student, email: event.target.value })} /><Input label="Instruments / voice (comma separated)" value={student.instruments} onChange={event => setStudent({ ...student, instruments: event.target.value })} />{error && <Notice variant="error">{error}</Notice>}</div></ModalBody><ModalFooter><Button onClick={() => invoke(() => { const person = actions.onStudent(student); patch({ memberIds: [...plan.memberIds, person.id] }); setAdding(false); setStudent({ name: '', email: '', guardian: '', instruments: '', accountId: '' }) })}>Create student & add</Button></ModalFooter></Modal>
    <Modal isOpen={!!response} onClose={() => setResponse(null)} size="wide" ariaLabel="Record family availability"><ModalHeader title="Record family availability" onClose={() => setResponse(null)} /><ModalBody>{response && <ProgramAvailability task={response} onSubmit={blocks => { actions.onResponse(response.id, [response.studentId], blocks); setResponse(null) }} />}</ModalBody></Modal>
  </div>
}