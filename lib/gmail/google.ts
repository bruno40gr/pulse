/** Fixed classification only: provider descriptions can contain sensitive data. */
export class GoogleTokenError extends Error {
  constructor(public readonly reconnect: boolean) {
    super(reconnect ? 'Reconnect the mailbox.' : 'Google authorization temporarily unavailable.')
    this.name = 'GoogleTokenError'
  }
}

function requestTimeout(deadline?: number) {
  const remaining = deadline === undefined ? 15000 : Math.min(15000, deadline - Date.now())
  if (remaining <= 0) throw new GmailReadError(0)
  return AbortSignal.timeout(Math.max(1, Math.floor(remaining)))
}

export async function googleToken(parameters: Record<string, string>, deadline?: number): Promise<{ access_token: string; refresh_token?: string; scope?: string }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...parameters, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET! }),
    signal: requestTimeout(deadline), cache: 'no-store',
  })
  if (!response.ok) {
    let invalidGrant = false
    try { invalidGrant = (await response.json())?.error === 'invalid_grant' } catch { /* Never retain provider bodies. */ }
    throw new GoogleTokenError(invalidGrant)
  }
  const result = await response.json()
  if (!result.access_token) throw new Error('Google did not return mailbox access.')
  return result
}
const readReasons = ['rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded', 'quotaExceeded', 'insufficientPermissions', 'domainPolicy', 'forbidden', 'authError'] as const
type ReadReason = typeof readReasons[number] | 'unknown'

/** Only allowlisted classifications survive parsing; provider text is never retained. */
export class GmailReadError extends Error {
  constructor(public readonly status: number, public readonly reason: ReadReason = 'unknown') {
    super('Gmail could not be read. Please try again.')
    this.name = 'GmailReadError'
  }

  get retryable() {
    return this.status === 0 || this.status === 429 || this.status >= 500 || ['rateLimitExceeded', 'userRateLimitExceeded'].includes(this.reason)
  }
}

export async function gmailGet<T>(token: string, path: string, deadline?: number): Promise<T> {
  // Reads are safe to retry. Sending deliberately does not use this helper.
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response
    try {
      response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
        headers: { Authorization: `Bearer ${token}` }, signal: requestTimeout(deadline), cache: 'no-store',
      })
    } catch {
      if (attempt === 1 || (deadline !== undefined && Date.now() + 1000 >= deadline)) throw new GmailReadError(0)
      await new Promise(resolve => setTimeout(resolve, 1000))
      continue
    }
    if (response.ok) return response.json()
    let reason: ReadReason = 'unknown'
    try {
      const body = await response.json()
      const reasons: unknown[] = Array.isArray(body?.error?.errors) ? body.error.errors.map((item: { reason?: unknown } | null) => item?.reason) : []
      reason = readReasons.find(known => reasons.includes(known)) || 'unknown'
    } catch { /* Invalid provider bodies never replace the safe status. */ }
    const error = new GmailReadError(response.status, reason)
    if (attempt === 0 && error.retryable && (deadline === undefined || Date.now() + 1000 < deadline)) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      continue
    }
    throw error
  }
  throw new GmailReadError(0)
}