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

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single()

    const { data: contacts } = await supabaseAdmin
      .from('contacts')
      .select('id, first_name, last_name, client_status, last_attended, custom_fields')
      .eq('tenant_id', tenantId)
      .limit(50)

    const { data: fields } = await supabaseAdmin
      .from('tenant_fields')
      .select('field_key, field_label')
      .eq('tenant_id', tenantId)

    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('body, direction')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20)

    const { data: twilioConfig } = await supabaseAdmin
      .from('twilio_config')
      .select('phone_number')
      .eq('tenant_id', tenantId)
      .single()

    const businessName = tenant?.name || 'a small business'
    const phoneNumber = twilioConfig?.phone_number || '(555) 555-5555'

    // Build a summary of the business for Claude
    const contactSample = (contacts || []).slice(0, 10).map(c => ({
      name: `${c.first_name} ${c.last_name}`,
      status: c.client_status,
      last_attended: c.last_attended,
      ...c.custom_fields,
    }))

    const customFieldLabels = (fields || []).map(f => f.field_label)
    const recentMessages = (messages || []).map(m => m.body).filter(Boolean).slice(0, 5)

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are helping ${businessName} register for A2P 10DLC SMS messaging with Twilio. This is a real regulatory filing that carriers will review. Generate the exact copy they need for each field.

Business context:
- Business name: ${businessName}
- Business type: ${customFieldLabels.includes('instrument') ? 'Music school / academy' : customFieldLabels.includes('service_type') ? 'Service business' : 'Small business'}
- Custom fields they track: ${JSON.stringify(customFieldLabels)}
- Sample contacts: ${JSON.stringify(contactSample)}
- Phone number: ${phoneNumber}
- Recent message drafts: ${JSON.stringify(recentMessages)}

Generate a complete A2P 10DLC campaign registration. Return ONLY valid JSON, no markdown, no backticks:

{
  "useCase": "low-volume-mixed",
  "campaignDescription": "A clear, specific description (100-400 chars). Must state: who sends (${businessName}), who receives (students/customers and their families), why messages are sent (list 2-3 specific purposes matching the business type), and how consent works (opt-in checkbox on signup form). No em dashes. No marketing jargon.",
  "sampleMessages": [
    "Sample message 1 - a class reminder or appointment reminder specific to this business",
    "Sample message 2 - a schedule change or rescheduling notification",
    "Sample message 3 - a billing or account update",
    "Sample message 4 - a promotional or program announcement",
    "Sample message 5 - an event or general announcement"
  ],
  "consentLanguage": "How end users opt in (40-500 chars). Describe the signup form, the unchecked checkbox, the exact checkbox label text, that opt-in is optional, and links to ToS and Privacy Policy. No em dashes.",
  "messageAttributes": {
    "hasLinks": true,
    "hasPhoneNumbers": true,
    "hasLending": false,
    "hasAgeGated": false
  }
}

Rules:
- Every sample message MUST end with "Reply STOP to opt out."
- Use [First Name] as the placeholder, not actual names
- Make sample messages specific to this business type (${customFieldLabels.includes('instrument') ? 'music lessons, instruments, classes' : 'their services'})
- Campaign description must be specific enough that a carrier reviewer can understand exactly what this business does and why they send messages
- No em dashes anywhere. Use commas, periods, or colons instead.
- Consent language must include the exact checkbox label text in quotes
- All sample messages must be realistic and match the stated purposes in the campaign description`
      }]
    })

    const raw = (response.content[0] as any).text
    const match = raw.match(/\{[\s\S]*\}/)
    const result = JSON.parse(match ? match[0] : raw)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Campaign copy error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}