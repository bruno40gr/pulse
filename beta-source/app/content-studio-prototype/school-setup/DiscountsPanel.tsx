'use client'

import { useState } from 'react'
import { BadgePercent, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/beta-source/components/ui/Button'
import { ControlButton } from '@/beta-source/components/ui/ControlButton'
import { DenseSectionPanel } from '@/beta-source/components/ui/DenseSectionPanel'
import { EmptyState } from '@/beta-source/components/ui/EmptyState'
import { FieldGrid } from '@/beta-source/components/ui/FieldGrid'
import { Input } from '@/beta-source/components/ui/Input'
import { Select } from '@/beta-source/components/ui/Select'
import { conditionComparisons, discountValueLabels, discountFields, evaluateDiscount, newDiscountCondition, discountConditionLabel, validateDiscount, type DiscountCondition, type DiscountFacts, type DiscountField, type DiscountPolicy, type SetupDiscount } from './setup-content'
import DiscountPolicyPanel from './DiscountPolicyPanel'
import styles from './school-setup.module.css'

export default function DiscountsPanel({ value, policy, onPolicySave, onSave, onDirty }: { policy: DiscountPolicy; onPolicySave: (policy: DiscountPolicy) => void; value: SetupDiscount[]; onSave: (value: SetupDiscount[]) => void; onDirty: (dirty: boolean) => void }) {
  const [policyEditing, setPolicyEditing] = useState(false)
  const [draft, setDraft] = useState<SetupDiscount | null>(null)
  const [initial, setInitial] = useState('')
  const [facts, setFacts] = useState<DiscountFacts>({})
  const [error, setError] = useState('')
  const cancel = () => { setDraft(null); setError(''); onDirty(false) }
  const edit = (discount?: SetupDiscount) => {
    const next: SetupDiscount = discount ? { ...discount, conditions: discount.conditions.map(condition => ({ ...condition })) } : { id: '', name: '', amount: '', unit: '%', match: 'all', conditions: [newDiscountCondition(crypto.randomUUID())] }
    setFacts({}); setDraft(next); setInitial(JSON.stringify(next)); setError('')
  }
  const update = (next: SetupDiscount) => { setDraft(next); setError(''); onDirty(JSON.stringify(next) !== initial) }
  const updateCondition = (id: string, changes: Partial<DiscountCondition>) => {
    if (draft) update({ ...draft, conditions: draft.conditions.map(condition => condition.id === id ? { ...condition, ...changes } : condition) })
  }
  return <><DiscountPolicyPanel value={policy} disabled={Boolean(draft)} onSave={onPolicySave} onDirty={onDirty} onEditing={setPolicyEditing} /><DenseSectionPanel title="Discounts" headingLevel="h2" actions={draft === null
    ? <Button type="button" size="sm" variant="secondary" disabled={policyEditing} onClick={() => edit()}><Plus size={14} aria-hidden="true" />Add discount</Button>
    : <div className={styles.headerActions}><Button type="button" size="sm" variant="secondary" onClick={cancel}>Cancel discount</Button><Button type="submit" form="school-discounts" size="sm">Save discount</Button></div>}>
    <p className={styles.sectionDescription}>Create percentage or fixed-amount discounts with your own names and eligibility conditions, separately from pricing models.</p>
    {draft ? <form id="school-discounts" noValidate onSubmit={event => {
      event.preventDefault()
      const message = validateDiscount(draft)
      if (message) { setError(message); return }
      const saved = { ...draft, id: draft.id || crypto.randomUUID(), name: draft.name.trim(), amount: String(Number(draft.amount)), conditions: draft.conditions.map(condition => ({ ...condition, value: condition.value.trim() })) }
      onSave(draft.id ? value.map(item => item.id === draft.id ? saved : item) : [...value, saved]); cancel()
    }}>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <FieldGrid columns={1}><Input label="Discount name" required value={draft.name} onChange={event => update({ ...draft, name: event.target.value })} /></FieldGrid>
      <div className={styles.formSection}><FieldGrid><Input label="Discount amount" type="number" min="0.01" max={draft.unit === '%' ? 100 : undefined} step="0.01" required value={draft.amount} onChange={event => update({ ...draft, amount: event.target.value })} /><Select label="Discount type" value={draft.unit} onChange={event => update({ ...draft, unit: event.target.value as SetupDiscount['unit'] })}><option value="%">Percentage (%)</option><option value="$">Fixed amount (USD)</option></Select></FieldGrid></div>
      <div className={styles.formSection}><FieldGrid><Input label="Starts on (optional)" type="date" value={draft.startsOn || ''} onChange={event => update({ ...draft, startsOn: event.target.value })} /><Input label="Ends on (optional)" type="date" min={draft.startsOn || undefined} value={draft.endsOn || ''} onChange={event => update({ ...draft, endsOn: event.target.value })} /></FieldGrid><p className={styles.sectionDescription}>Leave dates blank for no time limit. The discount applies through the end date in your school’s timezone.</p></div>
      <div className={styles.conditionStack}>
        <Select label="Qualify when" value={draft.match} onChange={event => update({ ...draft, match: event.target.value as SetupDiscount['match'] })}><option value="all">All conditions match</option><option value="any">Any condition matches</option></Select>
        <div className={styles.records}>{draft.conditions.map((condition, index) => <DenseSectionPanel key={condition.id} title={`Condition ${index + 1}`} headingLevel="h3" contentStyle={{ display: 'grid', gap: 22 }} actions={<ControlButton type="button" kind="icon" aria-label={`Remove condition ${index + 1}`} onClick={() => update({ ...draft, conditions: draft.conditions.filter(item => item.id !== condition.id) })}><Trash2 size={16} aria-hidden="true" /></ControlButton>}>
          <FieldGrid columns={1}>
            <Select label={`Condition ${index + 1} field`} value={condition.field} onChange={event => updateCondition(condition.id, newDiscountCondition(condition.id, event.target.value as DiscountField))}>{discountFields.map(field => <option key={field.key} value={field.key}>{field.label}</option>)}</Select>
            {condition.field !== 'familyStudents' && <Select label={`Condition ${index + 1} comparison`} value={condition.comparison} onChange={event => updateCondition(condition.id, { comparison: event.target.value as DiscountCondition['comparison'] })}>{conditionComparisons(condition.field).map(comparison => <option key={comparison.value} value={comparison.value}>{comparison.label}</option>)}</Select>}
            {condition.field !== 'familyStudents' && (() => {
              const field = discountFields.find(item => item.key === condition.field)!
              return field.type === 'choice' ? <Select label={discountValueLabels[condition.field]} value={condition.value} onChange={event => updateCondition(condition.id, { value: event.target.value })}>{field.options.map(option => <option key={option} value={option}>{option}</option>)}</Select>
                : <Input label={discountValueLabels[condition.field]} type="number" min={field.min} step={1} required value={condition.value} onChange={event => updateCondition(condition.id, { value: event.target.value })} />
            })()}
          </FieldGrid>
          {condition.field !== 'familyStudents' && <p className={styles.sectionDescription}>{discountConditionLabel(condition)}</p>}
          <p className={styles.sectionDescription}>{discountFields.find(field => field.key === condition.field)?.description}</p>
        </DenseSectionPanel>)}</div>
        <Button type="button" size="sm" variant="secondary" onClick={() => update({ ...draft, conditions: [...draft.conditions, newDiscountCondition(crypto.randomUUID())] })}><Plus size={14} aria-hidden="true" />Add condition</Button>
      </div>
      <DenseSectionPanel title="Check eligibility" headingLevel="h3" contentStyle={{ display: 'grid', gap: 22 }}>
        <p className={styles.sectionDescription}>Enter values for a case to see how this rule evaluates. These values are not saved with the discount.</p>
        <FieldGrid>{[...new Set(draft.conditions.map(condition => condition.field))].map(key => {
          const field = discountFields.find(item => item.key === key)!
          return key === 'familyStudents' ? <Select key={key} label="Another actively enrolled student in the same family?" value={facts[key] || ''} onChange={event => setFacts(current => ({ ...current, [key]: event.target.value }))}><option value="">Not provided</option><option value="2">Yes</option><option value="1">No</option></Select> : field.type === 'choice' ? <Select key={key} label={`Check ${field.label}`} value={facts[key] || ''} onChange={event => setFacts(current => ({ ...current, [key]: event.target.value }))}><option value="">Not provided</option>{field.options.map(option => <option key={option} value={option}>{option}</option>)}</Select>
            : <Input key={key} label={`Check ${field.label} (${field.unit})`} type="number" min={field.min} step={1} value={facts[key] || ''} onChange={event => setFacts(current => ({ ...current, [key]: event.target.value }))} />
        })}</FieldGrid>
        <p role="status">{evaluateDiscount(draft, facts) === 'eligible' ? 'Eligible' : evaluateDiscount(draft, facts) === 'not-eligible' ? 'Not eligible' : 'Cannot determine eligibility — complete the rule and provide the required values.'}</p>
      </DenseSectionPanel>
    </form> : value.length ? <ul className={styles.libraryList} aria-label="School discounts">{value.map(discount => <li key={discount.id} className={styles.libraryRow}>
      <div className={styles.materialEditorHeader}><strong>{discount.name}</strong><div className={styles.headerActions}><ControlButton type="button" kind="icon" aria-label={`Edit discount ${discount.name}`} disabled={policyEditing} onClick={() => edit(discount)}><Pencil size={16} aria-hidden="true" /></ControlButton><ControlButton type="button" kind="icon" aria-label={`Delete discount ${discount.name}`} disabled={policyEditing} onClick={() => { if (window.confirm(`Delete ${discount.name}?`)) onSave(value.filter(item => item.id !== discount.id)) }}><Trash2 size={16} aria-hidden="true" /></ControlButton></div></div>
      <p>{discount.unit === '%' ? `${discount.amount}%` : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(discount.amount))} off</p>
      {(discount.startsOn || discount.endsOn) && <p>{discount.startsOn ? `From ${discount.startsOn}` : 'Available now'}{discount.endsOn ? ` · Through ${discount.endsOn}` : ' · No end date'}</p>}
      <p>{discount.match === 'all' ? 'All conditions must match' : 'Any condition may match'}</p>
      <ul>{discount.conditions.map(condition => <li key={condition.id}>{discountConditionLabel(condition)}</li>)}</ul>
    </li>)}</ul> : <EmptyState variant="embedded" density="compact" icon={<BadgePercent size={28} aria-hidden="true" />} title="No discounts yet" description="Add a discount and set the conditions for who qualifies." />}
  </DenseSectionPanel></>
}
