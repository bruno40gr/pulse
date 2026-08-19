import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ensureTenantSettingsTable } from '@/lib/ensure-tenant-settings'
import Anthropic from '@anthropic-ai/sdk'

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function getTenantId(request: Request): string {
  const url = new URL(request.url)
  const tenant = url.searchParams.get('tenant')
  // Return the default UUID if tenant is 'demo' or invalid uuid length
  if (!tenant || tenant === 'demo' || tenant.length !== 36) {
    return DEFAULT_TENANT_ID
  }
  return tenant
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function sanitizeInsightText(text: string | null | undefined) {
  return (text || '').replace(/—/g, ', ').replace(/\s+/g, ' ').trim()
}

function shortenActionLabel(label: string | null | undefined) {
  const cleaned = sanitizeInsightText(label)
  if (!cleaned) return 'Reach out'

  const cannedRewrites: Array<[RegExp, string]> = [
    [/send progress update or feedback request/i, 'Send update'],
    [/send progress update/i, 'Send update'],
    [/send a progress update/i, 'Send update'],
    [/feedback request/i, 'Request feedback'],
    [/check in with student or family/i, 'Check in'],
    [/reach out to (the )?family/i, 'Reach out'],
  ]

  for (const [pattern, replacement] of cannedRewrites) {
    if (pattern.test(cleaned)) return replacement
  }

  if (cleaned.length <= 22) return cleaned

  const compact = cleaned
    .replace(/^send\s+/i, '')
    .replace(/^reach out\s+/i, '')
    .replace(/^check in\s+/i, '')
    .replace(/^follow up\s+/i, '')
    .trim()

  if (compact.length > 0 && compact.length <= 18) {
    return compact.charAt(0).toUpperCase() + compact.slice(1)
  }

  return 'Reach out'
}

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

    // Load tenant pulse settings (threshold + focus areas) to influence generation
    await ensureTenantSettingsTable()
    const { data: tenantSettings } = await supabaseAdmin
      .from('tenant_settings')
      .select('highlight_threshold, focus_areas, brand_voice, brand_markdown')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const highlightThreshold = tenantSettings?.highlight_threshold ?? 3
    const focusAreas: string[] = tenantSettings?.focus_areas?.length
      ? tenantSettings.focus_areas
      : ['retention', 'billing', 'growth']
    const brandVoice = tenantSettings?.brand_voice || tenantSettings?.brand_markdown || ''

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

${brandVoice ? `Brand voice to match in tone and style:\n${brandVoice}\n` : ''}Focus areas to prioritize (only surface moments that directly serve these): ${focusAreas.join(', ')}.

Quality threshold: ${highlightThreshold} on a 1-5 scale (1 = include weak/minor signals, 5 = only surface strong, clear, high-value moments). If a moment's importance is below this threshold, skip it.

Here is a summary of their contacts: ${JSON.stringify(summary)}

Generate up to 4 insight cards for their dashboard. Each card should represent a meaningful moment that matches the focus areas and clears the quality threshold. Think about:
- Retention (missed sessions, long absence, inactive status, milestones, onboarding)
- Billing (overdue follow-ups, upcoming renewals)
- Growth (ready to advance, open spots, promotions, seasonal moments)

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

    const normalizedInsights = Array.isArray(result.insights)
      ? result.insights.map((insight: Record<string, unknown>) => ({
          ...insight,
          description: sanitizeInsightText(typeof insight.description === 'string' ? insight.description : ''),
          action_label: shortenActionLabel(typeof insight.action_label === 'string' ? insight.action_label : ''),
        }))
      : []

    // Save to cache
    await supabaseAdmin
      .from('insights_cache')
      .upsert({ tenant_id: tenantId, insights: normalizedInsights, generated_at: new Date().toISOString() },
        { onConflict: 'tenant_id' })

    return NextResponse.json({ ...result, insights: normalizedInsights, cached: false })
  } catch (error) {
    console.error('Insights error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}