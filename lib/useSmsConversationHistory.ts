'use client'

import { useEffect, useRef, useState } from 'react'
import { smsDestination } from '@/lib/communication-recipients'
import type { LiveThread } from '@/lib/conversations-live'
import { startVisiblePolling } from '@/lib/visible-polling'

type InboxThread = { other_phone: string; messages: { id: string; direction: 'inbound' | 'outbound'; body: string | null; created_at: string; status?: string }[] }
type History = { key: string; messages: LiveThread['messages']; loading: boolean; error: string }

/** Read the same authorized inbox as Communications; isolate history by normalized destination. */
export function useSmsConversationHistory(tenantId: string, destination: string, active = true, refresh = 0, request: (input: string, init?: RequestInit) => Promise<Response> = fetch) {
  const address = smsDestination(destination)
  const key = `${tenantId}:${address}`
  const cache = useRef(new Map<string, LiveThread['messages']>())
  const [state, setState] = useState<History>({ key: '', messages: [], loading: true, error: '' })
  useEffect(() => {
    if (!active || !tenantId || !address) return
    let stopped = false
    const cached = cache.current.get(key)
    setState({ key, messages: cached || [], loading: !cached, error: '' })
    const poller = startVisiblePolling(async signal => {
      try {
        const response = await request(`/api/inbox?tenant=${encodeURIComponent(tenantId)}`, { signal })
        const inbox = await response.json()
        if (!response.ok || !Array.isArray(inbox)) throw new Error(inbox.error || 'Could not load SMS history.')
        const messages: LiveThread['messages'] = [...new Map((inbox as InboxThread[])
          .filter(thread => smsDestination(thread.other_phone) === address)
          .flatMap(thread => thread.messages).map(message => [message.id, message])).values()]
          .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
          .map(message => ({ id: message.id, channel: 'sms', direction: message.direction, body: message.body || '', timestamp: message.created_at, time: message.status || '', status: message.status }))
        if (stopped || signal.aborted) return
        cache.current.set(key, messages)
        setState({ key, messages, loading: false, error: '' })
      } catch (error) {
        if (!stopped) setState(current => ({ key, messages: current.key === key ? current.messages : [], loading: false, error: signal.aborted ? 'SMS history refresh timed out. Please retry.' : error instanceof Error ? error.message : 'Could not load SMS history.' }))
      }
    })
    return () => { stopped = true; poller.stop() }
  }, [active, tenantId, address, key, refresh, request])
  return state.key === key ? state : { key, messages: cache.current.get(key) || [], loading: !!address && !cache.current.has(key), error: '' }
}