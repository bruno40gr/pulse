'use client'

import { useState } from 'react'
import { Button, DenseSectionPanel, Notice, StatusBadge } from '@/beta-source/components/ui'
import { usePortalQueue } from '@/beta-source/lib/usePortalQueue'
import { familyQueue } from '@/beta-source/lib/academy-portal-queue'
import type { BandEnrollment as BandDraft } from '@/beta-source/lib/academy-band-enrollment'
import { confirmProgramSchedule, submitProgramAvailability, scheduleSignature } from '@/beta-source/lib/academy-program-proposals'
import { canSendLessonEnrollment, enrollmentPerson, openFamilyBand, openFamilyLesson, saveFamilyBand, saveFamilyLesson } from '@/beta-source/lib/academy-portal-actions'
import BandEnrollment from '../event-explorer/BandEnrollment'
import ProgramAvailability from '../event-explorer/ProgramAvailability'
import StaffEnrollment from '../enrollment/StaffEnrollment'
import type { EnrollmentDraftRecord } from '@/beta-source/lib/academy-enrollment-drafts'
import styles from './ParentPortal.module.css'
import { useCalendarEnrollment } from '@/beta-source/app/odeon-demo/CalendarEnrollmentContext'
import { calendarWorkflow } from '@/beta-source/lib/academy-calendar-enrollment'

