'use client'

import { ConfirmActionButton } from './ConfirmActionButton'
import { IssueInvoice } from './IssueInvoice'

import { useContext, useId, useState, type FormEvent } from 'react'
import { InlineWorkspaceContext } from './InlineWorkspaceContext'
import { Button, DenseSectionPanel, DetailField, EmptyState, FieldGrid, FieldValue, Input, Modal, ModalBody, ModalHeader, Select, SurfacePanel } from '@/beta-source/components/ui'
import { accountPayers, accountStudents, invoiceOutstanding, invoiceTotal, type FamilyAction, type FamilyPreviewData, type PreviewAccount } from '@/beta-source/lib/academy-family-preview'
import { previewMoney, previewStudentName } from '@/beta-source/lib/academy-student-preview'
import { statementInvoice } from '@/beta-source/lib/academy-invoice-document'
import { downloadInvoice, InvoicePayControls } from './InvoicePreview'
import { enrollmentGroupPrograms, enrollmentInstruments, enrollmentServices, newLesson, type EnrollmentPerson, type LessonChoice } from '@/beta-source/lib/academy-staff-enrollment'
import { colors, spacing, typography } from '@/beta-source/lib/tokens'
import { AccountWorkspace } from './AccountWorkspace'
import { PersonPicker } from '../enrollment/StaffEnrollment'
import LessonSchedule from '../enrollment/LessonSchedule'
import styles from './StudentWorkspace.module.css'

export type ManagementIntent = { kind: 'child' | 'enrollment' | 'subscription' | 'payment' | 'cards' | 'invoice' | 'pay' | 'pay-all' | 'statement'; studentId?: string; enrollmentId?: string; invoiceId?: string; invoiceIds?: string[] }
type Props = { payerOptions?: { id: string; name: string }[]; onOpenBillingAccount?: () => void; onRecurringSchedule?: (enrollmentId: string) => void; previewV2?: boolean; studentId?: string; data: FamilyPreviewData; account: PreviewAccount; intent: ManagementIntent; onApply: (action: FamilyAction) => string | null; onClose: () => void; paymentFormId?: string }
const stack = { display: 'flex', flexDirection: 'column' as const, gap: spacing.lg }
const titles = { child: 'Add child', enrollment: 'Add subscription', subscription: 'Manage subscription', payment: 'Change payer', cards: 'Manage credit cards', invoice: 'Create invoice', pay: 'Pay', 'pay-all': 'Pay all invoices', statement: 'Create statement' }

export function WorkspaceManagement(props: Props) {
  const [invoiceRequestKey] = useState(() => crypto.randomUUID())
  const invoiceId = `DEMO-${invoiceRequestKey.slice(0, 8).toUpperCase()}`
  const student = accountStudents(props.data, props.account).find(person => person.id === (props.intent.studentId || props.studentId))
  return <AccountWorkspace profileSubtitle={student ? 'Student profile' : 'Account manager'} title={props.intent.kind === 'invoice' ? `Create invoice · ${invoiceId}` : titles[props.intent.kind]} accountName={student ? previewStudentName(student) : props.account.holderName} onBack={props.onClose}>
    {props.intent.kind === 'invoice' ? <IssueInvoice {...props} requestKey={invoiceRequestKey} invoiceId={invoiceId} /> : props.intent.kind === 'subscription' ? <SubscriptionManagement {...props} /> : props.intent.kind === 'child' ? <ChildForm {...props} /> : props.intent.kind === 'enrollment' ? <EnrollmentForm {...props} /> : props.intent.kind === 'cards' ? <Cards {...props} /> : (props.intent.kind === 'pay' || props.intent.kind === 'pay-all') ? <PayInvoiceForm {...props} /> : props.intent.kind === 'statement' ? <StatementForm {...props} /> : <BillingForm {...props} />}
  </AccountWorkspace>
}

