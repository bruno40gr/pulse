import { NextResponse } from 'next/server'
import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { headlinerEmailTemplates, HEADLINER_TEMPLATE_TENANT } from '@/lib/headliner-email-templates'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { parseSharedEmailTemplate } from '@/lib/shared-email-template'

const headers = { 'Cache-Control': 'private, no-store' }
const table = 'shared_email_templates'
const seeds = (tenantId: string) => tenantId === HEADLINER_TEMPLATE_TENANT ? headlinerEmailTemplates : []
const missingStorage = (error: { code?: string } | null) => error?.code === '42P01' || error?.code === 'PGRST205'
function canManage(context: { roleKey: string; permissions: ReadonlySet<string> } | null) {
  return Boolean(context && (context.roleKey === 'owner' || context.permissions.has(PERMISSIONS.communicationsSend)))
}

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsRead })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  try {
    const rows = []
    for (let offset = 0; ; offset += 1000) {
      const result = await supabaseAdmin.from(table).select('id,name,subject,body,version,archived_at').eq('tenant_id', access.tenantId).order('id').range(offset, offset + 999)
      if (missingStorage(result.error)) return NextResponse.json({ templates: seeds(access.tenantId).map(row => ({ ...row, version: 0 })), can_manage: false, storage_available: false }, { headers })
      if (result.error || !Array.isArray(result.data)) throw new Error('Read failed')
      rows.push(...result.data)
      if (result.data.length < 1000) break
    }
    const overridden = new Set(rows.map(row => row.id))
    const templates = [...seeds(access.tenantId).filter(row => !overridden.has(row.id)).map(row => ({ ...row, version: 0 })),
      ...rows.filter(row => !row.archived_at).map(row => ({ id: row.id, name: row.name, subject: row.subject, body: row.body, version: row.version, channel: 'email' as const,
        category: seeds(access.tenantId).find(seed => seed.id === row.id)?.category,
        outreachStep: seeds(access.tenantId).find(seed => seed.id === row.id)?.outreachStep }))]
    return NextResponse.json({ templates, can_manage: canManage(access.context), storage_available: true }, { headers })
  } catch {
    return NextResponse.json({ error: 'Shared templates could not be loaded. Please retry.' }, { status: 503, headers })
  }
}

export async function POST(request: Request) { return mutate(request, 'create') }
export async function PUT(request: Request) { return mutate(request, 'edit') }
export async function DELETE(request: Request) { return mutate(request, 'remove') }

async function mutate(request: Request, action: 'create' | 'edit' | 'remove') {
  const body = await request.json().catch(() => null)
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsSend, body })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers })
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(body.id)) return NextResponse.json({ error: 'Invalid template.' }, { status: 400, headers })
  if (!Number.isSafeInteger(body.version) || body.version < 0) return NextResponse.json({ error: 'Reload the template before saving.' }, { status: 400, headers })
  const fields = action === 'remove' ? null : parseSharedEmailTemplate(body)
  if (action !== 'remove' && !fields) return NextResponse.json({ error: 'Provide a name, subject and message within the allowed lengths.' }, { status: 400, headers })
  const seed = seeds(access.tenantId).find(row => row.id === body.id)
  if (action === 'create' && (!body.id.startsWith('custom-') || body.version !== 0)) return NextResponse.json({ error: 'Invalid new template.' }, { status: 400, headers })
  if (action !== 'create' && body.version === 0 && !seed) return NextResponse.json({ error: 'Template not found.' }, { status: 404, headers })
  try {
    const values = { ...(fields || (seed && { name: seed.name, subject: seed.subject, body: seed.body })),
      archived_at: action === 'remove' ? new Date().toISOString() : null, version: body.version + 1, updated_at: new Date().toISOString() }
    const result = body.version === 0
      ? await supabaseAdmin.from(table).insert({ tenant_id: access.tenantId, id: body.id, ...values }).select('id').maybeSingle()
      : await supabaseAdmin.from(table).update(values).eq('tenant_id', access.tenantId).eq('id', body.id).eq('version', body.version).is('archived_at', null).select('id').maybeSingle()
    if (missingStorage(result.error)) return NextResponse.json({ error: 'Shared template storage is not installed yet. Your changes were not saved.' }, { status: 503, headers })
    if (result.error?.code === '23505') return NextResponse.json({ error: 'That name is already used, or this template changed. Reload the library before retrying.' }, { status: 409, headers })
    if (result.error) throw new Error('Write failed')
    if (!result.data) return NextResponse.json({ error: 'This template changed or was removed. Reload the library before retrying.' }, { status: 409, headers })
    return NextResponse.json({ saved: true }, { headers })
  } catch {
    return NextResponse.json({ error: 'Template could not be saved. Your draft is retained.' }, { status: 503, headers })
  }
}