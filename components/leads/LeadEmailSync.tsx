'use client'

import { useEffect, useRef, useState } from 'react'
import { SyncButton } from '@/components/ui/SyncButton'
import { colors, spacing, typography } from '@/lib/tokens'

type SyncResult = { recorded: number; review: number; busy: number; failed: number; more: boolean; error?: string }

export function LeadEmailSync({ onSynced }: { onSynced: () => Promise<void> }) {
  const [available, setAvailable] = useState(false)
  const [connected, setConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const running = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/leads/sync', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) return
        const data = await response.json()
        if (!controller.signal.aborted) { setAvailable(true); setConnected(Boolean(data.connected)) }
      }).catch(() => {})
    return () => controller.abort()
  }, [])

  async function sync() {
    if (running.current) return
    running.current = true
    setSyncing(true); setMessage(''); setFailed(false)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 180000)
    try {
      const response = await fetch('/api/leads/sync', { method: 'POST', signal: controller.signal })
      const data: SyncResult = await response.json()
      if (!response.ok) throw new Error(data.error || 'Email sync failed. Please retry or check Gmail in Settings → Integrations.')
      setFailed(data.failed > 0)
      setMessage([
        `${data.recorded} email ${data.recorded === 1 ? 'note' : 'notes'} captured.`,
        data.review ? `${data.review} need review in Settings → Integrations.` : '',
        data.busy ? 'A mailbox is already syncing. Try again shortly to refresh its notes.' : '',
        data.failed ? 'Some mailboxes failed. Retry or check Gmail in Settings → Integrations.' : '',
        data.more ? 'More messages remain; sync again or let automatic syncing continue.' : '',
      ].filter(Boolean).join(' '))
      await onSynced()
    } catch (error) {
      setFailed(true)
      setMessage(error instanceof Error && error.name !== 'AbortError' ? error.message : 'Sync took too long. Automatic syncing will continue; try again shortly.')
    } finally {
      window.clearTimeout(timeout)
      running.current = false
      setSyncing(false)
    }
  }

  if (!available) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: spacing.xs, maxWidth: 360 }}>
      <SyncButton syncing={syncing} onClick={() => void sync()} label="Sync emails" syncingLabel="Syncing emails" disabled={!connected}
        title={connected ? 'Capture sent emails from connected Gmail mailboxes into matching lead notes' : 'Connect Gmail in Settings → Integrations to sync lead notes'} />
      {!connected && <span style={{ color: colors.textSecondary, fontSize: typography.sizeSm }}>Connect Gmail in Settings → Integrations.</span>}
      {message && <span role={failed ? 'alert' : 'status'} style={{ color: failed ? colors.error : colors.textSecondary, fontSize: typography.sizeSm }}>{message}</span>}
    </div>
  )
}