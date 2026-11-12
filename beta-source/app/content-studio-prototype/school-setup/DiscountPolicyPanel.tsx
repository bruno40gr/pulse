'use client'

import { useState } from 'react'
import { Button } from '@/beta-source/components/ui/Button'
import { DenseSectionPanel } from '@/beta-source/components/ui/DenseSectionPanel'
import { FieldGrid } from '@/beta-source/components/ui/FieldGrid'
import { Select } from '@/beta-source/components/ui/Select'
import type { DiscountPolicy } from './setup-content'
import styles from './school-setup.module.css'

export default function DiscountPolicyPanel({ value, disabled, onSave, onDirty, onEditing }: { value: DiscountPolicy; disabled: boolean; onSave: (value: DiscountPolicy) => void; onDirty: (dirty: boolean) => void; onEditing: (editing: boolean) => void }) {
  const [draft, setDraft] = useState<DiscountPolicy | null>(null)
  const current = draft || value
  const dirty = JSON.stringify(current) !== JSON.stringify(value)
  const close = () => { setDraft(null); onDirty(false); onEditing(false) }
  const update = (next: DiscountPolicy) => { const changed = JSON.stringify(next) !== JSON.stringify(value); setDraft(next); onDirty(changed); onEditing(changed) }
  return <DenseSectionPanel title="Discount policy" headingLevel="h2" actions={dirty ? <Button type="submit" form="discount-policy" size="sm" disabled={disabled}>Save changes</Button> : undefined}>
    <p className={styles.sectionDescription}>Choose what happens when someone qualifies for more than one discount.</p>
    <form id="discount-policy" onSubmit={event => { event.preventDefault(); if (!disabled && dirty) { onSave(current); close() } }}><FieldGrid columns={1}>
      <Select label="When multiple discounts qualify" disabled={disabled} value={current.combination} onChange={event => update({ ...current, combination: event.target.value as DiscountPolicy['combination'] })}><option value="best">Apply the best single discount</option><option value="combine">Combine eligible discounts</option></Select>
      {current.combination === 'combine' && <Select label="Apply discounts in this order" disabled={disabled} value={current.order} onChange={event => update({ ...current, order: event.target.value as DiscountPolicy['order'] })}><option value="percentage-first">Percentage discounts first</option><option value="fixed-first">Fixed-amount discounts first</option></Select>}
    </FieldGrid><p className={styles.sectionDescription}>{current.combination === 'best' ? 'Use the discount that gives the largest dollar saving.' : 'Apply each discount to the remaining balance. The total cannot fall below $0.'}</p></form>
  </DenseSectionPanel>
}