/** Account-scoped local preview. The operational portal requires server-side grants. */
export function ParentEnrollmentQueue({ accountId }: { accountId: string }) {
  const [queue, update] = usePortalQueue()
  const calendarEnrollment = useCalendarEnrollment()
  const [bandDraft, setBandDraft] = useState<BandDraft | null>(null)
  const [lessonDraft, setLessonDraft] = useState<EnrollmentDraftRecord | null>(null)
  const [error, setError] = useState('')
  const visible = familyQueue(queue, accountId)
  const allowed = visible.people.map(person => person.id)
  const run = (action: () => void) => { try { action(); setError('') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Request unavailable.') } }
  const people = visible.people.map(enrollmentPerson)
  const finishLesson = (draft: EnrollmentDraftRecord['draft'], step: number, reviewedSteps: number[]) => {
    if (!lessonDraft) throw new Error('Enrollment draft unavailable.')
    if (lessonDraft.calendarRequest) {
      if (!calendarEnrollment) throw new Error('Connected enrollment unavailable.')
      calendarEnrollment.save({ ...lessonDraft, draft, step, reviewedSteps }, true, 'family', accountId)
      setLessonDraft(null); return
    }
    update(current => saveFamilyLesson(current, accountId, { ...lessonDraft, draft, step, reviewedSteps }, true))
    setLessonDraft(null)
  }
  if (bandDraft) {
    const request = visible.requests.find(item => item.id === bandDraft.requestId)
    if (!request) return <Notice variant="error">Enrollment request unavailable.</Notice>
    return <BandEnrollment key={bandDraft.id} draft={bandDraft} request={request} people={visible.people} groups={queue.academy.groups.filter(group => group.id === request.bandId)} policies={request.policies} onStudent={() => {}} onChange={next => {
      update(current => saveFamilyBand(current, accountId, next))
      setBandDraft(next)
    }} onClose={() => setBandDraft(null)} onComplete={draft => {
      update(current => saveFamilyBand(current, accountId, draft, true))
      setBandDraft(null)
    }} />
  }
  const liveLesson = lessonDraft ? queue.drafts.find(item => item.id === lessonDraft.id && item.kind === 'enrollment') : undefined
  if (lessonDraft && liveLesson?.kind === 'enrollment' && liveLesson.data.completedAt) return <Notice title="Enrollment already completed">This request was completed by {liveLesson.data.calendarRequest?.completedBy || 'staff'}. No additional enrollment or payment is needed.<Button onClick={() => setLessonDraft(null)}>Close</Button></Notice>
  if (lessonDraft) return <StaffEnrollment key={lessonDraft.id} initialRecord={lessonDraft} availablePeople={people} academyTeachers={lessonDraft.calendarRequest ? calendarEnrollment?.teachers : undefined} availability={lessonDraft.calendarRequest ? calendarEnrollment?.availability : undefined} onClose={() => setLessonDraft(null)} onSaveAndClose={(draft, step, reviewedSteps) => {
    if (lessonDraft.calendarRequest) {
      if (!calendarEnrollment) throw new Error('Connected enrollment unavailable.')
      calendarEnrollment.save({ ...lessonDraft, draft, step, reviewedSteps }, false, 'family', accountId)
      setLessonDraft(null); return
    }
    update(current => saveFamilyLesson(current, accountId, { ...lessonDraft, draft, step, reviewedSteps }))
    setLessonDraft(null)
  }} onComplete={finishLesson} />
  const drafts = queue.drafts.filter(item => item.kind === 'enrollment' && !item.data.completedAt && item.data.sourceLeadId && visible.inquiries.some(inquiry => inquiry.id === item.data.sourceLeadId))
  const tasks = visible.tasks.filter(task => !queue.bookings.some(booking => booking.proposalId === task.proposalId))
  const calendarRequests = queue.drafts.filter(item => item.kind === 'enrollment' && item.data.calendarRequest?.accountId === accountId && item.data.calendarRequest.sentAt)
  if (!visible.inquiries.length && !visible.requests.length && !tasks.length && !calendarRequests.length) return null
  return <section aria-label="Enrollment requests" className={styles.stack}>
    <h2>Enrollment requests</h2>
    {error && <Notice variant="error">{error}</Notice>}
    {calendarRequests.map(item => item.kind === 'enrollment' && <DenseSectionPanel key={item.id} title={`${item.data.draft.student?.firstName || 'Student'} · ${item.data.draft.lessons[0]?.instrument || 'Lessons'}`} actions={!item.data.completedAt ? <Button onClick={() => run(() => setLessonDraft(calendarWorkflow(queue, item.id, accountId).data))}>Continue enrollment</Button> : undefined}><StatusBadge status={item.data.completedAt ? 'active' : 'pending'} label={item.data.completedAt ? `Completed by ${item.data.calendarRequest?.completedBy || 'staff'}` : 'Awaiting enrollment'} /><p>{item.data.draft.lessons[0]?.frequency} · {item.data.draft.lessons[0]?.start} · {item.data.draft.lessons[0]?.time}</p>{item.data.completedAt ? <p>Already completed. No additional enrollment or payment is needed.</p> : <p>This proposed time is not reserved. Availability is checked before completion.</p>}</DenseSectionPanel>)}
    {visible.requests.map(request => <DenseSectionPanel key={request.id} title={`${visible.people.find(person => person.id === request.studentId)?.name} · ${request.bandName}`} actions={<Button onClick={() => run(() => {
      let nextDraft: BandDraft | undefined
      update(current => {
        const result = openFamilyBand(current, accountId, request.id)
        nextDraft = result.draft
        return result.queue
      })
      setBandDraft(nextDraft!)
    })}>Complete enrollment</Button>}><StatusBadge status="pending" label="Awaiting enrollment" /></DenseSectionPanel>)}
    {visible.inquiries.filter(inquiry => !visible.requests.some(request => request.studentId === inquiry.personId && request.bandId === inquiry.bandId)).map(inquiry => {
      const draft = drafts.find(item => item.kind === 'enrollment' && item.data.sourceLeadId === inquiry.id)
      const canEnroll = !!inquiry.enrollmentSentAt && canSendLessonEnrollment(inquiry)
      return <DenseSectionPanel key={inquiry.id} title={`${visible.people.find(person => person.id === inquiry.personId)?.name} · ${inquiry.interest}`} actions={canEnroll ? <Button onClick={() => run(() => {
        let nextRecord: EnrollmentDraftRecord | undefined
        update(current => {
          const result = openFamilyLesson(current, accountId, inquiry.id)
          nextRecord = result.record
          return result.queue
        })
        setLessonDraft(nextRecord!)
      })}>{draft ? 'Continue enrollment' : 'Complete enrollment'}</Button> : undefined}><StatusBadge status="pending" label={canEnroll ? 'Awaiting enrollment' : inquiry.stage} /></DenseSectionPanel>
    })}
    {tasks.map(task => {
      const draft = queue.drafts.find(item => item.id === task.proposalId && item.kind === 'program')
      const plan = draft?.kind === 'program' ? draft.data : undefined
      return <DenseSectionPanel key={task.id} title={`${visible.people.find(person => person.id === task.studentId)?.name} · ${task.proposalName}`}><div className={styles.stack}>
        <StatusBadge status="pending" label={task.submitted ? 'Availability submitted' : 'Availability requested'} />
        <ProgramAvailability task={task} onSubmit={blocks => run(() => update(current => ({ ...current, tasks: submitProgramAvailability(current.tasks, task.id, allowed, blocks) })))} />
        {plan && task.schedule === scheduleSignature(plan) && <><strong>{plan.date} · {plan.time} · {plan.duration} minutes</strong>{task.confirmedSchedule === task.schedule ? <StatusBadge status="active" label="Schedule confirmed" /> : <Button onClick={() => run(() => update(current => ({ ...current, tasks: confirmProgramSchedule(current.tasks, task.id, allowed, plan) })))}>Confirm schedule</Button>}</>}
      </div></DenseSectionPanel>
    })}
  </section>
}
