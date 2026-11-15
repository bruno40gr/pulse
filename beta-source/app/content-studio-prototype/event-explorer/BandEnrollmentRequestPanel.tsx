'use client'

import { useState } from 'react'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { bandPricingPlans, bandPlanRates, eligibleBandDiscounts, quoteBandPrice, type BandPrice } from '@/beta-source/lib/academy-band-pricing'
import { pricingName, type SetupRecord, type SetupDiscount, type DiscountPolicy } from '../school-setup/setup-content'
import { Modal, ModalHeader, ModalBody } from '@/components/ui/Modal'
import { ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { ResponsiveDataTable } from '@/components/ui/DataGridTable'
import { bandRequestRecipient } from '@/beta-source/lib/academy-band-requests'
import type { ExplorerPerson } from '@/beta-source/lib/event-explorer'
import type { AcademyGroup } from '@/beta-source/lib/academy-explorer'
import { spacing } from '@/lib/tokens'

export default function BandEnrollmentRequestPanel({ band, ids, people, services, plans, discounts, discountPolicy, onClose, onSend }: {
  band: AcademyGroup; ids: string[]; people: ExplorerPerson[]; services: SetupRecord[]; plans: SetupRecord[]; discounts: SetupDiscount[]; discountPolicy: DiscountPolicy;
  onClose: () => void; onSend: (price: string, pricing: BandPrice) => void;
}) {
  const available = bandPricingPlans(services, plans)
  const [planId, setPlanId] = useState(available[0]?.plan.id || '')
  const [rateIndex, setRateIndex] = useState(0)
  const [discountIds, setDiscountIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const students = people.filter(person => ids.includes(person.id))
  const choice = available.find(item => item.plan.id === planId)
  const rates = choice ? bandPlanRates(choice.plan) : []
  const rate = rates.length ? rates[rateIndex]?.price || '' : choice?.plan.values.price || ''
  const eligible = eligibleBandDiscounts(discounts, students, people, new Date().toISOString().slice(0, 10))
  const quote = () => { if (!choice) throw new Error('Configure a pricing model for the Band service in School Setup.'); return quoteBandPrice(choice.service, choice.plan, rate, eligible.filter(discount => discountIds.includes(discount.id)), discountPolicy) }
  let summary = ''
  try { const price = quote(); summary = `$${price.amount} per student · ${price.unit}` } catch { /* Configuration warning below. */ }
  return <Modal isOpen onClose={onClose} size="wide" ariaLabel="Request enrollment">
    <ModalHeader title={`Request enrollment · ${band.name}`} onClose={onClose} />
    <ModalBody style={{ display: 'grid', gap: spacing.lg }}>
      {error && <Notice variant="error">{error}</Notice>}
      <ResponsiveDataTable stickyHeaderOffset={0} style={{ flexShrink: 0 }} emptyContent={null} ariaLabel="Enrollment request recipients" rows={students} getRowKey={person => person.id} minDesktopWidth={480} columns={[
        { id: 'student', header: 'Student', width: '1fr', render: person => person.name },
        { id: 'recipient', header: 'Account holder / recipient', width: '1.5fr', render: person => { const recipient = bandRequestRecipient(person, people); return <span>{recipient.name} · {recipient.email}</span> } },
      ]} />
      <p>This sends an email to the student or account holder so they can complete enrollment from their student portal.</p>
      {available.length ? <>
        <Select label="Band pricing model" value={planId} onChange={event => { setPlanId(event.target.value); setRateIndex(0); setDiscountIds([]) }}>{available.map(({ plan }) => <option key={plan.id} value={plan.id}>{pricingName(plan.values)}</option>)}</Select>
        {rates.length > 1 && <Select label="Session length" value={rateIndex} onChange={event => setRateIndex(Number(event.target.value))}>{rates.map((rate, index) => <option key={rate.minutes} value={index}>{rate.minutes} minutes · ${rate.price} per session</option>)}</Select>}
        {summary && <p aria-label="Price per student">{summary}</p>}
        {eligible.length > 0 && <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend>Available discounts</legend>{eligible.map(discount => <Checkbox key={discount.id} label={`${discount.name} · ${discount.unit === '%' ? `${discount.amount}%` : `$${discount.amount}`}`} checked={discountIds.includes(discount.id)} onChange={event => setDiscountIds(current => event.target.checked ? [...current, discount.id] : current.filter(id => id !== discount.id))} />)}</fieldset>}
      </> : <Notice variant="warning">Configure a pricing model for the Band service in School Setup before requesting enrollment.</Notice>}
    </ModalBody>
    <ModalFooter><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!choice || !rate} onClick={() => { try { const price = quote(); onSend(price.amount, price) } catch (cause) { setError((cause as Error).message) } }}>Send enrollment request</Button></ModalFooter>
  </Modal>
}