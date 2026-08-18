import { NextResponse } from 'next/server'
import { getMediaSuggestions, type MessageIntent } from '@/lib/media-catalog'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function getTenantIdFromRequest(request: Request) {
  const url = new URL(request.url)
  return url.searchParams.get('tenant') || DEFAULT_TENANT_ID
}

export async function GET(request: Request) {
  const tenantId = getTenantIdFromRequest(request)
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
    return NextResponse.json(getMediaSuggestions({
      tenantId: body.tenantId || DEFAULT_TENANT_ID,
      message: body.message || '',
      context: body.context || '',
      source: body.source || 'manual',
      intent: body.intent || 'neutral',
    }))
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}