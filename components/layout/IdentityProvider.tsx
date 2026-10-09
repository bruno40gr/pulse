'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { getActiveTenantId } from '@/lib/tenant'

type Identity = { fullName: string; firstName: string; avatarUrl: string | null; isDemo: boolean }
type IdentityState = { identity: Identity | null; error: boolean; clearIdentity: () => void }
const IdentityContext = createContext<IdentityState>({ identity: null, error: false, clearIdentity: () => {} })

export function useIdentity() { return useContext(IdentityContext) }

export default function IdentityProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [error, setError] = useState(false)
  const cleared = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    const timeout = window.setTimeout(() => controller.abort(), 10000)
    void fetch(`/api/account/identity?tenant=${encodeURIComponent(getActiveTenantId())}`, {
      cache: 'no-store', signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error('Identity unavailable')
      const data = await response.json() as Identity
      if (!data.firstName?.trim()) throw new Error('Name unavailable')
      if (!cancelled && !cleared.current) setIdentity(data)
    }).catch(() => {
      if (!cancelled && !cleared.current) setError(true)
    }).finally(() => window.clearTimeout(timeout))
    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [])

  return (
    <IdentityContext.Provider value={{ identity, error, clearIdentity: () => { cleared.current = true; setIdentity(null); setError(false) } }}>
      {children}
    </IdentityContext.Provider>
  )
}