'use client'

import { useState } from 'react'
import { ArrowRight, CheckCircle2, CreditCard, FlaskConical, Music2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { colors } from '@/lib/tokens'
import type { BookingRequestEvent, BookingRequestStatus } from '@/lib/academy-booking-request'
import { advanceRehearsal, createRehearsalRequests, rehearsalPrice, rehearsalSlots, type RehearsalRequest } from '@/lib/academy-booking-rehearsal'
import styles from './booking-requests.module.css'

const labels: Record<BookingRequestStatus, string> = {
  draft: 'Draft · card needed', awaiting_confirmation: 'Needs review', pending_payment: 'Pending payment',
  processing_payment: 'Simulating payment', confirmed: 'Confirmed · simulated', rejected: 'Declined',
}
const studentCopy: Record<BookingRequestStatus, string> = {
  draft: 'A card is required to submit your request. You won’t be charged until we confirm your lesson.',
  awaiting_confirmation: 'Your request is with our team. We’ll review your availability and agree a lesson time before collecting payment.',
  pending_payment: 'Your lesson has staff approval, but payment is still required. Your booking is not yet confirmed.',
  processing_payment: 'Payment is being simulated. Your booking is not yet confirmed.',
  confirmed: 'Your lesson is confirmed in this fictional rehearsal. No real booking or payment was made.',
  rejected: 'This request was declined in the rehearsal. No payment was collected.',
}

export default function BookingRequestRehearsal() {
  const [requests, setRequests] = useState(createRehearsalRequests)
  const [selected, setSelected] = useState('DEMO-101')
  const [filter, setFilter] = useState('all')
  const [message, setMessage] = useState('Select a fictional request to rehearse the workflow.')
  const request = requests.find(item => item.id === selected)!
  const reviewing = request.state.status === 'awaiting_confirmation'
  const canApprove = reviewing && request.identityResolved && Boolean(request.slot) && request.termsReviewed
  const visible = requests.filter(item => filter === 'all' || item.state.status === filter)

  function edit(patch: Partial<RehearsalRequest>) {
    setRequests(items => items.map(item => item.id === selected ? { ...item, ...patch } : item))
  }

  function advance(event: BookingRequestEvent) {
    try {
      const next = advanceRehearsal(request, event)
      setRequests(items => items.map(item => item.id === selected ? next : item))
      setMessage(next.history[next.history.length - 1])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to advance the rehearsal.')
    }
  }

  function reset() {
    setRequests(createRehearsalRequests())
    setSelected('DEMO-101')
    setFilter('all')
    setMessage('Rehearsal reset. All changes were local to this page.')
  }

  return <main className={styles.workspace} style={{ '--booking-accent': colors.espresso, '--booking-cream': colors.cream } as React.CSSProperties}>
    <div className={styles.banner}><FlaskConical size={17} aria-hidden="true" /><strong>Local rehearsal</strong><span>Fictional people. Simulated payments. Nothing is saved or sent. Refresh to reset.</span></div>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>ODEON / HEADLINER · LESSON OPERATIONS</p><h1>Good lessons start here.</h1><p className={styles.muted}>Review the request. Agree the details. Confirm only after payment.</p></div>
      <Button variant="secondary" onClick={reset}><RotateCcw size={15} aria-hidden="true" />Reset rehearsal</Button>
    </header>
    <div className={styles.stats}>
      {[['In staff review', requests.filter(item => item.state.status === 'awaiting_confirmation').length], ['Awaiting payment', requests.filter(item => ['pending_payment', 'processing_payment'].includes(item.state.status)).length], ['Confirmed · simulated', requests.filter(item => item.state.status === 'confirmed').length]].map(([label, count]) => <div key={label}><strong>{count}</strong><span>{label}</span></div>)}
    </div>
    <div className={styles.layout}>
      <aside className={styles.queue} aria-label="Fictional lesson requests">
        <div className={styles.queueHeading}><h2>Requests <span className={styles.muted}>({visible.length})</span></h2><label className={styles.field}>Show<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All requests</option><option value="awaiting_confirmation">Needs review</option><option value="pending_payment">Pending payment</option><option value="confirmed">Confirmed</option><option value="draft">Drafts</option><option value="rejected">Declined</option></select></label></div>
        {visible.length === 0 && <p className={styles.empty}>No requests in this view. Choose another filter.</p>}
        {visible.map(item => <button key={item.id} type="button" className={`${styles.request} ${selected === item.id ? styles.selected : ''}`} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setMessage(`Viewing ${item.name}’s fictional request.`) }}>
          <span className={styles.requestTop}><strong>{item.name}</strong><ArrowRight size={16} aria-hidden="true" /></span><span>{item.instrument} · {item.format.split(' · ')[0]}</span><span className={styles.badge}>{labels[item.state.status]}</span>
        </button>)}
        <p className={styles.queueFoot}>Three fictional scenarios: teacher benefit, identity review, and a missing card.</p>
      </aside>
      <section className={styles.detail} aria-label={`Request details for ${request.name}`}>
        <div className={styles.detailHeader}><div><p className={styles.eyebrow}>{request.id} · FICTIONAL REQUEST</p><h2>{request.name}</h2><p>{request.instrument} lessons · {request.format}</p></div><span className={styles.badge}>{labels[request.state.status]}</span></div>
        <div className={styles.detailBody}>
          <section className={styles.section}><h3><Music2 size={17} aria-hidden="true" />Find the right lesson</h3><p className={styles.muted}>Requested availability</p><p>{request.availability}</p><blockquote>{request.note}</blockquote>
            <label className={styles.field}>Agreed teacher & time (fictional example)
              <select value={request.slot} disabled={!reviewing} onChange={event => edit({ slot: event.target.value, termsReviewed: false })}><option value="">Choose a proposed match…</option>{rehearsalSlots.map(slot => <option key={slot}>{slot}</option>)}</select>
            </label><p className={styles.small}>Illustrative weekly times only—not calendar availability, a dated agreement, or a reserved slot. Selecting a match stands in for agreement during this rehearsal.</p>
          </section>
          <section className={styles.section}><h3><CheckCircle2 size={17} aria-hidden="true" />Identity & eligibility</h3>
            {request.identityResolved ? <p>Identity resolved in fixture. {request.teacherBenefit ? 'Explicitly active teacher · 50% benefit on this enrollment.' : 'Standard pricing · no teacher benefit applied.'}</p> : <><p className={styles.warning}>Same name, different email. No automatic merge or teacher benefit.</p><Button variant="secondary" onClick={() => { edit({ identityResolved: true, termsReviewed: false, history: [...request.history, 'Identity review simulated: keep separate; no teacher benefit.'] }); setMessage('Identity resolved as a separate person in this rehearsal. No benefit applied.') }}>Simulate review: keep as separate person</Button></>}
          </section>
          <section className={styles.section}><h3><CreditCard size={17} aria-hidden="true" />Pricing & payment</h3>
            <div className={styles.priceRow}><span>30-minute lesson · illustrative price</span><span>$50.00</span></div>
            {request.identityResolved && request.teacherBenefit && <div className={styles.priceRow}><span>Active teacher benefit · 50%</span><span>−$25.00</span></div>}
            <div className={`${styles.priceRow} ${styles.total}`}><strong>Per lesson</strong><strong>${rehearsalPrice(request).toFixed(2)}</strong></div>
            <p className={styles.small}>USD fixture amounts, not a saved offer or billing schedule. Discounts do not stack. Recurring invoices and offer changes are not simulated.</p>
            <p>{request.cardReady ? '✓ Card ready · simulated evidence only' : 'Card missing · request cannot enter staff review'}</p>
            {request.state.status === 'draft' && <div className={styles.actions}><Button variant="secondary" disabled={request.cardReady} onClick={() => { edit({ cardReady: true }); setMessage('Card readiness simulated. No card details collected.') }}>Simulate ready card</Button><Button disabled={!request.cardReady} onClick={() => advance({ type: 'submit', cardReady: request.cardReady })}>Submit booking request</Button></div>}
          </section>
          {reviewing && <section className={styles.section}>
            <label className={styles.checkbox}><input type="checkbox" checked={request.termsReviewed} onChange={event => edit({ termsReviewed: event.target.checked })} />I reviewed the fictional teacher/time and ${rehearsalPrice(request).toFixed(2)} per-lesson terms.</label>
            <p className={styles.small}>Approval permits the simulated payment step; it does not confirm the booking.</p>
            <div className={styles.actions}><Button disabled={!canApprove} onClick={() => advance({ type: 'approve' })}>Simulate staff approval <ArrowRight size={15} aria-hidden="true" /></Button><Button variant="secondary" onClick={() => advance({ type: 'reject' })}>Decline request</Button></div>
            {!canApprove && <p className={styles.small}>Before approval: resolve identity, choose an agreed slot, and review the terms.</p>}
          </section>}
          {request.state.status === 'pending_payment' && <section className={styles.section}><h3>Payment simulator</h3><p>Approval is complete. Required payment has not succeeded.</p><Button onClick={() => advance({ type: 'start_payment', attemptId: `${request.id}-attempt-${request.history.length}` })}>Start simulated payment</Button></section>}
          {request.state.status === 'processing_payment' && <section className={styles.section}><h3>Choose a fictional payment outcome</h3><div className={styles.actions}><Button onClick={() => advance({ type: 'payment_succeeded', attemptId: request.state.paymentAttemptId! })}>Simulate success</Button><Button variant="secondary" onClick={() => advance({ type: 'payment_failed', attemptId: request.state.paymentAttemptId! })}>Simulate failure</Button></div></section>}
        </div>
      </section>
      <aside className={styles.preview}>
        <p className={styles.eyebrow}>STUDENT STATUS PREVIEW</p><h2>{labels[request.state.status]}</h2><p>{studentCopy[request.state.status]}</p>
        <div className={styles.previewSummary}><strong>{request.instrument} · 30 minutes</strong><p>{request.slot || 'Teacher & time not yet agreed'}</p><strong>${rehearsalPrice(request).toFixed(2)} per lesson</strong></div>
        <p className={styles.small}>Preview only. No student can see this, and no notification is sent.</p>
        <h3 className={styles.activityHeading}>Rehearsal activity</h3><ol className={styles.timeline}>{request.history.map((entry, index) => <li key={`${request.id}-${index}`}>{entry}</li>)}</ol>
      </aside>
    </div>
    <p role="status" aria-live="polite" className={styles.notice}>{message}</p>
    <footer className={styles.footer}>Design rehearsal, not an enrollment system. No scheduling, authorization, provider verification, persistence or real collection is implemented here.</footer>
  </main>
}