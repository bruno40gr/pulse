import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { resolveRequestTenant } from '@/lib/tenant-access'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function normalizeTitle(value: string) {
  return value
    .replace(/^['"`\s]+|['"`\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .trim()
}

export async function POST(request: Request) {
  try {
    const tenantAccess = await resolveRequestTenant(request, DEFAULT_TENANT_ID)
    if (!tenantAccess.ok) return NextResponse.json({ error: tenantAccess.error }, { status: tenantAccess.status })

    const { body } = await request.json()
    const noteBody = typeof body === 'string' ? body.trim() : ''
    if (!noteBody) return NextResponse.json({ error: 'Note body is required.' }, { status: 400 })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 40,
      system: 'Create a concise, descriptive title for an internal sticky note. Return only the title, with no quotation marks, punctuation decoration, or explanation. Use 2 to 8 words and never invent details.',
      messages: [{ role: 'user', content: noteBody.slice(0, 6000) }],
    })
    const content = response.content[0]
    const title = content.type === 'text' ? normalizeTitle(content.text) : ''

    if (!title) return NextResponse.json({ error: 'Could not generate a title.' }, { status: 502 })
    return NextResponse.json({ title })
  } catch (error) {
    console.error('[notes][title] Error', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Could not generate a title.' }, { status: 500 })
  }
}