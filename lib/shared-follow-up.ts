/** Keep the additive database-dependent surface off until the CRM migration is verified. */
export function sharedFollowUpsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_SHARED_FOLLOW_UPS === 'true'
}

export interface SharedFollowUp {
  id: string
  person_id: string | null
  lead_intake_id: string | null
  due_at: string | null
  message: string | null
  status: 'open' | 'cleared' | 'completed'
  owner_membership_id: string | null
  version: number
  updated_at: string
}

export const followUpUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type SharedFollowUpCommand = {
  action: 'save' | 'clear' | 'complete'
  lead_intake_id: string | null
  expected_version: number
  due_at: string | null
  message: string | null
}

export function parseSharedFollowUpCommand(body: unknown): SharedFollowUpCommand | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const value = body as Record<string, unknown>
  if (!['save', 'clear', 'complete'].includes(String(value.action)) ||
    !Number.isSafeInteger(value.expected_version) || Number(value.expected_version) < 0 ||
    (value.lead_intake_id !== null && (typeof value.lead_intake_id !== 'string' || !followUpUuid.test(value.lead_intake_id)))) return null
  if (value.action === 'save' && (typeof value.due_at !== 'string' || !Number.isFinite(Date.parse(value.due_at)) ||
    (value.message !== null && (typeof value.message !== 'string' || value.message.length > 12000)))) return null
  return {
    action: value.action as SharedFollowUpCommand['action'],
    lead_intake_id: value.lead_intake_id as string | null,
    expected_version: Number(value.expected_version),
    due_at: value.action === 'save' ? new Date(value.due_at as string).toISOString() : null,
    message: value.action === 'save' ? (value.message as string | null)?.trim() || null : null,
  }
}