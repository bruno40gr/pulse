import { crmSupabaseAdmin as db } from '@/lib/supabase/crm-admin'
import { conversationDirectory } from '@/lib/conversations-directory'
import { emailDateRange, isLeadEmailContact } from '@/lib/conversation-email-range'
import { validEmail } from './conversations'
import { queueStoredEmailImport } from './conversation-store'

/** Queue the default range without requiring anyone to open Conversations.
 * The worker still checks the configuring member's permissions before Gmail access.
 * Duplicate schedules preserve completed imports and in-flight checkpoints.
 */
export async function preloadConversationEmail(deadline: number) {
  const range = emailDateRange(null, null)
  let queued = 0
  const audiences = new Map<string, string[]>()
  for (let offset = 0; Date.now() + 3000 < deadline; offset += 100) {
    const result = await db.from('gmail_connections').select('id,tenant_id').order('id').range(offset, offset + 99)
    if (result.error) throw new Error('Background email preload unavailable.')
    for (const mailbox of result.data || []) {
      if (Date.now() + 3000 >= deadline) return queued
      let addresses = audiences.get(mailbox.tenant_id)
      if (!addresses) {
        const people = await conversationDirectory(mailbox.tenant_id, false, true)
        addresses = [...new Set(people.filter(isLeadEmailContact).map(person => person.email.trim().toLowerCase()).filter(validEmail))].sort()
        audiences.set(mailbox.tenant_id, addresses)
      }
      if (!addresses.length || Date.now() + 3000 >= deadline) continue
      await queueStoredEmailImport(mailbox.tenant_id, mailbox.id, addresses, range)
      queued++
    }
    if ((result.data || []).length < 100) break
  }
  return queued
}