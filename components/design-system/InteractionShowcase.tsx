'use client'

import { useState } from 'react'
import { Checkbox, CheckboxInput } from '@/components/ui/Checkbox'
import { Switch } from '@/components/ui/Switch'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { RadioOptionGroup } from '@/components/ui/RadioOptionGroup'
import { WeekdayToggleGroup } from '@/components/ui/WeekdayToggleGroup'
import { ModalStepper } from '@/components/ui/ModalStepper'
import { ProgressStepper } from '@/components/ui/ProgressStepper'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { interaction, spacing } from '@/lib/tokens'

/** Live component reference, not separately styled approximations. */
export function InteractionShowcase() {
  const [checked, setChecked] = useState(true)
  const [enabled, setEnabled] = useState(true)
  const [option, setOption] = useState('individual')
  const [days, setDays] = useState(['Wednesday', 'Thursday'])
  const [step, setStep] = useState(1)
  const [tab, setTab] = useState('students')
  const [searching, setSearching] = useState(false)
  return <section aria-label="Interaction color reference" style={{ display: 'grid', gap: spacing.xl, marginBottom: spacing['4xl'] }}>
    <h2>Interaction colors</h2>
    <p>Electric teal (#00BEDF) means selected, checked, on, or progress. Pale teal supports selected surfaces; deep teal keeps selected text and keyboard focus clear. Espresso is for primary actions and text on electric fills. Status colors describe outcomes, not selection.</p>
    <div style={{ display: 'flex', gap: spacing.lg, flexWrap: 'wrap' }}>{Object.entries(interaction).map(([name, value]) => <span key={name}><span aria-hidden="true" style={{ display: 'inline-block', width: 16, height: 16, background: value, marginRight: spacing.xs, border: '1px solid currentColor' }} />{name}: {value}</span>)}</div>
    <DenseSectionPanel title="Choices and switches"><div style={{ display: 'grid', gap: spacing.lg }}>
      <Checkbox label="Include existing student" checked={checked} onChange={event => setChecked(event.target.checked)} />
      <Checkbox label="Disabled checked option" checked disabled />
      <Checkbox label="Disabled unchecked option" checked={false} disabled />
      <label><CheckboxInput aria-label="Partially selected rows" ref={element => { if (element) element.indeterminate = true }} /> Partially selected rows</label>
      <Switch label="Enable booking" checked={enabled} onChange={event => setEnabled(event.target.checked)} />
      <Switch label="Disabled enabled switch" checked disabled />
      <ToggleSwitch label="Compact switch" checked={enabled} onChange={setEnabled} />
      <RadioOptionGroup label="Lesson format" value={option} onChange={setOption} options={[{ id: 'individual', label: 'Individual', description: 'One student' }, { id: 'group', label: 'Group', description: 'Several students' }]} />
      <WeekdayToggleGroup value={days} onChange={setDays} />
    </div></DenseSectionPanel>
    <DenseSectionPanel title="Progress and selected views"><div style={{ display: 'grid', gap: spacing.xl }}>
      <ModalStepper steps={['Student', 'Lessons', 'Times', 'Payment']} currentStep={step} onStepChange={setStep} />
      <ProgressStepper label="Compact enrollment" currentStep={step} steps={['Student', 'Lessons', 'Times', 'Payment'].map((label, index) => ({ id: label, label, complete: index < step }))} />
      <Tabs ariaLabel="Example view" activeKey={tab} onChange={setTab} variant="prominent" items={[{ key: 'students', label: 'Students' }, { key: 'families', label: 'Families' }]} />
    </div></DenseSectionPanel>
    <DenseSectionPanel title="Focus and native fields"><div style={{ display: 'grid', gap: spacing.lg }}>
      <FieldGrid><Input label="Example name" /><Input label="Invalid field" error="Example validation message" /></FieldGrid>
      <FieldGrid><Input label="Example date" type="date" /><Input label="Example time" type="time" /></FieldGrid>
      <p>Date/time popup internals are browser/OS-owned; the field and focus follow our tokens.</p>
      {searching ? <SearchSelect label="Find example person" options={[{ value: 'example', label: 'Example student' }]} onClose={() => setSearching(false)} onSelect={() => setSearching(false)} /> : <Button variant="secondary" onClick={() => setSearching(true)}>Open example search</Button>}
      <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}><Button>Primary action</Button><Button variant="secondary">Secondary action</Button><Button variant="destructive">Destructive action</Button><Button disabled>Disabled action</Button></div>
    </div></DenseSectionPanel>
  </section>
}