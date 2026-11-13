import type { NavigationAccess } from './work-area-navigation'

export type AccountContext = Required<NavigationAccess> & {
  tenantId: string
  membershipId: string
  isOwner: boolean
  canManageAccounts: boolean
  canUpdateCredentials: boolean
  email: string | null
}

// Share only overlapping requests, not a persistent identity/permissions cache.
// Subscribers must ignore results after unmount; one subscriber cannot abort others.
const pending = new Map<string, Promise<AccountContext>>()

export function loadAccountContext(tenantId: string): Promise<AccountContext> {
  const existing = pending.get(tenantId)
  if (existing) return existing
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  const request = fetch(`/api/account/me?tenant=${encodeURIComponent(tenantId)}`, { cache: 'no-store', signal: controller.signal })
    .then(async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load account access.')
      if (data.tenantId !== tenantId || typeof data.membershipId !== 'string') throw new Error('Could not verify account access.')
      return data as AccountContext
    })
    .finally(() => { clearTimeout(timeout); if (pending.get(tenantId) === request) pending.delete(tenantId) })
  pending.set(tenantId, request)
  return request
}