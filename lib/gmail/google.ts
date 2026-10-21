export async function googleToken(parameters: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; scope?: string }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...parameters, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET! }),
    signal: AbortSignal.timeout(15000), cache: 'no-store',
  })
  if (!response.ok) throw new Error('Google authorization failed. Reconnect the mailbox.')
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

export async function gmailGet<T>(token: string, path: string): Promise<T> {
  // Reads are safe to retry. Sending deliberately does not use this helper.
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response
    try {
      response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000), cache: 'no-store',
      })
    } catch {
      if (attempt === 1) throw new GmailReadError(0)
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
    if (attempt === 0 && error.retryable) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      continue
    }
    throw error
  }
  throw new GmailReadError(0)
}