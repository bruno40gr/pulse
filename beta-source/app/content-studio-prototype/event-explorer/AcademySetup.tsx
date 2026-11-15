'use client'

import { useState } from 'react'
import SchoolSetup from '../school-setup/SchoolSetup'
import type { BookingContext } from '@/beta-source/lib/academy-calendar-booking'
import { createDemoSetup } from '@/beta-source/lib/odeon-demo-setup'
import { academyKinds, setOfferingEnabled, type AcademyKind, type AcademySettings } from '@/beta-source/lib/academy-explorer'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { Checkbox } from '@/components/ui/Checkbox'
import { SectionTitle } from '@/components/ui/SectionTitle'
import type { ExplorerEvent } from '@/beta-source/lib/event-explorer'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ParticipationPolicies } from '@/components/ui/ParticipationPolicies'
import { newExplorerEvent, eventPaymentHandling } from '@/beta-source/lib/event-explorer'
import type { EventDefaults } from '@/beta-source/lib/academy-explorer'
import { Notice } from '@/components/ui/Notice'
import type { SetupDiscount, DiscountPolicy, SetupRecord } from '../school-setup/setup-content'
import styles from './explorer.module.css'

export default function AcademySetup({ academy, onChange, onInstitution, onExit, configuredData, onDataChange, configuredDiscounts, configuredDiscountPolicy, onDiscountsChange, events, bookingContext }: { bookingContext?: BookingContext; academy: AcademySettings; onChange: (value: AcademySettings) => void; onInstitution: (kind: AcademyKind) => void; onExit: () => void; configuredDiscountPolicy?: DiscountPolicy; configuredDiscounts?: SetupDiscount[]; onDiscountsChange?: (discounts: SetupDiscount[], policy: DiscountPolicy) => void; configuredData?: Record<string, SetupRecord[]>; onDataChange: (value: Record<string, SetupRecord[]>) => void; events: ExplorerEvent[] }) {
  const [data] = useState(() => {
    if (configuredData) return configuredData
    const setup = createDemoSetup()
    setup.school[0].values.institutionType = academy.kind
    if (academy.kind !== 'music') {
      setup.school[0].values.name = academy.name
      setup.services = [{ ...setup.services[0], id: 'core-program', values: { ...setup.services[0].values, name: academy.kind === 'martial' ? 'Karate' : 'Math enrichment' } }]
      setup.teachers = []
      setup.locations = [{ id: 'main', values: { name: academy.name, address: '', city: '', state: '', postal: '' }, rooms: [] }]
    }
    return setup
  })
  const [error, setError] = useState('')
  const defaults = academy.eventDefaults || { ...newExplorerEvent('defaults'), paymentMethods: ['Card'] }
  const changeDefaults = (change: Partial<EventDefaults>) => onChange({ ...academy, eventDefaults: { access: defaults.access, hold: defaults.hold, allocation: defaults.allocation, cancellation: defaults.cancellation, waiver: defaults.waiver, questions: defaults.questions, paymentMethods: defaults.paymentMethods, paymentHandling: defaults.paymentHandling, ...change } })
  const changeType = (kind: AcademyKind) => {
    if (kind !== academy.kind && window.confirm('Use the suggested terminology for this institution? Existing academy work is retained separately when you switch back.')) onInstitution(kind)
  }
  const typesEditor = <div className={styles.stack}>
    <DenseSectionPanel title="Event registration defaults" headingLevel="h2"><div className={styles.stack}>
      <Select label="Who can register?" value={defaults.access} onChange={event => changeDefaults({ access: event.target.value })}>{['Open registration', 'Account required', 'Members only'].map(value => <option key={value}>{value}</option>)}</Select>
      <Input label="Checkout space hold (minutes)" type="number" min={0} step={1} value={defaults.hold} onChange={event => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 0) changeDefaults({ hold: event.target.value }) }} />
      <Select label="When selected sessions are full" value={defaults.allocation} onChange={event => changeDefaults({ allocation: event.target.value })}>{['All selected sessions must have space', 'Confirm available sessions; waitlist the rest'].map(value => <option key={value}>{value}</option>)}</Select>
      <Select label="Cancellation policy" value={defaults.cancellation} onChange={event => changeDefaults({ cancellation: event.target.value })}>{['Use academy default', 'Event-specific policy'].map(value => <option key={value}>{value}</option>)}</Select>
      <ParticipationPolicies agreements={[{ id: 'default', title: 'Default participation agreement', content: defaults.waiver }]} onChange={(_id, waiver) => changeDefaults({ waiver })} />
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}><legend>Accepted payment methods</legend><div className={styles.stack}>{['Cash', 'Card', 'PayPal', 'Zelle'].map(method => <div key={method} className={styles.stack}>
        <Checkbox label={method} checked={defaults.paymentMethods?.includes(method) || false} onChange={event => changeDefaults({ paymentMethods: event.target.checked ? [...(defaults.paymentMethods || []), method] : defaults.paymentMethods?.filter(value => value !== method) })} />
        {defaults.paymentMethods?.includes(method) && <Select label={`${method} payment confirmation`} value={eventPaymentHandling(defaults, method)} onChange={event => changeDefaults({ paymentHandling: { ...defaults.paymentHandling, [method]: event.target.value as 'online' | 'manual' } })}><option value="online">Online payment confirmation</option><option value="manual">Staff confirms payment manually</option></Select>}
      </div>)}</div></fieldset>
    </div></DenseSectionPanel>
    {error && <Notice variant="error" onDismiss={() => setError('')}>{error}</Notice>}
    {(['groupTypes', 'eventTypes'] as const).map(key => <section className={styles.stack} key={key} aria-labelledby={`${key}-heading`}>
      <div className={styles.stack}>
        <div id={`${key}-heading`}><SectionTitle as="h2">{key === 'groupTypes' ? 'Groups' : 'Events'}</SectionTitle></div>
        <p className={styles.muted}>{key === 'groupTypes' ? 'Enrolled students learning together on a recurring schedule. Membership continues between sessions.' : 'Dated activities with their own registration and capacity. Open to students or visitors, based on access settings.'}</p>
      </div>
      {academy[key].map(type => <DenseSectionPanel key={type.id} title={type.name} headingLevel="h3" actions={<Checkbox label={`Offer ${type.name}`} checked={type.enabled} aria-describedby={`${type.id}-description`} onChange={event => {
        try { onChange(setOfferingEnabled(academy, key, type.id, event.target.checked, events)); setError('') }
        catch (problem) { setError(problem instanceof Error ? problem.message : 'Unable to change availability.') }
      }} />}><div className={styles.stack}>
        <p id={`${type.id}-description`} className={styles.muted}>{type.description}</p>
        <p className={styles.muted}><strong>Example:</strong> {type.example}</p>
        <p className={styles.muted}><strong>You can configure:</strong> {type.settings}</p>
      </div></DenseSectionPanel>)}
    </section>)}
  </div>
  return <SchoolSetup bookingContext={bookingContext} configuredDiscountPolicy={configuredDiscountPolicy} configuredDiscounts={configuredDiscounts} onDiscountsChange={onDiscountsChange} billingSettings={<DenseSectionPanel title="Trial discount" headingLevel="h2"><Input label="Default trial discount (%)" type="number" min={0} max={100} value={academy.trialDiscount} onChange={event => { const value = Number(event.target.value); if (value >= 0 && value <= 100) onChange({ ...academy, trialDiscount: value }) }} /></DenseSectionPanel>} embedded demo configuredData={data} onConfiguredChange={onDataChange} companyName={academy.name} onExit={onExit} companySettings={<DenseSectionPanel title="Institution" headingLevel="h2"><div className={styles.stack}><Select label="Institution type" value={academy.kind} onChange={event => changeType(event.target.value as AcademyKind)}>{academyKinds.map(item => <option value={item.key} key={item.key}>{item.label}</option>)}</Select><Input label="Institution display name" value={academy.name} onChange={event => onChange({ ...academy, name: event.target.value })} /></div></DenseSectionPanel>} offeringTypes={typesEditor} />
}