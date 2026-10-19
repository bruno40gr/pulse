import { NextRequest, NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { decryptToken, encryptToken, gmailRedirectUri, secretMatches } from '@/lib/gmail/security'
import { gmailGet, googleToken } from '@/lib/gmail/google'
import { crmSupabaseAdmin } from '@/lib/supabase/crm-admin'

export async function GET(request: NextRequest) {
  const destination = new URL('/dashboard/settings?tab=integrations', request.url)
  let result = 'error'
  try {
    const cookie = request.cookies.get('pulse_gmail_oauth')?.value
    if (!cookie) throw new Error('Missing OAuth state')
    const state = JSON.parse(decryptToken(cookie)) as { state: string; verifier: string; tenantId: string; membershipId: string; expiresAt: number }
    if (state.expiresAt < Date.now() || !secretMatches(request.nextUrl.searchParams.get('state') || '', state.state)) throw new Error('Invalid OAuth state')
    const accessRequest = new Request(new URL(`/api/gmail?tenant=${state.tenantId}`, request.url), { headers: request.headers })
    const access = await authorizeTenantRequest(accessRequest, { permission: PERMISSIONS.communicationsConfigure })
    if (!access.ok || access.context?.membershipId !== state.membershipId || (access.context.roleKey !== 'owner' && !access.context.permissions.has(PERMISSIONS.leadsManage))) throw new Error('Account changed')
    const code = request.nextUrl.searchParams.get('code')
    if (!code) throw new Error('Consent not granted')
    const token = await googleToken({ code, code_verifier: state.verifier, grant_type: 'authorization_code', redirect_uri: gmailRedirectUri() })
    if (!token.refresh_token || !token.scope?.split(' ').includes('https://www.googleapis.com/auth/gmail.readonly')) throw new Error('Read-only permission required')
    const profile = await gmailGet<{ emailAddress: string }>(token.access_token, 'profile')
    const email = profile.emailAddress.toLowerCase()
    const { data: existing, error: lookupError } = await crmSupabaseAdmin.from('gmail_connections').select('id,capture_from,lease_until').eq('tenant_id', state.tenantId).eq('email', email).maybeSingle()
    if (lookupError || (existing?.lease_until && Date.parse(existing.lease_until) > Date.now())) throw new Error('Mailbox busy')
    const { error } = await crmSupabaseAdmin.from('gmail_connections').upsert({
      ...(existing ? { id: existing.id } : {}), tenant_id: state.tenantId, email, refresh_token_ciphertext: encryptToken(token.refresh_token),
      connected_by: state.membershipId, capture_from: existing?.capture_from || new Date().toISOString(), last_error: null,
    }, { onConflict: 'tenant_id,email' })
    if (error) throw error
    result = 'connected'
  } catch { /* Never include tokens or provider errors in URLs or logs. */ }
  destination.searchParams.set('gmail', result)
  const response = NextResponse.redirect(destination)
  response.cookies.set('pulse_gmail_oauth', '', { httpOnly: true, path: '/api/gmail', maxAge: 0 })
  return response
}