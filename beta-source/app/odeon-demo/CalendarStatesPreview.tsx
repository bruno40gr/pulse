'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageContainer } from '@/components/ui/PageContainer'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { ControlButton } from '@/components/ui/ControlButton'
import { colors, spacing, typography } from '@/lib/tokens'
import styles from './calendar-states-preview.module.css'

/**
 * Prototype only: three candidate treatments for the four calendar cell states.
 * Nothing here is wired into the calendar; it exists to choose a direction.
 */
type State = 'unavailable' | 'available' | 'hover' | 'booked'

const CELLS: { time: string; state: State; title?: string; lines?: string[] }[] = [
  { time: '2:00', state: 'unavailable' },
  { time: '2:30', state: 'available', title: 'Piano · 30 min', lines: ['Maya Chen'] },
  { time: '3:00', state: 'hover', title: 'Book 3:00–3:30', lines: ['Piano · Maya Chen'] },
  { time: '3:30', state: 'available', title: 'Piano · 30 min', lines: ['Theo Brooks'] },
  { time: '4:00', state: 'booked', title: 'Cora Fairhaven', lines: ['Piano · Carole King', '4:00 pm · Studio 1'] },
  { time: '4:30', state: 'unavailable' },
  { time: '5:00', state: 'booked', title: 'Felix Northwood', lines: ['Piano · Franz Liszt', '5:00 pm · Studio 2'] },
  { time: '5:30', state: 'available', title: 'Piano · 30 min', lines: ['Maya Chen'] },
]

const STATE_LABEL: Record<State, string> = {
  unavailable: 'Unavailable', available: 'Available to book', hover: 'Hover to book', booked: 'Booked',
}

function Cell({ option, state, title, lines, label }: { option: 'a' | 'b' | 'c'; state: State; title?: string; lines?: string[]; label?: string }) {
  const className = [styles.slot, styles[option]].join(' ')
  const content = <span className={styles.content}>
    <strong>{label || title || STATE_LABEL[state]}</strong>
    {lines?.map(line => <span key={line}>{line}</span>)}
  </span>
  return state === 'booked' || state === 'unavailable'
    ? <div className={className} data-state={state}>{content}</div>
    : <button type="button" className={className} data-state={state} aria-label={`${STATE_LABEL[state]} ${title || ''}`.trim()}>{content}</button>
}


function OptionPreview({ option, title, rationale, note }: { option: 'a' | 'b' | 'c'; title: string; rationale: string; note: string }) {
  return <DenseSectionPanel title={title} headingLevel="h2">
    <p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: 0 }}>{rationale}</p>
    <div className={styles.strip} aria-label={`${title} states`}>
      {(['unavailable', 'available', 'hover', 'booked'] as State[]).map(state => <Cell key={state} option={option} state={state} label={STATE_LABEL[state]} />)}
    </div>
    <div className={styles.week} aria-label={`${title} in a week`}>
      <div className={styles.columnHeading}>Wed, Nov 4</div>
      <div className={styles.grid}>
        {CELLS.map(cell => <Cell key={cell.time} option={option} state={cell.state} title={cell.title} lines={cell.lines} />)}
      </div>
    </div>
    <p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: 0 }}>{note}</p>
  </DenseSectionPanel>
}

export default function CalendarStatesPreview() {
  const [hovered, setHovered] = useState<State | null>(null)
  return <PageContainer>
    <PageHeader density="compact" singleLine title="Calendar cell states" subtitle="Prototype · three treatments for the same four states" />
    <div style={{ display: 'grid', gap: spacing.xl }}>
      <DenseSectionPanel title="What the four states have to say" headingLevel="h2">
        <div style={{ display: 'grid', gap: spacing.sm }}>
          <p style={{ ...typography.bodySmall, margin: 0 }}><strong>Unavailable</strong> — outside the teacher or room hours. Never clickable.</p>
          <p style={{ ...typography.bodySmall, margin: 0 }}><strong>Available to book</strong> — free and inside hours. On reschedule and makeup flows this carries readable content: who can teach it, what, and how long.</p>
          <p style={{ ...typography.bodySmall, margin: 0 }}><strong>Hover to book</strong> — the pointer is on an available cell and it commits to the action.</p>
          <p style={{ ...typography.bodySmall, margin: 0 }}><strong>Booked</strong> — an existing lesson. The only state that carries a student.</p>
        </div>
      </DenseSectionPanel>

      <OptionPreview option="a" title="Option A · Outlined slot"
        rationale="Availability keeps the dotted outline it has in rescheduling and gains readable content. Unavailable stays flat grey, booked stays solid."
        note="Closest to what reschedule already does, so the two screens agree. Heaviest on a full week: every free cell is outlined and labelled." />

      <OptionPreview option="b" title="Option B · Quiet cell, content on hover"
        rationale="Available cells are a faint tint with a small plus. Words appear only when the pointer arrives, so scanning stays calm."
        note="The grid reads as lessons first and space second. Cost: availability is a texture rather than a sentence until you interact, and a plus alone does not say who can teach it." />

      <OptionPreview option="c" title="Option C · Edge marker"
        rationale="A thin edge on the leading side marks bookable time; the cell itself stays white. Hover fills the cell and shows the booking prompt."
        note="Lightest of the three and survives dense weeks. Cost: an edge cue is easy to miss on first use and is less explicit than an outline." />

      <DenseSectionPanel title="Reading the options" headingLevel="h2">
        <p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: 0 }}>Hover any available cell above to feel the transition. Choosing one commits the calendar to a single language.</p>
        <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
          {(['available', 'hover'] as State[]).map(state => <ControlButton key={state} type="button" kind="toggle" aria-pressed={hovered === state} onClick={() => setHovered(state)}>{STATE_LABEL[state]}</ControlButton>)}
        </div>
        {hovered && <p style={{ ...typography.bodySmall, margin: 0 }}>Comparing {STATE_LABEL[hovered].toLowerCase()} across the three options above.</p>}
      </DenseSectionPanel>
    </div>
  </PageContainer>
}
