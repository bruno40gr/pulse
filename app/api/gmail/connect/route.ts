import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { encryptToken, gmailConfigured, gmailRedirectUri } from '@/lib/gmail/security'

export async function POST(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsConfigure })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  if (!gmailConfigured()) return NextResponse.json({ error: 'Google OAuth and token encryption are not configured yet.' }, { status: 503 })
  if (!access.context || (access.context.roleKey !== 'owner' && !access.context.permissions.has(PERMISSIONS.leadsManage))) return NextResponse.json({ error: 'Lead management permission is required.' }, { status: 403 })
  const state = randomBytes(32).toString('base64url')
  const verifier = randomBytes(32).toString('base64url')
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: gmailRedirectUri(), response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly', access_type: 'offline', prompt: 'consent select_account', state,
    code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url') }).toString()
  const response = NextResponse.json({ url: url.toString() }, { headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set('pulse_gmail_oauth', encryptToken(JSON.stringify({ state, verifier, tenantId: access.tenantId, membershipId: access.context.membershipId, expiresAt: Date.now() + 600000 })),
    { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/gmail', maxAge: 600 })
  return response
}