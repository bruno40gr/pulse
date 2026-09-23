import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function getTenantId(request: Request): string {
  const url = new URL(request.url)
  return url.searchParams.get('tenant') || DEFAULT_TENANT_ID
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const tenantId = getTenantId(request)
    const body = await request.json()

    const updates: Record<string, unknown> = {}
    if ('title' in body) {
      updates.title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null
    }
    if ('body' in body) {
      updates.body = typeof body.body === 'string' ? body.body : ''
    }
    if ('color' in body) {
      updates.color = typeof body.color === 'string' && body.color ? body.color : 'yellow'
    }
    if ('pinned' in body) {
      updates.pinned = body.pinned === true
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('notes')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error('[notes][update] Error', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const tenantId = getTenantId(request)

    const { error } = await supabaseAdmin
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[notes][delete] Error', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
