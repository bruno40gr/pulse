'use client'

import { Button } from '@/components/ui/Button'
import { spacing } from '@/lib/tokens'

export default function MessageActions({ onSms, onEmail, disabled = false }: {
  onSms: () => void
  onEmail: () => void
  disabled?: boolean
}) {
  return <div role="group" aria-label="Messaging actions" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }}>
    <Button variant="primary" size="md" disabled={disabled} onClick={onSms}>Send new text message</Button>
    <Button variant="primary" size="md" disabled={disabled} onClick={onEmail}>Send new email</Button>
  </div>
}