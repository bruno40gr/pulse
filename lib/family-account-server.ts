import { supabaseAdmin } from '@/lib/supabase/admin'
import type { FamilyAccountLink } from '@/lib/family-account'

/** Old schema means unsupported, not a fabricated family. Other failures must surface. */
export async function readFamilyAccountLinks(tenantId: string) {
  const links: FamilyAccountLink[] = []
  for (let offset = 0; ; offset += 500) {
    const result = await supabaseAdmin.from('family_account_links').select('family_account_id,member_account_id')
      .eq('tenant_id', tenantId).order('member_account_id').range(offset, offset + 499)
    if (result.error) {
      if (['42P01', 'PGRST205'].includes(result.error.code || '')) return { supported: false, links: [] as FamilyAccountLink[] }
      throw new Error('Family account links could not be loaded.')
    }
    links.push(...(result.data || []))
    if ((result.data || []).length < 500) return { supported: true, links }
  }
}

/** Family labels use accounts, never a child or inferred adult person identity. */
export async function readFamilyAccountNames(tenantId: string, links: FamilyAccountLink[]) {
  const names = new Map<string, string>()
  const ids = [...new Set(links.map(link => link.family_account_id))]
  for (let start = 0; start < ids.length; start += 100) {
    const result = await supabaseAdmin.from('accounts').select('id,name').eq('tenant_id', tenantId).in('id', ids.slice(start, start + 100))
    if (result.error) throw new Error('Family account names could not be loaded.')
    for (const row of result.data || []) names.set(row.id, row.name)
  }
  return names
}