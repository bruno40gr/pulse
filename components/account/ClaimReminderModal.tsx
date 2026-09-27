'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Mail } from 'lucide-react'
import { Button } from '@/components/ui'
import { colors, radius, shadows, spacing, typography } from '@/lib/tokens'

type ClaimContext = {
  show: boolean
  firstName?: string
  status?: 'unclaimed' | 'invited'
  maskedEmail?: string | null
  hasEmail?: boolean
}

export function ClaimReminderModal() {
  const [context, setContext] = useState<ClaimContext | null>(null)
  const [loading, setLoading] = useState(false)
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
    setLoading(true)
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
      setLoading(false)
    }
  }

  return (
    <div style={overlayStyle} role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="claim-reminder-title" style={modalStyle}>
        <div style={contentStyle}>
          <h2 id="claim-reminder-title" style={titleStyle}>Set up your personal password.</h2>
          <p style={bodyStyle}>
            Hi {context.firstName || 'there'}. Claim your personal account and set up your own password. Shared-coded access will be deprecated soon.
          </p>

          {context.hasEmail ? (
            <div style={emailStyle}>
              <Mail size={17} color={colors.textSecondary} />
              <div><strong style={{ display: 'block', color: colors.text }}>Setup email</strong><span>{context.maskedEmail}</span></div>
            </div>
          ) : (
            <div style={warningStyle}>
              No staff email is on file. Ask an Owner or Admin to add the correct email to your staff account, then sign in again.
            </div>
          )}

          {sent && <div style={successStyle} role="status"><CheckCircle2 size={17} /> Check your inbox and follow the secure setup link.</div>}
          {error && <p role="alert" style={errorStyle}>{error}</p>}
        </div>

        <div style={actionsStyle}>
          <Button type="button" variant="secondary" onClick={() => void perform('dismiss')} disabled={loading}>Skip for now</Button>
          {context.hasEmail && (
            <Button type="button" onClick={() => void perform('send')} disabled={loading || sent}>
              {loading ? 'Working…' : sent ? 'Email sent' : 'Claim your account'}
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: spacing.lg, background: 'rgba(20, 30, 34, 0.48)', backdropFilter: 'blur(2px)' }
const modalStyle: React.CSSProperties = { width: 'min(100%, 440px)', padding: spacing['2xl'], borderRadius: radius.xl, background: colors.surface, border: `1px solid ${colors.border}`, boxShadow: shadows.lg, fontFamily: typography.fontSans }
const contentStyle: React.CSSProperties = { display: 'grid', gap: spacing.lg }
const titleStyle: React.CSSProperties = { ...typography.h2, margin: 0, color: colors.text }
const bodyStyle: React.CSSProperties = { ...typography.bodySmall, margin: 0, color: colors.textSecondary }
const emailStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, background: colors.surfaceMuted, color: colors.textSecondary, fontSize: typography.sizeSm }
const warningStyle: React.CSSProperties = { padding: spacing.md, borderRadius: radius.md, background: `${colors.warning}16`, color: colors.text, fontSize: typography.sizeSm, lineHeight: 1.5 }
const successStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: spacing.sm, color: colors.success, fontSize: typography.sizeSm, fontWeight: typography.weightMedium }
const errorStyle: React.CSSProperties = { margin: 0, color: colors.error, fontSize: typography.sizeSm }
const actionsStyle: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing['2xl'], flexWrap: 'wrap' }
