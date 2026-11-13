'use client'

import { useSyncExternalStore } from 'react'
import { createPortalStore } from './academy-portal-store'

// Never read a browser snapshot on the server or share request-specific data there.
const store = createPortalStore(() => typeof window === 'undefined' ? undefined : window.sessionStorage)

/** Fictional, same-tab preview transport. No operational data or payment calls. */
export function usePortalQueue() {
  const queue = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
  return [queue, store.update] as const
}
