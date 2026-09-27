import { supabaseAdmin } from '@/lib/supabase/admin'

export async function writeAccountAuditEvent(input: {
  tenantId: string
  actorMembershipId: string
  eventType: string
  metadata?: Record<string, unknown>
}): Promise<boolean> {
  const { error } = await supabaseAdmin.from('account_audit_events').insert({
    tenant_id: input.tenantId,
    actor_membership_id: input.actorMembershipId,
    event_type: input.eventType,
    metadata: input.metadata || {},
  })

  if (error) {
    console.error(`Account audit event failed (${input.eventType}):`, error)
    return false
  }

  return true
}