'use client'

import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { Button, LoadingButton, Modal, ModalBody, ModalFooter, ModalHeader, Notice } from '@/components/ui'
import { colors, radius, spacing, typography } from '@/lib/tokens'

type ClaimContext = {
  show: boolean
  firstName?: string
  status?: 'unclaimed' | 'invited'
  maskedEmail?: string | null
  hasEmail?: boolean
}

export function ClaimReminderModal() {
  const [context, setContext] = useState<ClaimContext | null>(null)
  const [pendingAction, setPendingAction] = useState<'dismiss' | 'send' | null>(null)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    fetch('/api/account/claim-reminder', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Could not load account setup.')
        if (mounted) setContext(body)
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  if (!context?.show) return null

  const perform = async (action: 'dismiss' | 'send') => {
    setPendingAction(action)
    setError('')
    try {
      const response = await fetch('/api/account/claim-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Could not update account setup.')
      if (action === 'dismiss') setContext(current => current ? { ...current, show: false } : current)
      else {
        setSent(true)
        setContext(current => current ? { ...current, status: 'invited' } : current)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update account setup.')
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <Modal isOpen={context.show} size="sm" ariaLabel="Set up your personal password" closeOnBackdrop={false} closeOnEscape={false}>
      <ModalHeader
        title="Set up your personal password."
        description={`Hi ${context.firstName || 'there'}. Claim your personal account and set up your own password. Shared-coded access will be deprecated soon.`}
      />
      <ModalBody style={{ display: 'grid', gap: spacing.lg }}>
        {context.hasEmail ? (
          <div style={emailStyle}>
            <Mail size={17} color={colors.textSecondary} aria-hidden="true" />
            <div><strong style={{ display: 'block', color: colors.text }}>Setup email</strong><span>{context.maskedEmail}</span></div>
          </div>
        ) : (
          <Notice variant="warning" title="No staff email is on file">
            Ask an Owner or Admin to add the correct email to your staff account, then sign in again.
          </Notice>
        )}
        {sent && <Notice variant="success">Check your inbox and follow the secure setup link.</Notice>}
        {error && <Notice variant="error">{error}</Notice>}
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="secondary" onClick={() => void perform('dismiss')} disabled={pendingAction !== null}>Skip for now</Button>
        {context.hasEmail && (
          <LoadingButton
            type="button"
            loading={pendingAction === 'send'}
            loadingLabel="Sending account setup email"
            onClick={() => void perform('send')}
            disabled={pendingAction !== null || sent}
          >
            {sent ? 'Email sent' : 'Claim your account'}
          </LoadingButton>
        )}
      </ModalFooter>
    </Modal>
  )
}

const emailStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, background: colors.surfaceMuted, color: colors.textSecondary, fontSize: typography.sizeSm }