function SubscriptionManagement(props: Props) {
  const inline = useContext(InlineWorkspaceContext)
  const paymentFormId = useId()
  const [level, setLevel] = useState('')
  const [duration, setDuration] = useState('')
  const [error, setError] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const student = accountStudents(props.data, props.account).find(person => person.enrollments.some(item => item.id === props.intent.enrollmentId))
  const enrollment = student?.enrollments.find(item => item.id === props.intent.enrollmentId)
  if (!student || !enrollment) return <EmptyState title="Subscription unavailable" />
  function change(action: FamilyAction) { const message = props.onApply(action); setError(message || ''); if (!message) props.onClose() }
  return <div className={`${styles.subscriptionManagement} ${inline ? styles.subscriptionManagementInline : ''}`}>
    <DenseSectionPanel title={`${enrollment.program} • ${enrollment.duration} min`} actions={props.onRecurringSchedule && <Button variant="secondary" disabled={enrollment.frequency !== 'Weekly' || Boolean(enrollment.lifecycle) || enrollment.status !== 'active'} onClick={() => props.onRecurringSchedule?.(enrollment.id)}>Change recurring schedule</Button>}>
      <FieldGrid><DetailField label="Student" value={previewStudentName(student)} /><DetailField label="Level" value={`Level ${enrollment.level}`} /><DetailField label="Instructor" value={enrollment.teacher} /><DetailField label="Regular time" value={`${enrollment.day} at ${enrollment.time}`} /></FieldGrid>
    </DenseSectionPanel>
    <div className={styles.stack} style={{ gap: spacing.lg }}>
    <DenseSectionPanel title="Payer" actions={<Button type="submit" form={paymentFormId}>Save payer</Button>}><BillingForm {...props} paymentFormId={paymentFormId} /></DenseSectionPanel>
    {props.previewV2 ? <>
      {error && <p role="alert">{error}</p>}
      <DenseSectionPanel title="Update subscription" actions={<Button disabled={enrollment.lifecycle === 'cancelled'} onClick={() => change({ kind: 'update-subscription', accountId: props.account.id, enrollmentId: enrollment.id, level: Number(level || enrollment.level) as 1 | 2 | 3, duration: Number(duration || enrollment.duration) })}>Save subscription</Button>}>
        <FieldGrid><Select label="Level" value={level || enrollment.level} onChange={event => setLevel(event.target.value)}>{[1, 2, 3].map(value => <option key={value} value={value}>Level {value}</option>)}</Select><Select label="Duration" value={duration || enrollment.duration} onChange={event => setDuration(event.target.value)}>{[30, 45, 60].map(value => <option key={value} value={value}>{value} minutes</option>)}</Select></FieldGrid>
      </DenseSectionPanel>
      <DenseSectionPanel title="Subscription status" actions={enrollment.lifecycle !== 'cancelled' ? <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}><Button variant="secondary" onClick={() => change({ kind: 'subscription-state', accountId: props.account.id, enrollmentId: enrollment.id, state: enrollment.lifecycle === 'frozen' ? 'active' : 'frozen' })}>{enrollment.lifecycle === 'frozen' ? 'Resume subscription' : 'Freeze subscription'}</Button><Button variant="destructive" onClick={() => setConfirmCancel(true)}>Cancel subscription</Button></div> : undefined}>
        <FieldValue>{enrollment.lifecycle || enrollment.status}</FieldValue>
        {confirmCancel && <div role="alert"><p>Cancel this subscription? Its future lessons will disappear from this preview calendar. Existing invoices are kept.</p><ConfirmActionButton variant="destructive" onClick={() => change({ kind: 'subscription-state', accountId: props.account.id, enrollmentId: enrollment.id, state: 'cancelled' })}>Confirm cancellation</ConfirmActionButton><Button variant="secondary" onClick={() => setConfirmCancel(false)}>Keep subscription</Button></div>}
        <p style={typography.bodySmall}>Local preview only. Freeze hides future lessons until resumed. No refunds, billing changes or live subscription integration. {props.onRecurringSchedule ? 'Change recurring schedule updates upcoming regular lessons after availability checks and confirmation.' : 'Updates here cover level and duration; recurring teacher/time changes are not available.'}</p>
      </DenseSectionPanel>
    </> : <p style={typography.bodySmall}>Local preview: payer changes are available here. Recurring schedule changes, pauses and ending a subscription are not available yet.</p>}
    </div>
  </div>
}

