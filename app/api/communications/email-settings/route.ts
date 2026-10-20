import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'
import { organisationConnection, organisationEmailSettings } from '@/lib/organisation-email'
import { organisationDomain, type GoogleSendAs, type OrganisationAlias } from '@/lib/organisation-email-policy'
import { gmailGet } from '@/lib/gmail/google'
import { validEmail } from '@/lib/gmail/conversations'
import { writeAccountAuditEvent } from '@/lib/account-audit'

const headers = { 'Cache-Control': 'private, no-store' }
export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  if (access.context?.roleKey !== 'owner') return NextResponse.json({ owner: false }, { headers })
  try {
    const [settings, connections, members] = await Promise.all([
      organisationEmailSettings(access.tenantId),
      crmSupabaseAdmin.from('gmail_connections').select('id,email').eq('tenant_id', access.tenantId).order('email'),
      supabaseAdmin.from('tenant_memberships').select('id,status,people(first_name,last_name,email)').eq('tenant_id', access.tenantId).in('status', ['active', 'invited', 'unclaimed']),
    ])
    if (connections.error || members.error) throw new Error('Email settings unavailable.')
    let verifiedAliases: GoogleSendAs[] = []
    let warning = ''
    const selectedId = new URL(request.url).searchParams.get('connection') || settings?.connection_id
    if (selectedId) {
      try {
        const connection = await organisationConnection(access.tenantId, selectedId)
        const aliases = await gmailGet<{ sendAs?: GoogleSendAs[] }>(connection.token, 'settings/sendAs')
        const domain = organisationDomain(connection.email)
        verifiedAliases = (aliases.sendAs || []).filter(alias => alias.verificationStatus === 'accepted' && alias.sendAsEmail.split('@')[1] === domain && alias.sendAsEmail !== connection.email)
          .map(alias => ({ sendAsEmail: alias.sendAsEmail, displayName: alias.displayName }))
      } catch (error) { warning = error instanceof Error ? error.message : 'Aliases unavailable.' }
    }
    return NextResponse.json({ owner: true, settings, connections: connections.data, members: members.data, verifiedAliases, warning }, { headers })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Email settings unavailable.' }, { status: 503, headers }) }
}

export async function PUT(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsConfigure })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  if (access.context?.roleKey !== 'owner') return NextResponse.json({ error: 'Only the account owner can configure organisation email.' }, { status: 403, headers })
  const body = await request.json().catch(() => null)
  if (!body || typeof body.connectionId !== 'string' || typeof body.displayName !== 'string' || !body.displayName.trim() || body.displayName.length > 200 || !Array.isArray(body.aliases) || body.aliases.length > 100) return NextResponse.json({ error: 'Choose a shared mailbox and sender name.' }, { status: 400, headers })
  if (typeof body.signatureText !== 'string' || body.signatureText.length > 5000) return NextResponse.json({ error: 'Use a signature of up to 5,000 characters.' }, { status: 400, headers })
  try {
    const connection = await organisationConnection(access.tenantId, body.connectionId)
    const domain = organisationDomain(connection.email)
    const verified = await gmailGet<{ sendAs?: GoogleSendAs[] }>(connection.token, 'settings/sendAs')
    const aliases: OrganisationAlias[] = []
    for (const item of body.aliases) {
      if (!item || typeof item.email !== 'string' || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 200 || typeof item.membershipId !== 'string') throw new Error('Choose a member and name for each alias.')
      const email = item.email.trim().toLowerCase()
      if (!validEmail(email) || email.split('@')[1] !== domain || email === connection.email || aliases.some(alias => alias.email === email) || !verified.sendAs?.some(alias => alias.sendAsEmail.toLowerCase() === email && alias.verificationStatus === 'accepted')) throw new Error('Use unique, verified aliases on the shared mailbox’s domain.')
      const { data, error } = await supabaseAdmin.from('tenant_memberships').select('id').eq('tenant_id', access.tenantId).eq('id', item.membershipId).in('status', ['active', 'invited', 'unclaimed']).maybeSingle()
      if (error || !data) throw new Error('Choose a current member of this account.')
      if (item.signatureText !== undefined && (typeof item.signatureText !== 'string' || item.signatureText.length > 5000)) throw new Error('Use a signature of up to 5,000 characters.')
      aliases.push({ email, name: item.name.trim(), membershipId: item.membershipId, signatureText: item.signatureText?.trim() || '' })
    }
    const { error } = await crmSupabaseAdmin.from('organisation_email_settings').upsert({ tenant_id: access.tenantId, connection_id: connection.id, display_name: body.displayName.trim(), signature_text: body.signatureText.trim(), aliases, configured_by: access.context.membershipId, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' })
    if (error) throw new Error('Settings could not be saved. Apply Migration 026 in the CRM database.')
    await writeAccountAuditEvent({ tenantId: access.tenantId, actorMembershipId: access.context.membershipId, eventType: 'communications.organisation_email_configured', metadata: { connection_id: connection.id, alias_count: aliases.length } })
    return NextResponse.json({ ok: true }, { headers })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Email settings could not be saved.' }, { status: 400, headers }) }
}