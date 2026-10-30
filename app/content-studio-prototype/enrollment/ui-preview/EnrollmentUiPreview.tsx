'use client'

import { useState, type CSSProperties } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ControlButton } from '@/components/ui/ControlButton'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { Disclosure } from '@/components/ui/Disclosure'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SurfacePanel } from '@/components/ui/SurfacePanel'
import { colors, radius, typography } from '@/lib/tokens'
import enrollment from '../enrollment.module.css'
import styles from './preview.module.css'

type Treatment = 'current' | 'shared' | 'flat'
const treatments: { id: Treatment; title: string; description: string }[] = [
  { id: 'current', title: 'Current enrollment', description: 'Existing page CSS, native fields and inset dropdown caret.' },
  { id: 'shared', title: 'Shared defaults', description: 'Raised panel alternative. Shared fields now use the approved height, inset caret and associated labels.' },
  { id: 'flat', title: 'Proposed flat treatment', description: 'Approved shared flat cards, inset caret and visible keyboard focus.' },
]
const flatPanel: CSSProperties = { boxShadow: 'none', borderRadius: radius.lg, padding: 16 }
const caret: CSSProperties = {
  appearance: 'none', paddingRight: 38,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundPosition: 'right 12px center', backgroundRepeat: 'no-repeat', backgroundSize: 16,
}

function Comparison({ treatment }: { treatment: typeof treatments[number] }) {
  const [name, setName] = useState('Avery')
  const [program, setProgram] = useState('Piano')
  const [self, setSelf] = useState(true)
  const [removed, setRemoved] = useState(false)
  const [message, setMessage] = useState('')
  const current = treatment.id === 'current'
  const flat = treatment.id === 'flat'
  const prefix = `preview-${treatment.id}`
  const remove = () => {
    if (window.confirm('Remove this sample student from this preview column?')) { setRemoved(true); setMessage('Sample student removed. Restore it below.') }
  }
  const actions = <ControlButton kind="icon" aria-label={`Remove sample student — ${treatment.title}`} onClick={remove}><Trash2 size={16} aria-hidden="true" /></ControlButton>
  const fields = <div className={styles.formFields}>
    <label className={styles.checkbox}><input type="checkbox" checked={self} onChange={event => setSelf(event.target.checked)} />Classes are for this person</label>
    {!self && <p className={styles.note}>Preview only: another student would be selected here.</p>}
    {current ? <>
      <label htmlFor={`${prefix}-name`}>First name<input id={`${prefix}-name`} value={name} onChange={event => setName(event.target.value)} autoComplete="off" /></label>
      <label htmlFor={`${prefix}-program`}>Program<select id={`${prefix}-program`} value={program} onChange={event => setProgram(event.target.value)}><option>Piano</option><option>Guitar</option><option>Voice</option><option>Violin — longer option label</option></select></label>
    </> : <>
      <Input id={`${prefix}-name`} aria-label="First name" label="First name" value={name} onChange={event => setName(event.target.value)} autoComplete="off" style={flat ? { minHeight: 42 } : undefined} />
      <Select id={`${prefix}-program`} aria-label="Program" label="Program" value={program} onChange={event => setProgram(event.target.value)} style={flat ? { ...caret, minHeight: 42 } : undefined}><option>Piano</option><option>Guitar</option><option>Voice</option><option>Violin — longer option label</option></Select>
    </>}
  </div>
  const review = <div><strong>{name || 'Student'} Lane · Private · {program}</strong><p>Tuesday · 4:00–4:30 pm · Jordan Vale</p><p>Weekly · Starts November 3, 2026</p></div>
  const pricing = <p className={styles.priceLine}><span>4 lessons × $25</span><strong>$100.00</strong></p>

  return <section className={`${styles.column} ${current ? enrollment.workspace : ''} ${flat ? styles.proposed : ''}`} aria-labelledby={`${prefix}-heading`}>
    <header className={styles.columnHeader}><h2 id={`${prefix}-heading`}>{treatment.title}</h2><p>{treatment.description}</p></header>
    <div className={styles.sample}>
      <p className={styles.caption}>{current ? 'Page-specific student card' : 'DenseSectionPanel + ControlButton'}</p>
      {removed ? <SurfacePanel style={flat ? flatPanel : undefined}><p>Sample student removed.</p><Button type="button" variant="secondary" onClick={() => { setRemoved(false); setMessage('Sample student restored.') }}>Restore student</Button></SurfacePanel>
        : current ? <section className={enrollment.familyStudent}><div className={enrollment.sectionHeading}><h3>Student 1</h3><Button type="button" variant="ghost" aria-label={`Remove sample student — ${treatment.title}`} onClick={remove}><Trash2 size={16} aria-hidden="true" /></Button></div>{fields}</section>
          : <DenseSectionPanel appearance={flat ? 'flat' : 'raised'} title={<h3>Student 1</h3>} actions={actions} style={flat ? flatPanel : undefined}>{fields}</DenseSectionPanel>}
    </div>
    <div className={styles.sample}>
      <h3>Final lesson review</h3>
      <p className={styles.caption}>{current ? 'Page-specific gray person card' : 'SurfacePanel tone="muted"'}</p>
      {current ? <div className={enrollment.person}>{review}</div> : <SurfacePanel appearance={flat ? 'flat' : 'raised'} tone="muted" style={flat ? { ...flatPanel, border: 'none' } : undefined}>{review}</SurfacePanel>}
    </div>
    <div className={styles.sample}>
      <h3>Pricing breakdown</h3>
      <p className={styles.caption}>{current ? 'Native details / summary' : 'Shared Disclosure'}</p>
      {current ? <details><summary>View lesson breakdown</summary>{pricing}</details> : <Disclosure summary="View lesson breakdown">{pricing}</Disclosure>}
    </div>
    <p className={styles.note}>{treatment.id === 'shared' ? 'Shared inputs now have associated labels and visible focus. Raised panels remain available for comparison.' : flat ? 'Approved flat treatment is now supported by the shared panel components.' : 'Baseline includes the recent caret-spacing fix.'}</p>
    <p role="status" className={styles.note}>{message}</p>
  </section>
}

export default function EnrollmentUiPreview() {
  return <main className={styles.page} style={{ fontFamily: typography.fontSans, color: colors.text, background: colors.background }}>
    <header className={styles.header}>
      <a href="/content-studio-prototype/enrollment">← Back to enrollment</a>
      <h1>Enrollment UI comparison</h1>
      <p>Compare existing patterns before choosing a shared treatment. Fictional data only; edits stay on this page and reset on reload.</p>
      <p>Try the dropdowns, edit a name, expand pricing, and remove/restore a sample student. Use Tab to compare keyboard focus. Columns stack on narrow screens.</p>
    </header>
    <div className={styles.grid}>{treatments.map(treatment => <Comparison key={treatment.id} treatment={treatment} />)}</div>
    <SurfacePanel style={{ ...flatPanel, marginTop: 28 }}>
      <h2>Decisions to make</h2>
      <ol className={styles.decisions}><li>Keep the current flat cards, or adopt the shared panel shadows?</li><li>Shared fields now use the approved 42px height and 12px caret inset.</li><li>Use the shared icon actions and pricing disclosure?</li></ol>
      <p>This comparison does not write enrollment state, permissions, bookings or payments. Preferences are not saved.</p>
    </SurfacePanel>
  </main>
}