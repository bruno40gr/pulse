import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { RSVP_EVENT_ID, RSVP_TENANT_ID, validateEventRsvp } from '@/lib/event-rsvps'

export async function POST(request: Request) {
  const key = request.headers.get('idempotency-key')
  if (!key || !/^[A-Za-z0-9_-]{1,160}$/.test(key)) {
    return NextResponse.json({ error: 'A valid submission key is required.' }, { status: 400 })
  }
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid RSVP details.' }, { status: 400 }) }
  const details = validateEventRsvp(body)
  if (!details) return NextResponse.json({ error: 'Enter a name, valid email, and party size from 1 to 99.' }, { status: 400 })
  try {
    // Dedicated storage only: no intake transport, contacts, leads, or marketing.
    const { data, error } = await supabaseAdmin.rpc('capture_event_rsvp', {
      p_tenant: RSVP_TENANT_ID, p_event: RSVP_EVENT_ID, p_key: key,
      p_name: details.name, p_email: details.email, p_party_size: details.partySize,
    })
    if (error?.code === '22023') return NextResponse.json({ error: 'This submission key was already used. Reopen the form and try again.' }, { status: 409 })
    if (error || typeof data !== 'string') throw new Error('RSVP storage unavailable')
    return NextResponse.json({ ok: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'We couldn’t save your RSVP. Please try again.' }, { status: 503 })
  }
}