import { createPortalQueue, readPortalQueue, portalQueueKey, type PortalQueue } from './academy-portal-queue'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>

/** One immutable snapshot per browser module, not one storage read per subscriber.
 * Storage is a reload backup, never the transaction coordinator or authorization.
 * Injected storage keeps failure and write-count behavior testable without React.
 */
export function createPortalStore(storage: () => Storage | undefined) {
  const initial = createPortalQueue()
  let snapshot = initial
  let loaded = false
  const listeners = new Set<() => void>()
  const hydrate = () => {
    if (loaded) return
    loaded = true
    try { snapshot = readPortalQueue(storage()?.getItem(portalQueueKey)) } catch { /* Retain the in-memory snapshot. */ }
  }
  return {
    getServerSnapshot: () => initial,
    getSnapshot: () => { hydrate(); return snapshot },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    update: (change: (current: PortalQueue) => PortalQueue) => {
      hydrate()
      const next = change(snapshot)
      if (next === snapshot) return
      snapshot = next
      try { storage()?.setItem(portalQueueKey, JSON.stringify(next)) } catch { /* Session backup is optional; all subscribers still update. */ }
      listeners.forEach(listener => listener())
    },
  }
}
