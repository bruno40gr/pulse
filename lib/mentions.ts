import { supabaseAdmin } from '@/lib/supabase/admin'

export type MentionEntityType = 'dashboard_note' | 'note_reply' | 'lead_note' | 'contact_internal_note'

type PersistMentionsInput = {
  tenantId: string
  actorMembershipId: string
  membershipIds: unknown
  entityType: MentionEntityType
  entityId: string
  parentEntityId?: string | null
  title: string
  body?: string | null
  link: string
}

export function parseMentionMembershipIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)))]
}

export async function validateMentionMembershipIds(tenantId: string, value: unknown): Promise<string[]> {
  const membershipIds = parseMentionMembershipIds(value)
  if (membershipIds.length === 0) return []
  const { data, error } = await supabaseAdmin
    .from('tenant_memberships')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('id', membershipIds)
    .in('status', ['unclaimed', 'invited', 'active'])
  if (error) throw error
  const validIds = new Set((data || []).map((membership) => membership.id))
  if (validIds.size !== membershipIds.length) throw new Error('One or more mentioned staff memberships are invalid.')
  return membershipIds
}

export async function persistMentions(input: PersistMentionsInput): Promise<string[]> {
  const membershipIds = await validateMentionMembershipIds(input.tenantId, input.membershipIds)
  if (membershipIds.length === 0) return []

  const mentionRows = membershipIds.map((membershipId) => ({
    tenant_id: input.tenantId,
    mentioned_membership_id: membershipId,
    actor_membership_id: input.actorMembershipId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    parent_entity_id: input.parentEntityId || null,
  }))
  const { error: mentionError } = await supabaseAdmin.from('mentions').upsert(mentionRows, {
    onConflict: 'tenant_id,mentioned_membership_id,entity_type,entity_id',
    ignoreDuplicates: true,
  })
  if (mentionError) throw mentionError

  const recipients = membershipIds.filter((membershipId) => membershipId !== input.actorMembershipId)
  if (recipients.length > 0) {
    const notifications = recipients.map((membershipId) => ({
      tenant_id: input.tenantId,
      recipient_membership_id: membershipId,
      actor_membership_id: input.actorMembershipId,
      reason: 'mention.created',
      entity_type: input.entityType,
      entity_id: input.entityId,
      title: input.title,
      body: input.body || null,
      link: input.link,
      deduplication_key: `mention.created:${input.entityType}:${input.entityId}`,
    }))
    const { error: notificationError } = await supabaseAdmin.from('notifications').upsert(notifications, {
      onConflict: 'tenant_id,recipient_membership_id,deduplication_key',
      ignoreDuplicates: true,
    })
    if (notificationError) throw notificationError
  }
  return membershipIds
}

export async function createReplyNotification(input: {
  tenantId: string
  actorMembershipId: string
  recipientMembershipId: string | null | undefined
  noteId: string
  replyId: string
  body: string
}) {
  if (!input.recipientMembershipId || input.recipientMembershipId === input.actorMembershipId) return
  const { error } = await supabaseAdmin.from('notifications').upsert({
    tenant_id: input.tenantId,
    recipient_membership_id: input.recipientMembershipId,
    actor_membership_id: input.actorMembershipId,
    reason: 'note.reply',
    entity_type: 'note_reply',
    entity_id: input.replyId,
    title: 'New reply to your note',
    body: input.body,
    link: `/dashboard/notes?note=${encodeURIComponent(input.noteId)}`,
    deduplication_key: `note.reply:${input.replyId}`,
  }, {
    onConflict: 'tenant_id,recipient_membership_id,deduplication_key',
    ignoreDuplicates: true,
  })
  if (error) throw error
}