'use client'

import { useState } from 'react'
import Image from 'next/image'
import { CalendarDays, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Notice'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { Switch } from '@/components/ui/Switch'
import { Textarea } from '@/components/ui/Textarea'
import { colors, spacing, typography } from '@/lib/tokens'
import { eventIsPaid, eventSessionPrice, type ExplorerEvent } from '@/beta-source/lib/event-explorer'
import styles from './explorer.module.css'

const dateLabel = (date: string) => date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Dates not selected'
const money = (value: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(value))

export default function EventReview({ event, typeName, onChange }: { event: ExplorerEvent; typeName?: string; onChange: (change: Partial<ExplorerEvent>) => void }) {
  const paid = eventIsPaid(event)
  const [message, setMessage] = useState('')
  const [copyError, setCopyError] = useState('')
  const link = `https://academy.example.invalid/events/${encodeURIComponent(event.id)}`
  const embed = `<iframe title="Event registration" src="${link}/embed" width="100%" height="720"></iframe>`
  const copy = async (value: string, label: string) => {
    setMessage(''); setCopyError('')
    try { await navigator.clipboard.writeText(value); setMessage(`${label} copied.`) }
    catch { setCopyError('Clipboard unavailable. Select and copy the displayed text instead.') }
  }
  return <div style={{ display: 'grid', gap: spacing['2xl'] }}>
    <SectionTitle>Review</SectionTitle>
    <article aria-label="Event preview" className={styles.eventPreview}>
      {event.image && <Image src={event.image} alt={event.name} width={960} height={540} unoptimized loading="eager" className={styles.eventPreviewImage} />}
      <div className={styles.eventPreviewContent}>
        {typeName && <span style={{ ...typography.label, color: colors.textSecondary }}>{typeName}</span>}
        <SectionTitle as="h3" variant="card" style={{ marginBottom: 0 }}>{event.name}</SectionTitle>
        <div style={{ display: 'grid', gap: spacing.sm, ...typography.bodySmall }}>
          <span className={styles.eventPreviewFact}><CalendarDays size={17} aria-hidden="true" />{dateLabel(event.start)}{event.end !== event.start ? ` – ${dateLabel(event.end)}` : ''}</span>
          <span className={styles.eventPreviewFact}><MapPin size={17} aria-hidden="true" />{event.location}</span>
        </div>
        {event.schedule && <p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: 0 }}>{event.schedule}</p>}
        {event.description && <p style={{ ...typography.body, margin: 0, whiteSpace: 'pre-wrap' }}>{event.description}</p>}
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: spacing.sm }}>
          <span style={{ ...typography.h2 }}>{paid ? money(event.price) : 'Free'}</span><span style={{ ...typography.bodySmall, color: colors.textSecondary }}>{!paid || event.signup === 'Whole event' ? 'Whole event' : `Whole event${eventSessionPrice(event) ? ` · ${money(eventSessionPrice(event))} per session` : ' or individual sessions'}`}</span>
        </div>
      </div>
    </article>
    <section aria-label="Public listing" style={{ display: 'grid', gap: spacing.lg, borderTop: `1px solid ${colors.border}`, paddingTop: spacing['2xl'] }}>
      <Switch label="Enable public listing" checked={event.published} onChange={e => {
        onChange({ published: e.target.checked }); setMessage(''); setCopyError('')
      }} />
      {event.published && <>
        <div className={styles.selectorAction}><Input label="Event booking link" readOnly value={link} /><Button variant="secondary" onClick={() => copy(link, 'Booking link')}>Copy link</Button></div>
        <div className={styles.selectorAction}><Textarea label="Website embed code" readOnly value={embed} rows={3} /><Button variant="secondary" onClick={() => copy(embed, 'Embed code')}>Copy embed</Button></div>
        {message && <p role="status" style={{ ...typography.bodySmall, margin: 0 }}>{message}</p>}
        {copyError && <Notice variant="error">{copyError}</Notice>}
      </>}
    </section>
  </div>
}
