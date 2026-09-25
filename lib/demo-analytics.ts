const VISITOR_STORAGE_KEY = 'pulse_demo_visitor_id'
const SESSION_STORAGE_KEY = 'pulse_demo_session_id'

export type DemoEventType =
  | 'demo_intro_viewed'
  | 'demo_environment_selected'
  | 'demo_entered_app'
  | 'demo_dashboard_viewed'

export interface DemoEventPayload {
  eventType: DemoEventType
  tenantId?: string | null
  path?: string
  metadata?: Record<string, unknown>
}

function ensureBrowserStorage(storage: Storage | undefined, key: string): string {
  if (!storage) return 'server-unavailable'

  try {
    const existing = storage.getItem(key)
    if (existing) return existing

    const value = crypto.randomUUID()
    storage.setItem(key, value)
    return value
  } catch {
    return 'storage-unavailable'
  }
}

export function getDemoVisitorId(): string {
  if (typeof window === 'undefined') return 'server-unavailable'
  return ensureBrowserStorage(window.localStorage, VISITOR_STORAGE_KEY)
}

export function getDemoSessionId(): string {
  if (typeof window === 'undefined') return 'server-unavailable'
  return ensureBrowserStorage(window.sessionStorage, SESSION_STORAGE_KEY)
}

export async function trackDemoEvent({ eventType, tenantId = null, path, metadata = {} }: DemoEventPayload): Promise<void> {
  if (typeof window === 'undefined') return

  const body = {
    eventType,
    tenantId,
    visitorId: getDemoVisitorId(),
    sessionId: getDemoSessionId(),
    path: path || window.location.pathname,
    metadata,
  }

  try {
    await fetch('/api/demo-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    })
  } catch {
    // No-op: analytics should never block the demo flow.
  }
}
