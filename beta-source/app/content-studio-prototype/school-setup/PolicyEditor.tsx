'use client'

import { DenseSectionPanel } from '@/beta-source/components/ui/DenseSectionPanel'
import { useId } from 'react'
import { Input } from '@/beta-source/components/ui/Input'
import { Select } from '@/beta-source/components/ui/Select'
import { Switch } from '@/beta-source/components/ui/Switch'
import { spacing } from '@/beta-source/lib/tokens'
import styles from './school-setup.module.css'

const selfServiceChoices = [['familyCancel', 'Cancel lessons'], ['familyReschedule', 'Reschedule lessons'], ['familyMakeup', 'Book makeups']] as const

export const policyChoices: Record<string, { label: string; options: string[] }> = {
  timelyAction: { label: 'With sufficient notice', options: ['Reschedule', 'Issue a makeup', 'Reschedule or issue a makeup'] },
  lateAction: { label: 'Late cancellations', options: ['Forfeit lesson', 'Allow rescheduling or a makeup', 'Staff review'] },
  noShowAction: { label: 'No-shows', options: ['Forfeit lesson', 'Allow rescheduling or a makeup', 'Staff review'] },
  makeupExpiry: { label: 'Makeup expiry', options: ['No expiry', 'After a number of days'] },
  makeupPeriod: { label: 'Makeup limit period', options: ['Month', 'Term', 'Year'] },
  makeupTeacher: { label: 'Makeup teacher', options: ['Original teacher only', 'Any qualified teacher'] },
  teacherAbsence: { label: 'Teacher absence options', options: ['Substitute', 'Reschedule', 'Issue a makeup', 'Substitute or reschedule', 'Substitute or issue a makeup', 'Reschedule or issue a makeup', 'Substitute, reschedule or issue a makeup'] },
  plannedClosure: { label: 'Planned closure treatment', options: ['Do not charge; no makeup', 'Keep tuition; closure included in program', 'Keep charge; issue a makeup', 'Staff review'] },
  unexpectedClosure: { label: 'Unexpected closure treatment', options: ['Staff review each incident', 'Issue a makeup', 'Account credit', 'Refund affected paid lessons'] },
  pauseSlot: { label: 'Regular slot during a pause', options: ['Hold the slot', 'Release the slot'] },
  freezeFee: { label: 'Pause freeze fee', options: ['No fee', 'Charge a fee'] },
  freezeFeeBasis: { label: 'Freeze fee timing', options: ['Once per pause', 'Each billing period while paused'] },
  withdrawal: { label: 'Withdrawal takes effect', options: ['Immediately', 'After a notice period', 'End of billing period'] },
}

export default function PolicyEditor({ values, onChange }: { values: Record<string, string>; onChange: (values: Record<string, string>) => void }) {
  const prefix = useId()
  const set = (key: string, value: string) => onChange({ ...values, [key]: value })
  const choice = (key: string) => <div key={key} className={styles.settingRow}><label htmlFor={`${prefix}-${key}`}>{policyChoices[key].label}</label><div className={styles.settingControl}><Select id={`${prefix}-${key}`} value={values[key] || ''} onChange={event => set(key, event.target.value)}><option value="">Choose…</option>{policyChoices[key].options.map(option => <option key={option}>{option}</option>)}</Select></div></div>
  const number = (key: string, label: string, min = 0, step: number | string = 1) => <div className={styles.settingRow}><label htmlFor={`${prefix}-${key}`}>{label}</label><div className={styles.settingControl}><Input id={`${prefix}-${key}`} type="number" min={min} step={step} value={values[key] || ''} onChange={event => set(key, event.target.value)} /></div></div>
  const toggle = (key: string, label: string, enabled: string, disabled: string) => <div className={styles.settingSwitch}><Switch label={label} description={!values[key] ? 'Not configured yet' : undefined} checked={values[key] === enabled} onChange={event => set(key, event.target.checked ? enabled : disabled)} /></div>
  const layout = { display: 'grid', gap: spacing.lg }
  return <div style={layout}>
    <DenseSectionPanel title="Family self-service" headingLevel="h2" contentStyle={{ minWidth: 0 }}>
      <p className={styles.sectionDescription}>Choose which actions families can manage. Staff handle actions that are turned off.</p>
      <div className={styles.settingRows}>{selfServiceChoices.map(([key, label]) => <div key={key} className={styles.settingSwitch}><Switch label={label} checked={values[key] !== 'off'} onChange={event => set(key, event.target.checked ? 'on' : 'off')} /></div>)}</div>
    </DenseSectionPanel>
    <DenseSectionPanel title="Cancellations & attendance" headingLevel="h2" contentStyle={{ minWidth: 0 }}>
      <p className={styles.sectionDescription}>Families can cancel and reschedule within these rules. Staff can waive a penalty when an exception is needed.</p>
      <div className={styles.settingRows}>{number('notice', 'Cancellation notice (hours)')}{choice('timelyAction')}{choice('lateAction')}{choice('noShowAction')}</div>
    </DenseSectionPanel>
    <DenseSectionPanel title="Makeups" headingLevel="h2" contentStyle={{ minWidth: 0 }}>
      <p className={styles.sectionDescription}>Families book eligible makeups in the same lesson format and duration. Rescheduling and a makeup cannot both compensate the same cancellation.</p>
      <div className={styles.settingRows}>{toggle('makeupExpiry', 'Makeups expire', 'After a number of days', 'No expiry')}{values.makeupExpiry === 'After a number of days' && number('makeupExpiryDays', 'Makeup expires after (days)', 1)}{number('makeupLimit', 'Makeup limit', 1)}{choice('makeupPeriod')}{choice('makeupTeacher')}</div>
    </DenseSectionPanel>
    <DenseSectionPanel title="Teacher absences" headingLevel="h2"><div className={styles.settingRows}>{choice('teacherAbsence')}</div></DenseSectionPanel>
    <DenseSectionPanel title="School closures" headingLevel="h2" contentStyle={{ minWidth: 0 }}>
      <p className={styles.sectionDescription}>These are school-wide rules. Manage holiday presets and closure dates separately in Calendar.</p>
      <div className={styles.settingRows}>{choice('plannedClosure')}{choice('unexpectedClosure')}</div>
    </DenseSectionPanel>
    <DenseSectionPanel title="Pauses & withdrawal" headingLevel="h2" contentStyle={{ minWidth: 0 }}>
      <div className={styles.settingRows}>{toggle('freezeFee', 'Charge a freeze fee', 'Charge a fee', 'No fee')}{choice('pauseSlot')}{values.freezeFee === 'Charge a fee' && number('freezeFeeAmount', 'Freeze fee (USD)', 0.01, '0.01')}{values.freezeFee === 'Charge a fee' && choice('freezeFeeBasis')}{choice('withdrawal')}{values.withdrawal === 'After a notice period' && number('withdrawalDays', 'Withdrawal notice (days)', 1)}</div>
    </DenseSectionPanel>
  </div>
}