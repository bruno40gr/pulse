import { supabaseAdmin } from '@/lib/supabase/admin'

// Deletion order respects foreign keys (children before parents).
const RESET_TABLES = [
  'messages',
  'campaigns',
  'enrollments',
  'students',
  'instructors',
  'accounts',
  'people',
  'contacts',
  'tenant_fields',
] as const

export async function resetTenantContactData(tenantId: string): Promise<{ deleted: Record<string, number> }> {
  const deleted: Record<string, number> = {}
  for (const table of RESET_TABLES) {
    const { error, count } = await supabaseAdmin.from(table).delete({ count: 'exact' }).eq('tenant_id', tenantId)
    if (error) throw new Error(`${table}: ${error.message}`)
    deleted[table] = count ?? 0
  }
  return { deleted }
}
