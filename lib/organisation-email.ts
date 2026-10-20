import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { decryptToken } from '@/lib/gmail/security'
import { gmailGet, googleToken } from '@/lib/gmail/google'
import { authorisedOrganisationSenders, organisationDomain, type GoogleSendAs, type OrganisationEmailSettings } from '@/lib/organisation-email-policy'

export async function organisationEmailSettings(tenantId: string, options: { readOnly?: boolean } = {}) {
  const { data, error } = await crmSupabaseAdmin.from('organisation_email_settings').select('connection_id,display_name,signature_text,aliases').eq('tenant_id', tenantId).maybeSingle()
  // Existing private history does not depend on the organisation-send migration.
  // Sending keeps the strict default; only a missing table can be ignored here.
  if (options.readOnly && error && ['PGRST205', '42P01'].includes(error.code)) return null
  if (error) throw new Error('Organisation email settings unavailable. Apply Migration 026 in the CRM database.')
  return data as OrganisationEmailSettings | null
}

export async function organisationConnection(tenantId: string, connectionId: string) {
  const { data, error } = await crmSupabaseAdmin.from('gmail_connections').select('id,email,refresh_token_ciphertext,scopes').eq('tenant_id', tenantId).eq('id', connectionId).maybeSingle()
  if (error || !data) throw new Error('The shared mailbox is unavailable. Ask the account owner to reconnect it.')
  organisationDomain(data.email)
  if (!data.scopes?.includes('https://www.googleapis.com/auth/gmail.send') || !data.scopes?.includes('https://www.googleapis.com/auth/gmail.readonly')) throw new Error('Reconnect the shared mailbox to authorise sending and verify aliases.')
  const token = await googleToken({ grant_type: 'refresh_token', refresh_token: decryptToken(data.refresh_token_ciphertext) })
  return { ...data, token: token.access_token }
}

export async function organisationSenders(tenantId: string, membershipId: string) {
  const settings = await organisationEmailSettings(tenantId)
  if (!settings) return { senders: [], settings: null, connection: null }
  const connection = await organisationConnection(tenantId, settings.connection_id)
  const verified = await gmailGet<{ sendAs?: GoogleSendAs[] }>(connection.token, 'settings/sendAs')
  return { settings, connection, senders: authorisedOrganisationSenders(settings, connection.email, membershipId, verified.sendAs || []) }
}

/** All email sends, including the legacy Conversations endpoint, use this gate. */
export async function organisationSender(tenantId: string, membershipId: string, email?: string) {
  const result = await organisationSenders(tenantId, membershipId)
  if (!result.connection || !result.settings) throw new Error('Ask the account owner to configure the shared organisation email in Settings.')
  const sender = result.senders.find(item => item.email === (email || result.connection!.email))
  if (!sender) throw new Error('This sender is not an authorised organisation email identity.')
  return { ...result.connection, sender }
}