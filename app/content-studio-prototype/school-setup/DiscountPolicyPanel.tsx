'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { Select } from '@/components/ui/Select'
import type { DiscountPolicy } from './setup-content'
import styles from './school-setup.module.css'

export default function DiscountPolicyPanel({ value, disabled, onSave, onDirty, onEditing }: { value: DiscountPolicy; disabled: boolean; onSave: (value: DiscountPolicy) => void; onDirty: (dirty: boolean) => void; onEditing: (editing: boolean) => void }) {
  const [draft, setDraft] = useState<DiscountPolicy | null>(null)
  const close = () => { setDraft(null); onDirty(false); onEditing(false) }
  const update = (next: DiscountPolicy) => { setDraft(next); onDirty(JSON.stringify(next) !== JSON.stringify(value)) }
  return <DenseSectionPanel title="Discount policy" headingLevel="h2" actions={draft ? <div className={styles.headerActions}><Button type="button" size="sm" variant="secondary" onClick={close}>Cancel policy</Button><Button type="submit" form="discount-policy" size="sm">Save policy</Button></div> : <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => { setDraft({ ...value }); onEditing(true) }}>Edit policy</Button>}>
    <p className={styles.sectionDescription}>Choose what happens when someone qualifies for more than one discount.</p>
    {draft ? <form id="discount-policy" onSubmit={event => { event.preventDefault(); onSave(draft); close() }}><FieldGrid columns={1}>
      <Select label="When multiple discounts qualify" value={draft.combination} onChange={event => update({ ...draft, combination: event.target.value as DiscountPolicy['combination'] })}><option value="best">Apply the best single discount</option><option value="combine">Combine eligible discounts</option></Select>
      {draft.combination === 'combine' && <Select label="Apply discounts in this order" value={draft.order} onChange={event => update({ ...draft, order: event.target.value as DiscountPolicy['order'] })}><option value="percentage-first">Percentage discounts first</option><option value="fixed-first">Fixed-amount discounts first</option></Select>}
    </FieldGrid><p className={styles.sectionDescription}>{draft.combination === 'best' ? 'Use the discount that gives the largest dollar saving.' : 'Apply each discount to the remaining balance. The total cannot fall below $0.'}</p></form> : <dl className={styles.facts}><div><dt>Multiple discounts</dt><dd>{value.combination === 'best' ? 'Best single discount' : 'Combine eligible discounts'}</dd></div>{value.combination === 'combine' && <div><dt>Application order</dt><dd>{value.order === 'percentage-first' ? 'Percentage discounts first' : 'Fixed-amount discounts first'}</dd></div>}</dl>}
  </DenseSectionPanel>
}