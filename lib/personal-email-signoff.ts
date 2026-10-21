import { supabaseAdmin } from '@/lib/supabase/admin'

export async function personalEmailSignoff(tenantId: string, membershipId: string, personId: string) {
  const [membership, person] = await Promise.all([
    supabaseAdmin.from('tenant_memberships').select('email_signoff').eq('tenant_id', tenantId).eq('id', membershipId).maybeSingle(),
    supabaseAdmin.from('people').select('first_name,last_name').eq('id', personId).maybeSingle(),
  ])
  if (person.error) throw new Error('Your profile name could not be loaded.')
  if (membership.error && !['42703', 'PGRST204'].includes(membership.error.code)) throw new Error('Your email sign-off could not be loaded.')
  const profileName = [person.data?.first_name, person.data?.last_name].filter(Boolean).join(' ')
  return {
    name: membership.data?.email_signoff?.name ?? profileName,
    role: membership.data?.email_signoff?.role ?? '',
    storageAvailable: !membership.error,
  }
}