'use client'

import { FieldGrid } from '@/components/ui/FieldGrid'
import { Input } from '@/components/ui/Input'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { durationRates } from './setup-content'
import styles from './school-setup.module.css'

export default function DurationPricing({ values, onChange }: { values: Record<string, string>; onChange: (value: string) => void }) {
  const rates = durationRates(values)
  return <section className={styles.formStack} aria-label="Prices by lesson length">
    <SectionTitle>Lesson prices (USD)</SectionTitle>
    <FieldGrid columns={1}>{[30, 45, 60].map(minutes => <Input key={minutes} label={`${minutes} minutes (USD)`} aria-label={`Price for ${minutes} minutes (USD)`} type="number" min={0} step="0.01" value={rates.find(rate => rate.minutes === minutes)?.price || ''} onChange={event => {
      const next = rates.filter(rate => rate.minutes !== minutes)
      if (event.target.value !== '') next.push({ minutes, price: event.target.value })
      onChange(JSON.stringify(next.sort((a, b) => a.minutes - b.minutes)))
    }} />)}</FieldGrid>
  </section>
}