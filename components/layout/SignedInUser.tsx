'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getActiveTenantId } from '@/lib/tenant'
import { typography } from '@/lib/tokens'

type Identity = { fullName: string; isDemo: boolean }

export default function SignedInUser({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname()
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    let controller: AbortController | null = null
    let revision = 0

    async function loadIdentity() {
      const currentRevision = ++revision
      controller?.abort()
      const currentController = new AbortController()
      controller = currentController
      setIdentity(null)
      setStatus('loading')
      const timeout = window.setTimeout(() => currentController.abort(), 10000)
      try {
        const response = await fetch(`/api/account/identity?tenant=${encodeURIComponent(getActiveTenantId())}`, {
          cache: 'no-store', signal: currentController.signal,
        })
        if (!response.ok) throw new Error('Identity unavailable')
        const data: Identity = await response.json()
        if (typeof data.fullName !== 'string' || !data.fullName.trim()) throw new Error('Name unavailable')
        if (!cancelled && currentRevision === revision) {
          setIdentity(data)
          setStatus('ready')
        }
      } catch {
        if (!cancelled && currentRevision === revision) {
          setIdentity(null)
          setStatus('error')
        }
      } finally {
        window.clearTimeout(timeout)
      }
    }

    const refresh = () => { if (document.visibilityState !== 'hidden') void loadIdentity() }
    void loadIdentity()
    const interval = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      cancelled = true
      controller?.abort()
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [pathname])

  const name = status === 'loading' ? 'Checking sign-in…'
    : status === 'error' ? 'Unable to verify signed-in user' : identity?.fullName

  return (
    <div role="status" aria-live="polite" style={{ minWidth: 0, padding: compact ? 0 : '10px 12px', lineHeight: 1.35 }}>
      <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: typography.sizeXs }}>
        {identity?.isDemo ? 'Demo access' : 'Signed in as'}
      </div>
      <div style={{ color: '#fff', fontSize: compact ? typography.sizeXs : typography.sizeSm, fontWeight: typography.weightSemibold, overflowWrap: 'anywhere' }}>
        {name}
      </div>
    </div>
  )
}