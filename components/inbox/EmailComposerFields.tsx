'use client'

import type { ReactNode } from 'react'
import { Input } from '@/components/ui/Input'
import { colors, spacing, typography } from '@/lib/tokens'

/** One label/value grid for every envelope field, including the subject input. */
export function EmailComposerFields({ from, recipients, subject, onSubjectChange }: {
  from: ReactNode
  recipients: { label: string; content: ReactNode }[]
  subject: string
  onSubjectChange: (subject: string) => void
}) {
  const labelStyle = { ...typography.label, color: colors.textSecondary }
  return <div aria-label="Email fields" style={{ display: 'grid', gridTemplateColumns: '4rem minmax(0, 1fr)', alignItems: 'center', gap: `${spacing.md} ${spacing.md}` }}>
    <span style={labelStyle}>From</span>
    <div style={{ ...typography.body, minWidth: 0, overflowWrap: 'anywhere' }}>{from}</div>
    {recipients.map(({ label, content }) => <EmailRecipientField key={label} label={label}>{content}</EmailRecipientField>)}
    <label htmlFor="prototype-email-subject" style={labelStyle}>Subject</label>
    <Input id="prototype-email-subject" aria-label="Email subject" placeholder="Subject" value={subject} onChange={event => onSubjectChange(event.target.value)} />
  </div>
}

function EmailRecipientField({ label, children }: { label: string; children: ReactNode }) {
  return <>
    <span style={{ ...typography.label, color: colors.textSecondary }}>{label}</span>
    <div style={{ ...typography.body, minWidth: 0, overflowWrap: 'anywhere' }}>{children}</div>
  </>
}