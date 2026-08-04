import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function getTenantId(request: Request): string {
  const url = new URL(request.url)
  return url.searchParams.get('tenant') || DEFAULT_TENANT_ID
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(request: Request) {
  try {
    const tenantId = getTenantId(request)
    const forceRefresh = new URL(request.url).searchParams.get('refresh') === 'true'

    // Check cache first
    if (!forceRefresh) {
      const { data: cached } = await supabaseAdmin
        .from('insights_cache')
        .select('insights, generated_at')
        .eq('tenant_id', tenantId)
        .single()

      if (cached) {
        const ageHours = (Date.now() - new Date(cached.generated_at).getTime()) / (1000 * 60 * 60)
        if (ageHours < 4) {
          return NextResponse.json({ insights: cached.insights, cached: true, generated_at: cached.generated_at })
        }
      }
    }

    const today = new Date()

    const { data: contacts, error } = await supabaseAdmin
      .from('contacts')
      .select('id, first_name, last_name, client_status, last_attended, custom_fields, opted_out')
      .eq('tenant_id', tenantId)

    if (error) throw error

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single()

    const { data: fields } = await supabaseAdmin
      .from('tenant_fields')
      .select('field_key, field_label')
      .eq('tenant_id', tenantId)

    const summary = contacts.map(c => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`,
      status: c.client_status,
      last_attended: c.last_attended,
      days_since_attended: c.last_attended
        ? Math.floor((today.getTime() - new Date(c.last_attended).getTime()) / (1000 * 60 * 60 * 24))
        : null,
      ...c.custom_fields
    }))

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are a relationship assistant for ${tenant?.name}, a small service business using Pulse to stay connected with their customers.

Today is ${today.toLocaleDateString()}.

The business has these custom fields: ${JSON.stringify(fields?.map(f => f.field_label))}.

Here is a summary of their contacts: ${JSON.stringify(summary)}

Generate 4 insight cards for their dashboard. Each card should represent a meaningful moment or opportunity — not just problems. Think about:
- Relationships at risk (missed sessions, long absence, inactive status)
- Milestones worth celebrating (belt level achievements, subject level completions, anniversaries)
- Opportunities to delight (students ready to advance, classes with open spots, seasonal moments)
- Operational nudges (overdue follow-ups, upcoming renewals)

Return ONLY valid JSON, no markdown, no backticks:
{
  "insights": [
    {
      "type": "risk|milestone|opportunity|nudge",
      "title": "Short plain English title",
      "description": "One or two sentences. Specific names and numbers. No jargon. No em dashes. Written like a trusted colleague flagging something.",
      "contact_ids": ["uuid1", "uuid2"],
      "action_label": "Short CTA label e.g. Send a message or Reach out",
      "urgency": "high|medium|low"
    }
  ]
}`
      }]
    })

    const raw = (response.content[0] as any).text
    const match = raw.match(/\{[\s\S]*\}/)
    const result = JSON.parse(match ? match[0] : raw)

    // Save to cache
    await supabaseAdmin
      .from('insights_cache')
      .upsert({ tenant_id: tenantId, insights: result.insights, generated_at: new Date().toISOString() },
        { onConflict: 'tenant_id' })

    return NextResponse.json({ ...result, cached: false })
  } catch (error) {
    console.error('Insights error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}