export function PayInvoiceForm({ data, account, intent, onApply, onClose, onOpenBillingAccount, payerOptions }: Props) {
  const invoices = data.invoices.filter(item => item.accountId === account.id && (intent.kind === 'pay-all' ? intent.invoiceIds?.includes(item.id) : item.id === intent.invoiceId))
  const [error, setError] = useState('')
  if (!invoices.length || invoices.some(invoice => invoice.status !== 'Open')) return <EmptyState title="No payable invoices" />
  const combined = { ...statementInvoice(invoices), payerId: invoices[0].payerId }
  return <DenseSectionPanel title="Payment review">
    <div style={{ ...stack, marginBottom: spacing.lg }}>{invoices.map(invoice => <div key={invoice.id} style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }}><div><div>{invoice.id} · {invoice.payerName}</div><div>For {Array.from(new Set(invoice.lines.map(line => line.studentName))).join(', ')}</div></div><strong>{previewMoney(invoiceOutstanding(invoice), 'USD')}</strong></div>)}</div>
    {error && <p role="alert">{error}</p>}
    <InvoicePayControls billingAccountName={account.holderName} onOpenBillingAccount={payerId => { if (payerId === account.holderId && onOpenBillingAccount) { onClose(); onOpenBillingAccount() } }} billingAccountPayerId={onOpenBillingAccount ? account.holderId : undefined} invoice={combined} payers={payerOptions || accountPayers(data, account)} cards={data.cards.filter(card => card.accountId === account.id)} onPay={(payerId, cardId) => {
      const message = onApply(intent.kind === 'pay-all' ? { kind: 'pay-invoices', accountId: account.id, invoiceIds: invoices.map(invoice => invoice.id), payerId, cardId } : { kind: 'pay-invoice', accountId: account.id, invoiceId: invoices[0].id, payerId, cardId })
      if (message) setError(message); else onClose()
    }} />
  </DenseSectionPanel>
}

function StatementForm({ data, account }: Props) {
  const invoices = data.invoices.filter(item => item.accountId === account.id && item.status !== 'Replaced')
  const [selected, setSelected] = useState<string[]>(invoices.map(item => item.id))
  const chosen = invoices.filter(item => selected.includes(item.id))
  const statement = chosen.length ? statementInvoice(chosen) : null
  return <>
    <DenseSectionPanel title="Invoices">
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>{invoices.map(invoice => <label key={invoice.id} style={{ ...typography.bodySmall, display: 'flex', alignItems: 'center', gap: spacing.sm }}><input type="checkbox" checked={selected.includes(invoice.id)} onChange={event => setSelected(current => event.target.checked ? [...current, invoice.id] : current.filter(id => id !== invoice.id))} />{invoice.id} · {invoice.lines[0]?.studentName} · {invoice.lines[0]?.program} · {previewMoney(invoiceTotal(invoice), 'USD')}</label>)}{!invoices.length && <span style={typography.bodySmall}>No invoices.</span>}</div>
    </DenseSectionPanel>
    {statement ? <>
      <DenseSectionPanel title="Statement">
        {statement.lines.map((line, index) => <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.sm, padding: `${spacing.sm} 0`, borderBottom: `1px solid ${colors.border}` }}><span style={typography.body}>{line.studentName} · {line.program}</span><span style={typography.body}>{previewMoney(line.quantity * line.unitMinor, 'USD')}</span></div>)}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: spacing.md }}><FieldValue>{previewMoney(invoiceTotal(statement), 'USD')}</FieldValue></div>
      </DenseSectionPanel>
      <Button onClick={() => downloadInvoice(statement)}>Download statement</Button>
    </> : <EmptyState title="Select invoices to combine" />}
  </>
}

function ChildForm({ account, onApply, onClose }: Props) {
  const [person, setPerson] = useState<EnrollmentPerson | null>(null)
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    const error = onApply({ kind: 'child', accountId: account.id, id: `preview:${crypto.randomUUID()}`, firstName: person?.firstName || '', lastName: person?.lastName || '', email: person?.email, phone: person?.phone, birthday: person?.birthday })
    if (error) setError(error); else onClose()
  }
  return <form onSubmit={submit} style={stack}>
    <PersonPicker title="Child" studentLookup={false} value={person} people={[]} onChange={setPerson} onAdd={setPerson} />
    {error && <p role="alert">{error}</p>}
    <Button type="submit">Add child</Button>
  </form>
}

