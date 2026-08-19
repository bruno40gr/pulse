import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const eventType = typeof body.eventType === 'string' ? body.eventType : null
    const visitorId = typeof body.visitorId === 'string' ? body.visitorId : null
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId : null
    const path = typeof body.path === 'string' ? body.path : null
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {}

    if (!eventType || !visitorId || !sessionId) {
      return NextResponse.json({ error: 'Missing required analytics fields.' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('demo_events')
      .insert({
        event_type: eventType,
        visitor_id: visitorId,
        session_id: sessionId,
        tenant_id: tenantId,
        path,
        metadata,
        user_agent: request.headers.get('user-agent'),
      })

    if (error) {
      const relationMissing = /demo_events|relation .* does not exist/i.test(error.message)
      if (relationMissing) {
        return NextResponse.json({ ok: false, skipped: true, reason: 'demo_events table missing' }, { status: 202 })
      }

      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
