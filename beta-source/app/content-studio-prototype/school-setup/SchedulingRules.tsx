'use client'

import { Switch } from '@/components/ui/Switch'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { FieldGrid } from '@/components/ui/FieldGrid'
import { Select } from '@/components/ui/Select'
import { schedulingDefaults } from '@/beta-source/lib/academy-scheduling-policy'
import { spacing } from '@/lib/tokens'

export default function SchedulingRules({ values, onChange, teacher = false, defaults = schedulingDefaults }: { values: Record<string, string>; onChange: (values: Record<string, string>) => void; teacher?: boolean; defaults?: Record<string, string> }) {
  const set = (key: string, value: string) => onChange({ ...values, [key]: value })
  const enabled = (values.publicBooking || defaults.publicBooking || 'yes') === 'yes'
  return <DenseSectionPanel title={teacher ? 'Booking rules' : 'Booking settings'} headingLevel="h2" contentStyle={{ display: 'grid', gap: spacing.lg }}>
    <FieldGrid>
      <Select label="Maximum gap between lessons" value={values.maxTeachingGap || ''} onChange={event => set('maxTeachingGap', event.target.value)}><option value="">{teacher ? `School setting · ${defaults.maxTeachingGap || '120'} minutes` : '120 minutes'}</option>{[30, 60, 90, 120, 150, 180, 240].map(minutes => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</Select>
      <Select label="Teaching before a required break" value="240" disabled><option value="240">4 hours</option></Select>
    </FieldGrid>
    <Switch label="Available for self-booking links" description={enabled ? 'Yes' : 'No'} checked={enabled} onChange={event => set('publicBooking', event.target.checked ? 'yes' : 'no')} />
  </DenseSectionPanel>
}