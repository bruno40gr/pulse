'use client'

import { useRef, useState } from 'react'
import { EnrollmentLayout } from '@/components/ui/EnrollmentLayout'
import { Button } from '@/components/ui/Button'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { ModalFooter } from '@/components/ui/Modal'
import { spacing } from '@/lib/tokens'
import { SurfacePanel } from '@/components/ui/SurfacePanel'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Checkbox'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { Notice } from '@/components/ui/Notice'
import { ParticipationPolicies } from '@/components/ui/ParticipationPolicies'
import { PersonPicker } from '../enrollment/StaffEnrollment'
import { EnrollmentCardPreview } from '../enrollment/EnrollmentCardPreview'
import { personDetailsError, type EnrollmentPerson } from '@/beta-source/lib/academy-staff-enrollment'
import { defaultBandInstrument, bandEnrollmentSteps, bandEnrollmentError, type BandEnrollment as Draft } from '@/beta-source/lib/academy-band-enrollment'
import type { AcademyGroup } from '@/beta-source/lib/academy-explorer'
import type { ExplorerPerson } from '@/beta-source/lib/event-explorer'
import type { SetupRecord } from '../school-setup/setup-content'
import styles from './explorer.module.css'

const pickerPerson = (person: ExplorerPerson): EnrollmentPerson => ({ id: person.id, firstName: person.name.split(' ')[0], lastName: person.name.split(' ').slice(1).join(' '), email: person.email, phone: '', activeTeacher: false })
export default function BandEnrollment({ draft, people, groups, policies, onChange, onStudent, onComplete, onClose, request }: {
  draft: Draft; people: ExplorerPerson[]; groups: AcademyGroup[]; policies: SetupRecord[];
  onChange: (draft: Draft) => void; onStudent: (person: EnrollmentPerson) => void;
  request?: import('@/beta-source/lib/academy-band-requests').BandEnrollmentRequest;
  onComplete: (draft: Draft) => void; onClose: () => void;
}) {
  const [error, setError] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [personDraft, setPersonDraft] = useState<EnrollmentPerson | null>(null)
  const submitting = useRef(false)
  const group = groups.find(group => group.id === draft.bandId)
  const student = people.find(person => person.id === draft.studentId)
  const patch = (change: Partial<Draft>) => { onChange({ ...draft, ...change }); setError('') }
  const move = (step: number) => {
    if (step > draft.step) {
      for (let index = 0; index < step; index++) {
        const problem = bandEnrollmentError(draft, index, people, groups)
        if (problem) { setError(problem); return }
      }
    }
    patch({ step })
  }
  const selectStudent = (person: EnrollmentPerson | null) => {
    setPersonDraft(person)
    if (!person) { patch({ studentId: '', payerName: '', payerEmail: '' }); return }
    if (!people.some(item => item.id === person.id)) { patch({ studentId: '' }); return }
    const selected = people.find(item => item.id === person.id)!
    const holder = people.find(item => (item.accountId || item.id) === (selected.accountId || selected.id) && item.roles.some(role => ['Parent', 'Account holder'].includes(role))) || selected
    patch({ studentId: person.id, payerName: holder.name, payerEmail: holder.email, instrument: defaultBandInstrument(selected) })
  }
  return <EnrollmentLayout title="Band enrollment" actions={<Button variant="secondary" onClick={onClose}>Save & close</Button>} steps={bandEnrollmentSteps} currentStep={draft.step} onStepChange={move}>
    <SurfacePanel appearance="flat" padding={spacing.xl}>
      <form className={styles.stack} onSubmit={event => {
        event.preventDefault()
        setAttempted(true)
        if (draft.step === 0 && personDraft) {
          const problem = personDetailsError(personDraft)
          if (problem) { setError(problem); return }
          onStudent(personDraft)
          const existing = people.some(person => person.id === personDraft.id)
          patch({ studentId: personDraft.id, step: 1, ...(!existing ? { payerName: `${personDraft.firstName} ${personDraft.lastName}`, payerEmail: personDraft.email } : {}) })
          return
        }
        if (draft.step < 3) { move(draft.step + 1); return }
        const problem = bandEnrollmentError(draft, 3, people, groups)
        if (problem) { setError(problem); return }
        if (submitting.current) return
        submitting.current = true
        try { onComplete(draft) } catch (cause) { setError((cause as Error).message); submitting.current = false }
      }}>
        {error && <Notice variant="error">{error}</Notice>}
        {draft.step === 0 && <section className={styles.stack}><SectionTitle as="h2">Student</SectionTitle>
          {request ? <p>{student?.name} · {group?.name}</p> : <PersonPicker showErrors={attempted} title="" value={personDraft || (student ? pickerPerson(student) : null)} people={people.filter(person => !person.roles.includes('Parent')).map(pickerPerson)} onChange={selectStudent} onAdd={person => { onStudent(person); setPersonDraft(person); patch({ studentId: person.id, payerName: `${person.firstName} ${person.lastName}`, payerEmail: person.email }) }} />}
        </section>}
        {draft.step === 1 && <section className={styles.stack}><SectionTitle as="h2">Band</SectionTitle><div className={styles.stack}>
          <Select label="Band" disabled={!!request} value={draft.chooseBandLater && !draft.bandId ? 'unassigned' : draft.bandId} onChange={event => patch({ bandId: event.target.value === 'unassigned' ? '' : event.target.value, chooseBandLater: event.target.value === 'unassigned', policyAccepted: false, subscriptionAccepted: false })}><option value="">Choose a band</option><option value="unassigned">Choose a band later</option>{groups.map(group => <option key={group.id} value={group.id} disabled={group.memberIds.includes(draft.studentId)}>{group.name}</option>)}</Select>
          <Input label="Instrument" list="band-instruments" value={draft.instrument || ''} onChange={event => patch({ instrument: event.target.value })} />
          <datalist id="band-instruments">{[...new Set([...people.flatMap(person => person.subscriptions?.map(subscription => subscription.instrument) || []), ...people.flatMap(person => person.instruments || [])])].map(instrument => <option key={instrument} value={instrument} />)}</datalist>
        </div></section>}
        {draft.step === 2 && <section className={styles.stack}><SectionTitle as="h2">Policies</SectionTitle><div className={styles.stack}>
          <ParticipationPolicies agreements={policies.flatMap(policy => policy.values.waiver || policy.values.agreement ? [{ id: policy.id, title: policy.values.name || 'Participation agreement', content: policy.values.waiver || policy.values.agreement }] : [])} accepted={draft.policyAccepted} onAccept={policyAccepted => patch({ policyAccepted })} acceptanceLabel="I agree to the academy’s band policies." />
        </div></section>}
        {draft.step === 3 && <>
          <section className={styles.stack}><SectionTitle as="h2">{draft.pricing?.label || 'Monthly subscription'}</SectionTitle><div className={styles.stack}><strong>{student?.name} · {group?.name || 'Band program'}</strong><Input label={draft.pricing ? `Price per student ($) · ${draft.pricing.unit}` : 'Monthly price per member ($)'} readOnly={!!request} type="number" min="0.01" step="0.01" value={draft.monthlyPrice} onChange={event => patch({ monthlyPrice: event.target.value, subscriptionAccepted: false })} /><FieldGrid><Input label="Payer name" value={draft.payerName} onChange={event => patch({ payerName: event.target.value })} /><Input label="Payer email" type="email" value={draft.payerEmail} onChange={event => patch({ payerEmail: event.target.value })} /></FieldGrid></div></section>
          <section className={styles.stack}><SectionTitle as="h2">Payment method</SectionTitle><div className={styles.stack}><Select label="Payment method" value={draft.paymentMethod} onChange={event => patch({ paymentMethod: event.target.value as Draft['paymentMethod'] })}><option value="">Choose payment method</option><option value="demo_card">Visa ending in 4242</option></Select>{draft.paymentMethod === 'demo_card' && <EnrollmentCardPreview cardholder={draft.payerName} />}</div></section>
          <Checkbox label={draft.pricing ? `I authorize $${draft.monthlyPrice} ${draft.pricing.unit}${draft.pricing.recurring ? ' and recurring payments' : ''}.` : `I authorize the $${Number(draft.monthlyPrice || 0).toFixed(2)} monthly subscription and recurring payments.`} checked={draft.subscriptionAccepted} onChange={event => patch({ subscriptionAccepted: event.target.checked })} />
        </>}
        <ModalFooter leading={draft.step > 0 ? <Button type="button" variant="secondary" onClick={() => move(draft.step - 1)}>Back</Button> : undefined}><Button type="submit">{draft.step === 3 ? draft.pricing && !draft.pricing.recurring ? 'Pay & enroll' : 'Pay & subscribe' : 'Continue'}</Button></ModalFooter>
      </form>
    </SurfacePanel>
  </EnrollmentLayout>
}