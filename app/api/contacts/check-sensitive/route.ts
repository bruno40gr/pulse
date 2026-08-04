import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const SENSITIVE_KEYWORDS = [
  'dispute', 'complaint', 'angry', 'legal', 'refund', 'cancel',
  'upset', 'unhappy', 'threatening', 'no contact', 'no promotional',
  'requested no', 'do not contact', 'harassment'
]

export async function POST(request: Request) {
  try {
    const { contact_ids } = await request.json()
    if (!contact_ids?.length) return NextResponse.json({ flagged: [], opted_out: [] })

    const { data: contacts, error } = await supabaseAdmin
      .from('contacts')
      .select('id, first_name, last_name, opted_out, notes')
      .in('id', contact_ids)

    if (error) throw error

    const opted_out = contacts
      .filter(c => c.opted_out)
      .map(c => ({ id: c.id, name: `${c.first_name} ${c.last_name}` }))

    const flagged = contacts
      .filter(c => {
        if (!c.notes) return false
        const lower = c.notes.toLowerCase()
        return SENSITIVE_KEYWORDS.some(kw => lower.includes(kw))
      })
      .map(c => ({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`,
        note: c.notes
      }))

    return NextResponse.json({ flagged, opted_out })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}