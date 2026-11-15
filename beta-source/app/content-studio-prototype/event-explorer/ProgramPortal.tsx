'use client'

import { sanitizePrototypeHtml } from '@/lib/conversations-prototype-html'
import { bandEnrollmentRequestEmail, type BandEnrollmentRequest } from '@/beta-source/lib/academy-band-requests'
import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { Disclosure } from '@/components/ui/Disclosure'
import { Notice } from '@/components/ui/Notice'
import { EmptyState } from '@/components/ui/EmptyState'
import type { ExplorerPerson } from '@/beta-source/lib/event-explorer'
import { scheduleSignature, type ProgramPlan, type ProgramTask, type AvailabilityBlock } from '@/beta-source/lib/academy-program-proposals'
import ProgramAvailability from './ProgramAvailability'
import styles from './explorer.module.css'

export default function ProgramPortal({ people, tasks, plans, onSubmit, onConfirm, onBack, completedIds, requests = [], onEnroll }: { requests?: BandEnrollmentRequest[]; onEnroll?: (id: string, accountId: string) => void; completedIds: string[]; people: ExplorerPerson[]; tasks: ProgramTask[]; plans: Record<string, ProgramPlan>; onSubmit: (id: string, allowed: string[], blocks: AvailabilityBlock[]) => void; onConfirm: (id: string, allowed: string[], plan: ProgramPlan) => void; onBack: () => void }) {
  const accounts = [...new Map(people.filter(person => tasks.some(task => task.studentId === person.id) || requests.some(request => request.studentId === person.id)).map(person => [person.accountId || person.id, person.family])).entries()]
  const [account, setAccount] = useState(accounts[0]?.[0] || '')
  const [error, setError] = useState('')
  const allowed = people.filter(person => (person.accountId || person.id) === account).map(person => person.id)
  const visible = tasks.filter(task => allowed.includes(task.studentId))
  const enrollmentActions = requests.filter(request => request.accountId === account && allowed.includes(request.studentId) && !request.completedAt)
  const openRequest = (id: string) => { try { onEnroll?.(id, account); setError('') } catch (cause) { setError((cause as Error).message) } }
  return <><PageHeader title="Family portal preview" onBack={onBack} /><Notice>Simulated family view. No invitations or notifications are sent. Only the selected family’s requests are shown.</Notice><Select label="Preview family" value={account} onChange={event => { setAccount(event.target.value); setError('') }}><option value="">Choose family</option>{accounts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select>{error && <Notice variant="error">{error}</Notice>}{enrollmentActions.map(request => {
    const student = people.find(person => person.id === request.studentId)
    const email = bandEnrollmentRequestEmail(request, student?.name || '')
    return <div key={request.id} className={styles.stack}>
      <Notice title={`Complete enrollment · ${student?.name} · ${request.bandName}`}><div className={styles.stack}><span>${request.monthlyPrice} · {request.pricing?.unit || 'per month'}. Review policies and complete enrollment to confirm the placement.</span><Button onClick={() => openRequest(request.id)}>Complete enrollment in {request.bandName}</Button></div></Notice>
      <Disclosure summary={`Enrollment email · ${student?.name} · ${request.bandName}`}><DenseSectionPanel title={email.subject}><div className={styles.stack}><p>To: {request.recipientName} · {request.recipientEmail}</p><div>{request.message ? <div dangerouslySetInnerHTML={{ __html: sanitizePrototypeHtml(request.message.html) }} /> : <p style={{ whiteSpace: 'pre-line' }}>{email.body}</p>}</div><Button onClick={() => openRequest(request.id)}>{email.cta}</Button></div></DenseSectionPanel></Disclosure>
    </div>
  })}{!visible.length && !enrollmentActions.length && <EmptyState title="No availability requests" />}{visible.map(task => {
    const plan = plans[task.proposalId]
    return <DenseSectionPanel key={task.id} title={`${people.find(person => person.id === task.studentId)?.name} · ${task.proposalName}`}><div className={styles.stack}><p>{completedIds.includes(task.proposalId) ? 'Booking confirmed' : task.submitted ? 'Availability submitted' : 'Availability requested'}</p>{!completedIds.includes(task.proposalId) && <Disclosure summary={task.submitted ? 'Review / update availability' : 'Submit available times'} open={!task.submitted}><ProgramAvailability key={`${task.id}:${task.submitted}`} task={task} onSubmit={blocks => onSubmit(task.id, allowed, blocks)} /></Disclosure>}{task.schedule && plan && task.schedule === scheduleSignature(plan) && <><strong>Proposed session: {plan.date} · {plan.time} · {plan.duration} minutes</strong><p>{plan.mode === 'once' ? 'One session / à-la-carte' : 'Ongoing / subscription'}. Confirming this time does not charge you.</p>{task.confirmedSchedule === task.schedule ? <Notice variant="success">Schedule confirmed</Notice> : <Button onClick={() => { try { onConfirm(task.id, allowed, plan); setError('') } catch (cause) { setError((cause as Error).message) } }}>Confirm schedule</Button>}</>}</div></DenseSectionPanel>
  })}</>
}