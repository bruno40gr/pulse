'use client'

import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { DenseSectionPanel } from './DenseSectionPanel'
import { Button } from './Button'
import { interaction } from '@/lib/tokens'

/** Shared enrollment entry card, also used for calendar booking paths. */
export function EntryPathCard({ title, action, onChoose, children, selected }: {
  title: string; action: string; onChoose: () => void; children: ReactNode; selected?: boolean
}) {
  return <DenseSectionPanel title={title} headingLevel="h3" style={selected ? { borderColor: interaction.selected } : undefined} actions={<Button variant="secondary" aria-label={`Choose ${title}`} aria-pressed={selected} onClick={onChoose}>{action}<ArrowRight size={17} /></Button>}>{children}</DenseSectionPanel>
}