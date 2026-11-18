export const EMAIL_RECIPIENT_PAGE_SIZE = 50
export const EMAIL_RECIPIENT_STATUSES = ['sent', 'failed', 'sending', 'unknown'] as const
export const EMAIL_OPERATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const limits = ['dailyLimitExceeded', 'rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded']
const reasons = [...limits, 'domainPolicy', 'insufficientPermissions', 'authError', 'invalidArgument', 'badRequest', 'failedPrecondition', 'backendError']

export async function gmailSendDiagnostic(response: Response) {
  const payload = await response.json().catch(() => null)
  const providerReason: unknown = payload?.error?.errors?.[0]?.reason
  const reason = typeof providerReason === 'string' && reasons.includes(providerReason) ? providerReason : null
  const category = response.status === 429 || (reason !== null && limits.includes(reason)) ? 'rate_limit'
    : response.status === 401 || response.status === 403 ? 'mailbox_access'
      : response.status >= 400 && response.status < 500 ? 'rejected' : 'uncertain'
  return { httpStatus: response.status, reason, category }
}

export function emailCampaignCounts(metadata: Record<string, unknown>) {
  const count = (key: string) => {
    const n = metadata[key]
    return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : 0
  }
  return { accepted: count('sent'), failed: count('failed'), unattempted: count('pending'), uncertain: count('uncertain'), excluded: count('excluded') }
}

export function recipientPage(value: string | null) {
  if (value === null) return 1
  if (!/^\d{1,3}$/.test(value)) return null
  const page = Number(value)
  return page >= 1 && page <= 100 ? page : null
}