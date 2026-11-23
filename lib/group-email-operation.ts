import { createHash } from 'node:crypto'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'

type Operation = { tenantId: string; membershipId: string; operationId: string; fingerprint: string }

/** A unique database insert is the send lock, shared by every server/session. */
export async function reserveGroupEmail(operation: Operation): Promise<'reserved' | 'sent' | 'uncertain'> {
  const { tenantId, membershipId, operationId, fingerprint } = operation
  const result = await crmSupabaseAdmin.from('group_email_operations').insert({ tenant_id: tenantId,
    operation_id: operationId, membership_id: membershipId, fingerprint, status: 'uncertain' })
  if (!result.error) return 'reserved'
  if (result.error.code !== '23505') throw new Error('Shared-email delivery protection is unavailable. Ask the owner to apply the group email operations migration. No email was sent.')
  const previous = await crmSupabaseAdmin.from('group_email_operations').select('membership_id,fingerprint,status')
    .eq('tenant_id', tenantId).eq('operation_id', operationId).maybeSingle()
  if (previous.error || !previous.data || previous.data.membership_id !== membershipId || previous.data.fingerprint !== fingerprint) {
    throw new Error('This email operation cannot be reused for a different sender or message.')
  }
  return previous.data.status === 'sent' ? 'sent' : 'uncertain'
}

export function groupEmailFingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export async function confirmGroupEmail(operation: Operation, providerMessageId: string) {
  const result = await crmSupabaseAdmin.from('group_email_operations').update({ status: 'sent', provider_message_id: providerMessageId })
    .eq('tenant_id', operation.tenantId).eq('operation_id', operation.operationId)
    .eq('membership_id', operation.membershipId).eq('fingerprint', operation.fingerprint).select('operation_id').single()
  if (result.error || !result.data) throw new Error('Delivery confirmation could not be saved.')
}