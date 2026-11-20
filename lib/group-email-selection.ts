import type { RecipientResolution } from '@/lib/communication-recipients'

export type GroupEmailRecipients = { to: string[]; cc: string[]; bcc: string[] }

/** Addresses are proposals only: every destination must belong to the fresh routed audience. */
export function groupEmailSelection(value: unknown, audience: RecipientResolution): GroupEmailRecipients {
  if (!value || typeof value !== 'object') throw new Error('Choose email recipients.')
  const input = value as Record<string, unknown>
  const result: GroupEmailRecipients = { to: [], cc: [], bcc: [] }
  const allowed = new Set(audience.recipients.map(row => row.destination))
  const seen = new Set<string>()
  for (const field of ['to', 'cc', 'bcc'] as const) {
    if (!Array.isArray(input[field])) throw new Error('Choose valid To, CC and BCC recipients.')
    for (const address of input[field]) {
      if (typeof address !== 'string' || !allowed.has(address) || seen.has(address)) throw new Error('Recipient details changed. Review the recipients before sending.')
      seen.add(address)
      result[field].push(address)
    }
  }
  if (!seen.size || seen.size > 50) throw new Error('Select between 1 and 50 recipients for a CC/BCC email. Use individual emails for larger audiences.')
  return result
}