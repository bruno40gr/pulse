'use client'

import { Textarea } from './Textarea'
import { SectionTitle } from './SectionTitle'
import { Checkbox } from './Checkbox'
import { spacing, typography } from '@/lib/tokens'

/** One agreement composition for offering setup and family acceptance. */
export function ParticipationPolicies({ agreements, onChange, accepted, onAccept, acceptanceLabel = 'I accept the participation agreement' }: {
  agreements: { id: string; title: string; content: string }[];
  onChange?: (id: string, content: string) => void;
  accepted?: boolean; onAccept?: (accepted: boolean) => void; acceptanceLabel?: string;
}) {
  return <div style={{ display: 'grid', gap: spacing.lg }}>
    {agreements.map(agreement => <section key={agreement.id} style={{ display: 'grid', gap: spacing.md }}>
      {onChange ? <Textarea label={agreement.title} value={agreement.content} onChange={event => onChange(agreement.id, event.target.value)} /> : <>
        <SectionTitle as="h3" variant="card" style={{ marginBottom: 0 }}>{agreement.title}</SectionTitle>
        <p style={{ ...typography.body, margin: 0, whiteSpace: 'pre-wrap' }}>{agreement.content}</p>
      </>}
    </section>)}
    {onAccept && <Checkbox label={acceptanceLabel} checked={!!accepted} onChange={event => onAccept(event.target.checked)} />}
  </div>
}