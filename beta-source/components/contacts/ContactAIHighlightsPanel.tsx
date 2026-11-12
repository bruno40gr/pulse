import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { DenseSectionPanel, FieldValue, SectionTitle } from '@/beta-source/components/ui'
import { colors, spacing } from '@/beta-source/lib/tokens'

/** Shared contact-panel presentation; callers supply real findings or the empty state. */
export function ContactAIHighlightsPanel({ children }: { children?: ReactNode }) {
  return <DenseSectionPanel title={<SectionTitle as="h3" variant="card"><Sparkles size={15} aria-hidden="true" /> AI highlights</SectionTitle>} style={{ marginBottom: spacing.lg }}>
    {children || <FieldValue style={{ color: colors.textMuted }}>No insights available for this contact yet.</FieldValue>}
  </DenseSectionPanel>
}