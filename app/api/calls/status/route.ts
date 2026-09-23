import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

function formatCallStatus(status: string): string {
  switch (status) {
    case 'completed': return 'Call completed'
    case 'busy': return 'Call busy'
    case 'no-answer': return 'Call not answered'
    case 'failed': return 'Call failed'
    case 'canceled': return 'Call canceled'
    default: return `Call ${status}`
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const callSid = (formData.get('CallSid') as string) || ''
    const callStatus = (formData.get('CallStatus') as string) || ''
    const duration = (formData.get('CallDuration') as string) || ''

    if (!callSid || !callStatus) {
      return NextResponse.json({ success: false }, { status: 400 })
    }

    // Find the lead_event we logged when the call was placed, keyed by its call SID.
    const { data: events, error: findError } = await supabaseAdmin
      .from('lead_events')
      .select('id, payload')
      .eq('payload->>call_sid', callSid)
      .limit(1)

    if (findError || !events || events.length === 0) {
      // No matching lead event (e.g., a job-application call) — nothing to update.
      return NextResponse.json({ success: true, skipped: true })
    }

    const event = events[0]
    const existingPayload = (event.payload && typeof event.payload === 'object') ? event.payload : {}

    const { error: updateError } = await supabaseAdmin
      .from('lead_events')
      .update({
        event_label: formatCallStatus(callStatus),
        payload: { ...existingPayload, status: callStatus, duration: duration ? Number(duration) : null },
      })
      .eq('id', event.id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