function EnrollmentForm({ account, data, onApply, onClose, intent, studentId: profileStudentId }: Props) {
  const students = accountStudents(data, account)
  const [studentId, setStudentId] = useState(() => students.find(student => student.id === (intent.studentId || profileStudentId))?.id || students[0]?.id || '')
  const [lesson, setLesson] = useState<LessonChoice>(() => newLesson(`preview:${crypto.randomUUID()}`))
  const [price, setPrice] = useState('50')
  const [monthlyQuantity, setMonthlyQuantity] = useState('4')
  const [level, setLevel] = useState<1 | 2 | 3>(1)
  const [payerId, setPayerId] = useState(account.holderId)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'details' | 'schedule' | 'payment'>('details')
  const student = students.find(person => person.id === studentId)
  const asPerson = (person: typeof student): EnrollmentPerson | null => person ? { ...person, activeTeacher: false } : null
  const manager: EnrollmentPerson = { id: account.holderId, firstName: account.holderName, lastName: '', email: account.email, phone: '', activeTeacher: false }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (step === 'details') { setStep('schedule'); return }
    if (step === 'schedule') {
      if (!lesson.teacher || !lesson.start || !lesson.time) { setError('Choose a teacher and time.'); return }
      setError(''); setStep('payment'); return
    }
    const error = onApply({ kind: 'enrollment', accountId: account.id, enrollment: {
      id: lesson.id, studentId, level, service: lesson.service, program: lesson.instrument, teacher: lesson.teacher, day: lesson.day, time: lesson.time, duration: Number(lesson.duration), start: lesson.start, frequency: lesson.frequency === 'Monthly subscription' ? 'Weekly' : 'One-off', amountMinor: Math.round(Number(price) * 100), currency: 'USD', priceUnit: 'per lesson', monthlyQuantity: Number(monthlyQuantity), collection: lesson.frequency === 'Monthly subscription' ? 'Monthly · 1st of the month' : 'Per lesson', payerId, paymentMethod: data.cards.find(card => card.accountId === account.id && card.payerId === payerId && card.isDefault)?.label || 'Not added', status: 'active',
    } })
    if (error) setError(error); else onClose()
  }
  return <form onSubmit={submit} style={stack}>
    {step === 'details' ? <FieldGrid>
      <Select label="Student" value={studentId} onChange={event => { setStudentId(event.target.value); setLesson({ ...lesson, teacher: '', start: '', time: '' }) }}>{students.map(person => <option key={person.id} value={person.id}>{previewStudentName(person)}</option>)}</Select>
      <Select label="Service" value={lesson.service} onChange={event => { const service = event.target.value as LessonChoice['service']; setLesson({ ...lesson, service, instrument: service === 'Group' ? 'Tiny Keys' : 'Piano', duration: service === 'Group' || service === 'Semi-private' ? '45' : '30', teacher: '', start: '', time: '' }) }}>{enrollmentServices.map(service => <option key={service}>{service}</option>)}</Select>
      <Select label="Program" value={lesson.instrument} onChange={event => setLesson({ ...lesson, instrument: event.target.value, ...(lesson.service === 'Group' ? { duration: event.target.value === 'Band Program' ? '60' : '45' } : {}), teacher: '', start: '', time: '' })}>{(lesson.service === 'Group' ? enrollmentGroupPrograms : enrollmentInstruments).map(program => <option key={program}>{program}</option>)}</Select>
      <Select label="Duration" disabled={lesson.service === 'Group'} value={lesson.duration} onChange={event => setLesson({ ...lesson, duration: event.target.value, teacher: '', start: '', time: '' })}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></Select>
      <Select label="Cadence" value={lesson.frequency} onChange={event => setLesson({ ...lesson, frequency: event.target.value })}><option value="Monthly subscription">Weekly</option><option value="À-la-carte">One lesson</option></Select>
      {lesson.frequency === 'Monthly subscription' && <Input label="Lessons billed per month" type="number" required min={1} max={100} step={1} value={monthlyQuantity} onChange={event => setMonthlyQuantity(event.target.value)} />}
      <Select label="Level" value={level} onChange={event => setLevel(Number(event.target.value) as 1 | 2 | 3)}>{[1, 2, 3].map(value => <option key={value} value={value}>Level {value}</option>)}</Select>
    </FieldGrid> : step === 'schedule' ? <>
      <LessonSchedule compactCopy lesson={{ ...lesson, studentId }} lessons={[{ ...lesson, studentId }]} student={asPerson(student)} students={students.map(person => asPerson(person)!)} manager={manager} onChange={patch => setLesson({ ...lesson, ...patch })} />
    </> : <>
      <p style={typography.body}>Payment · {student?.firstName} · {lesson.instrument}</p>
      <Input label="Price per lesson" type="number" min="0" step="0.01" required value={price} onChange={event => setPrice(event.target.value)} />
      <Select label="Payer" value={payerId} onChange={event => setPayerId(event.target.value)}>{accountPayers(data, account).map(payer => <option key={payer.id} value={payer.id}>{payer.name}</option>)}</Select>
    </>}
    {error && <p role="alert">{error}</p>}
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.sm }}>{step !== 'details' ? <Button type="button" variant="ghost" onClick={() => { setStep(step === 'payment' ? 'schedule' : 'details'); setError('') }}>{step === 'payment' ? 'Back to scheduling' : 'Back to lesson details'}</Button> : <span />}<Button type="submit" disabled={!students.length}>{step === 'details' ? 'Choose time' : step === 'schedule' ? 'Continue to payment' : 'Add subscription'}</Button></div>
  </form>
}

