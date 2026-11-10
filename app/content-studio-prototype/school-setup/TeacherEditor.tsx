'use client'

import { type CSSProperties } from 'react'
import { Input } from '@/components/ui/Input'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { Checkbox } from '@/components/ui/Checkbox'
import { StudentMultiSelect } from '@/components/leads/StudentMultiSelect'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { colors, typography, spacing, radius } from '@/lib/tokens'
import { type SetupRecord, selection } from './setup-content'
import styles from './teacher-editor.module.css'

import TeacherSchedule from './TeacherSchedule'
type Assignment = { serviceId: string; maxLevel: number }
function parse<T>(value: string, fallback: T): T { try { return JSON.parse(value) as T } catch { return fallback } }

export default function TeacherEditor({ values, services, locations, levels, onChange }: {
  values: Record<string, string>; services: SetupRecord[]; locations: SetupRecord[]; levels: Record<string, string>
  onChange: (values: Record<string, string>) => void
}) {
  const assignments = parse<Assignment[]>(values.assignments, [{ serviceId: values.service, maxLevel: Math.max(1, selection(values.levelIds).length) }])
  const setAssignments = (next: Assignment[]) => onChange({ ...values, assignments: JSON.stringify(next), service: next[0]?.serviceId || '', levelIds: JSON.stringify(Object.keys(levels).slice(0, Math.max(0, ...next.map(item => item.maxLevel)))) })
  const theme = { '--teacher-border': colors.border, '--teacher-muted': colors.textSecondary, '--teacher-accent': colors.link, '--teacher-surface': colors.surfaceMuted, '--teacher-radius': radius.sm, '--teacher-gap': spacing.lg, '--teacher-small': typography.sizeSm } as CSSProperties
  return <div style={theme} className={styles.editor}>
    <DenseSectionPanel title="Contact details" headingLevel="h2" contentStyle={{ display: 'grid', gap: spacing['2xl'] }}>
    <FieldGrid>
      <Input label="Teacher name" required value={values.name} onChange={event => onChange({ ...values, name: event.target.value })} />
    </FieldGrid>
    <FieldGrid>
      <Input label="Teacher email" type="email" required value={values.email || ''} onChange={event => onChange({ ...values, email: event.target.value })} />
      <Input label="Teacher phone" type="tel" required value={values.phone || ''} onChange={event => onChange({ ...values, phone: event.target.value })} />
    </FieldGrid>
    <FieldGrid columns={1}><StudentMultiSelect label="Locations" ariaLabel="Teacher locations" value={values.locationIds ? selection(values.locationIds).join(', ') : values.location || ''} options={locations.map(location => ({ value: location.id, label: location.values.name }))} onChange={value => { const ids = value.split(',').map(id => id.trim()).filter(Boolean); onChange({ ...values, locationIds: JSON.stringify(ids), location: ids[0] || '' }) }} /></FieldGrid>
    </DenseSectionPanel>
    <DenseSectionPanel title="Teaching assignments" headingLevel="h2">
    <div className={styles.assignmentHeader}><span /><strong>Level</strong></div>
    {services.map(service => {
      const assignment = assignments.find(item => item.serviceId === service.id)
      return <div key={service.id} className={styles.assignment} data-teaching-assignment={service.id}>
        <Checkbox label={service.values.name} checked={!!assignment} onChange={event => setAssignments(event.target.checked ? [...assignments, { serviceId: service.id, maxLevel: 1 }] : assignments.filter(item => item.serviceId !== service.id))} />
        {assignment && <div className={styles.level}><div className={styles.sliderTrack}><div className={styles.sliderFill} style={{ width: `${(assignment.maxLevel - 1) / Math.max(1, Object.keys(levels).length - 1) * 100}%` }} />{Object.keys(levels).map((id, index) => <span key={id} className={styles.sliderDot} data-active={index < assignment.maxLevel} style={{ left: `${index / Math.max(1, Object.keys(levels).length - 1) * 100}%` }} />)}<input aria-label={`${service.values.name} maximum level`} aria-valuetext={`Through ${Object.values(levels)[assignment.maxLevel - 1]}`} type="range" min={1} max={Math.max(1, Object.keys(levels).length)} step={1} value={assignment.maxLevel} onChange={event => setAssignments(assignments.map(item => item.serviceId === service.id ? { ...item, maxLevel: Number(event.target.value) } : item))} /></div><div className={styles.levelLabels}>{Object.keys(levels).map((id, index) => <span key={id}>{index + 1}</span>)}</div></div>}
      </div>
    })}
    </DenseSectionPanel>
    <TeacherSchedule values={values} onChange={onChange} />
  </div>
}