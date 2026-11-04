import { supabaseAdmin } from '@/lib/supabase/admin'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { parseNoteTask, type NoteTask } from '@/lib/note-tasks'
import { validateMentionMembershipIds } from '@/lib/mentions'
import { PERMISSIONS } from '@/lib/permissions'
import type { MembershipRequestContext } from '@/lib/request-context'

export class NoteTaskError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export async function validateNoteTask(tenantId: string, value: unknown, context: MembershipRequestContext | null, existingPersonId?: string | null): Promise<NoteTask> {
  if (!context) throw new NoteTaskError('A staff account is required to assign tasks.', 403)
  let task: NoteTask
  try { task = parseNoteTask(value) } catch (error) { throw new NoteTaskError((error as Error).message) }
  try { await validateMentionMembershipIds(tenantId, [task.ownerId]) }
  catch { throw new NoteTaskError('The selected owner is not an eligible staff member in this account.') }
  if (task.personId && task.personId !== existingPersonId) {
    const [kind, id] = task.personId.split(':')
    const required = kind === 'lead' ? PERMISSIONS.leadsRead : PERMISSIONS.contactsRead
    if (context.roleKey !== 'owner' && !context.permissions.has(required)) throw new NoteTaskError('You cannot link this type of record.', 403)
    const database = kind === 'lead' ? crmSupabaseAdmin : supabaseAdmin
    const { data, error } = await database.from(kind === 'lead' ? 'lead_intakes' : 'people').select('id').eq('id', id).eq('tenant_id', tenantId).maybeSingle()
    if (error) throw error
    if (!data) throw new NoteTaskError('The related record is unavailable in this account.')
  }
  return task
}