function BillingForm({ data, account, intent, onApply, onClose, paymentFormId }: Props) {
  const enrollments = accountStudents(data, account).flatMap(student => student.enrollments.map(enrollment => ({ student, enrollment })))
  const [enrollmentId, setEnrollmentId] = useState(intent.enrollmentId || enrollments[0]?.enrollment.id || '')
  const selected = enrollments.find(item => item.enrollment.id === enrollmentId)?.enrollment
  const [payerId, setPayerId] = useState(selected?.payerId || account.holderId)
  const cardIdFor = (enrollment: typeof selected, forPayer: string) => data.cards.find(card => card.accountId === account.id && card.payerId === forPayer && card.label === enrollment?.paymentMethod)?.id || data.cards.find(card => card.accountId === account.id && card.payerId === forPayer && card.isDefault)?.id || ''
  const [cardId, setCardId] = useState(cardIdFor(selected, selected?.payerId || account.holderId))
  const payerCards = data.cards.filter(card => card.accountId === account.id && card.payerId === payerId)
  const collection = selected?.collection || 'Monthly · 1st of the month'
  const [error, setError] = useState('')
  function pickEnrollment(id: string, syncPayment: boolean) {
    setEnrollmentId(id)
    const item = enrollments.find(entry => entry.enrollment.id === id)?.enrollment
    if (item && syncPayment) { setPayerId(item.payerId); setCardId(cardIdFor(item, item.payerId)) }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    const action: FamilyAction = { kind: 'payment', accountId: account.id, enrollmentId, payerId, collection, cardId }
    const error = onApply(action)
    if (error) setError(error); else onClose()
  }
  return <form id={paymentFormId} onSubmit={submit} style={stack}>
    {!intent.enrollmentId
      ? <Select label="Subscription" value={enrollmentId} onChange={event => pickEnrollment(event.target.value, true)}>{enrollments.map(({ student, enrollment }) => <option key={enrollment.id} value={enrollment.id}>{student.firstName} · {enrollment.program}</option>)}</Select>
      : <div style={typography.body}>{enrollments.find(item => item.enrollment.id === enrollmentId)?.student.firstName} · {selected?.program}</div>}
    <>
      <Select label="Payer" value={payerId} onChange={event => { const nextPayer = event.target.value; setPayerId(nextPayer); setCardId(cardIdFor(undefined, nextPayer)) }}>{accountPayers(data, account).map(payer => <option key={payer.id} value={payer.id}>{payer.name}</option>)}</Select>
      <Select label="Card on file" value={cardId} onChange={event => setCardId(event.target.value)}>{payerCards.map(card => <option key={card.id} value={card.id}>{card.label}{card.cardholderName ? ` · ${card.cardholderName}` : ''}{card.isDefault ? ' · Default' : ''}</option>)}{!payerCards.length && <option value="">No card on file</option>}</Select>
    </>
    {error && <p role="alert">{error}</p>}{!paymentFormId && <div><Button type="submit" disabled={!enrollmentId}>Save payment</Button></div>}
  </form>
}

