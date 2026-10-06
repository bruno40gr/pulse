import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { reconcileInboundSms } from '@/lib/sms-reconciliation'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  // Cookie-authenticated browser requests must originate from this app.
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsRead })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  try {
    const result = await reconcileInboundSms(access.tenantId, true)
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    console.error('[sms-reconciliation] session check failed; operator review required')
    return NextResponse.json({ error: 'Message recovery check unavailable.' }, { status: 503 })
  }
}