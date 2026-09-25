import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRequestActor } from '@/lib/access'
import { resolveRequestTenant } from '@/lib/tenant-access'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function isDateValue(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

export async function GET(request: Request) {
  try {
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status })
    const tenantId = tenantAccess.tenantId
    const url = new URL(request.url)
    const noteDate = url.searchParams.get('date')
    if (noteDate && !isDateValue(noteDate)) return NextResponse.json({ error: 'A valid note date is required.' }, { status: 400 })
    const showDone = url.searchParams.get('show_done') === 'true'

    let query = supabaseAdmin
      .from('notes')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })

    if (noteDate) query = query.eq('note_date', noteDate)
    if (!showDone) query = query.is('completed_at', null)
    const { data, error } = await query

    if (error) throw error
    const notes = data || []
    if (notes.length === 0) return NextResponse.json(notes)

    const { data: replyRows, error: replyError } = await supabaseAdmin
      .from('note_replies')
      .select('note_id')
      .eq('tenant_id', tenantId)
      .in('note_id', notes.map((note) => note.id))
    if (replyError) throw replyError

    const replyCounts = new Map<string, number>()
    for (const reply of replyRows || []) {
      replyCounts.set(reply.note_id, (replyCounts.get(reply.note_id) || 0) + 1)
    }
    return NextResponse.json(notes.map((note) => ({ ...note, reply_count: replyCounts.get(note.id) || 0 })))
  } catch (error) {
    console.error('[notes][list] Error', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status })
    const tenantId = tenantAccess.tenantId
    const actor = await getRequestActor(request)
    const body = await request.json()

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const noteBody = typeof body.body === 'string' ? body.body.trim() : ''
    if (!title && !noteBody) {
      return NextResponse.json({ error: 'Note is empty.' }, { status: 400 })
    }

    const color = typeof body.color === 'string' && body.color ? body.color : 'yellow'
    const pinned = body.pinned === true
    const noteDate = typeof body.note_date === 'string' ? body.note_date : new Date().toISOString().slice(0, 10)
    if (!isDateValue(noteDate)) return NextResponse.json({ error: 'A valid note date is required.' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('notes')
      .insert({
        tenant_id: tenantId,
        title: title || null,
        body: noteBody,
        color,
        pinned,
        note_date: noteDate,
        created_by: actor?.displayName || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('[notes][create] Error', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