export function Cards({ data, account, onApply, payerOptions }: Props) {
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [payerId, setPayerId] = useState(account.holderId)
  const [preset, setPreset] = useState<'visa' | 'mastercard'>('visa')
  const [cardholderName, setCardholderName] = useState(account.holderName)
  const [authorized, setAuthorized] = useState(false)
  const [error, setError] = useState('')
  const payers = payerOptions || accountPayers(data, account)
  const cards = data.cards.filter(card => card.accountId === account.id)
  const removing = cards.find(card => card.id === removeId)
  const replacement = removing && cards.find(card => card.id !== removing.id && card.payerId === removing.payerId)
  function apply(action: FamilyAction) { setError(onApply(action) || '') }
  return <div style={stack}>
    <Modal isOpen={Boolean(removing)} onClose={() => setRemoveId(null)} ariaLabel="Remove saved card"><ModalHeader title="Remove saved card" onClose={() => setRemoveId(null)} /><ModalBody><p>Remove {removing?.label}? Recorded payments and invoice history will not be deleted.</p>{removing?.isDefault && <p>{replacement ? `${replacement.label} will become the default card for this payer.` : 'This payer will have no saved default card. Add a card before collecting future card payments.'}</p>}<div style={{ display: 'flex', gap: spacing.sm }}><Button variant="secondary" onClick={() => setRemoveId(null)}>Cancel</Button><ConfirmActionButton onClick={() => { if (!removing) return; const message = onApply({ kind: 'remove-card', accountId: account.id, cardId: removing.id }); setError(message || ''); if (!message) setRemoveId(null) }}>Confirm remove card</ConfirmActionButton></div>{error && <p role="alert">{error}</p>}</ModalBody></Modal>
    {cards.map(card => <DenseSectionPanel key={card.id} title={card.label} actions={<div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}><Button size="sm" variant="secondary" disabled={card.isDefault} aria-label={`Set ${card.label} as default`} onClick={() => apply({ kind: 'default-card', accountId: account.id, cardId: card.id })}>{card.isDefault ? 'Default' : 'Set default'}</Button><Button size="sm" variant="ghost" aria-label={`Remove ${card.label}`} onClick={() => { setError(''); setRemoveId(card.id) }}>Remove</Button></div>}><div style={typography.bodySmall}>Name on card: {card.cardholderName || payers.find(payer => payer.id === card.payerId)?.name}<br />Saved for: {payers.find(payer => payer.id === card.payerId)?.name} · Expires {card.expires}</div></DenseSectionPanel>)}
    {!cards.length && <SurfacePanel appearance="flat" tone="muted">No saved cards.</SurfacePanel>}
    <form style={stack} onSubmit={event => { event.preventDefault(); if (!authorized) { setError('Confirm you are authorized to use this card.'); return }; const message = onApply({ kind: 'add-card', accountId: account.id, payerId, cardholderName, id: `preview:${crypto.randomUUID()}`, preset }); setError(message || ''); if (!message) setAuthorized(false) }}>
      <FieldGrid><Input label="Name on card" autoComplete="cc-name" required maxLength={120} value={cardholderName} onChange={event => setCardholderName(event.target.value)} /><Select label="Save card for" value={payerId} onChange={event => setPayerId(event.target.value)}>{payers.map(payer => <option key={payer.id} value={payer.id}>{payer.name}</option>)}</Select><Select label="Sample card" value={preset} onChange={event => setPreset(event.target.value as typeof preset)}><option value="visa">Visa ···· 4242</option><option value="mastercard">Mastercard ···· 4444</option></Select></FieldGrid>
      <label style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}><input type="checkbox" required checked={authorized} onChange={event => setAuthorized(event.target.checked)} />I am authorized to use this card</label>
      <div><Button type="submit">Add card</Button></div>
    </form>{error && <p role="alert">{error}</p>}
  </div>
}