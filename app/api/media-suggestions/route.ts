import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'
import { NextResponse } from 'next/server'
import { getMediaSuggestions, type MessageIntent } from '@/lib/media-catalog'

export async function GET(request: Request) {
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsRead, allowDemo: true })
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const tenantId = access.tenantId
  const url = new URL(request.url)
  const message = url.searchParams.get('message') || ''
  const context = url.searchParams.get('context') || ''
  const source = (url.searchParams.get('source') || 'manual') as 'insight' | 'scratch' | 'manual'
  const intent = (url.searchParams.get('intent') || 'neutral') as MessageIntent

  return NextResponse.json(getMediaSuggestions({ tenantId, message, context, source, intent }))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.communicationsRead, allowDemo: true, body })
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
    return NextResponse.json(getMediaSuggestions({
      tenantId: access.tenantId,
      message: body.message || '',
      context: body.context || '',
      source: body.source || 'manual',
      intent: body.intent || 'neutral',
    }))
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
