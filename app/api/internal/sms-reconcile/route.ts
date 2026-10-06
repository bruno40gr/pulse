import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { reconcileInboundSms } from '@/lib/sms-reconciliation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const secret = process.env.SMS_RECONCILIATION_SECRET
  const authorization = request.headers.get('authorization') || ''
  const expected = `Bearer ${secret}`
  if (!secret || secret.length < 32 || Buffer.byteLength(authorization) !== Buffer.byteLength(expected)
    || !timingSafeEqual(Buffer.from(authorization), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await reconcileInboundSms()
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    console.error('[sms-reconciliation] failed; operator review required')
    return NextResponse.json({ error: 'SMS reconciliation failed' }, { status: 503 })
  }
}