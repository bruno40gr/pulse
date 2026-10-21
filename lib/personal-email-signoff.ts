import { supabaseAdmin } from '@/lib/supabase/admin'
import { brandLogos } from '@/lib/brand-logos'

export async function personalEmailSignoff(tenantId: string, membershipId: string, personId: string) {
  const [membership, person, brand] = await Promise.all([
    supabaseAdmin.from('tenant_memberships').select('email_signoff').eq('tenant_id', tenantId).eq('id', membershipId).maybeSingle(),
    supabaseAdmin.from('people').select('first_name,last_name').eq('id', personId).maybeSingle(),
    supabaseAdmin.from('tenant_settings').select('logo_on_white_url,logo_on_dark_url').eq('tenant_id', tenantId).maybeSingle(),
  ])
  if (person.error) throw new Error('Your profile name could not be loaded.')
  if (membership.error && !['42703', 'PGRST204'].includes(membership.error.code)) throw new Error('Your email sign-off could not be loaded.')
  const profileName = [person.data?.first_name, person.data?.last_name].filter(Boolean).join(' ')
  if (brand.error && !['42703', 'PGRST204', 'PGRST205', '42P01'].includes(brand.error.code)) throw new Error('Company logo could not be loaded.')
  const logos = brandLogos(brand.error ? null : brand.data)
  const companyLogoUrl = logos.ready ? logos.onWhite : ''
  const includeCompanyLogo = logos.ready && (membership.data?.email_signoff?.includeCompanyLogo ?? Boolean(membership.data?.email_signoff?.logoUrl))
  return {
    name: membership.data?.email_signoff?.name ?? profileName,
    role: membership.data?.email_signoff?.role ?? '',
    includeCompanyLogo,
    companyLogoUrl,
    logoUrl: includeCompanyLogo ? companyLogoUrl : '',
    phone: membership.data?.email_signoff?.phone ?? '',
    storageAvailable: !membership.error,
  }
}