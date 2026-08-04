import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function getTenantId(request: Request): string {
  const url = new URL(request.url)
  return url.searchParams.get('tenant') || DEFAULT_TENANT_ID
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a contact filter assistant for a small business messaging tool called Pulse.
You will receive a natural language query and a list of contacts in JSON format.
Return ONLY a valid JSON object with this exact structure, no markdown, no backticks:
{"contact_ids": ["uuid1", "uuid2"], "explanation": "Brief explanation of filter applied"}

Each contact has a custom_fields object containing: instrument, service_type, lesson_day, lesson_time, instructor, plan_name, session_name, last_attended.

Filter contacts based on the query. Consider:
- instrument (guitar, piano, drums, voice, bass, violin, etc.)
- service_type: "private", "group", "semi-private", "band" (band = 101 classes like Bass 101, Guitar 101)
- lesson_day (monday, tuesday, wednesday, etc.)
- instructor name
- client_status (active, inactive, member)
- last_attended date for churn queries
- tags array

Synonyms: "band students" = service_type "band", "Tuesday students" = lesson_day "tuesday", "bass players" = instrument "Bass", "Josh students" = instructor contains "Josh".
"Haven't attended in X weeks/days" = last_attended older than X days ago. Today is ${new Date().toLocaleDateString()}.

Never return contacts with opted_out = true. Return empty contact_ids if nothing matches.`

export async function POST(request: Request) {
  try {
    const { query, tenant } = await request.json()
    const tenantId = tenant || getTenantId(request)
    if (!query?.trim()) return NextResponse.json({ error: 'No query provided' }, { status: 400 })

    const { data: contacts, error } = await supabaseAdmin
      .from('contacts')
      .select('id, first_name, last_name, client_status, last_attended, tags, opted_out, custom_fields')
      .eq('tenant_id', tenantId)
      .eq('opted_out', false)

    if (error) throw error

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Query: "${query}"\n\nContacts: ${JSON.stringify(contacts)}` }]
    })

    const rawText = (response.content[0] as any).text
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(cleaned)

    return NextResponse.json(result)
  } catch (error) {
    console.error('AI filter error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}