import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const { contact, notes } = await request.json()

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `You are a relationship assistant for a small service business.

Analyze this contact and generate 3-5 short, specific, scannable insight chips. Each insight should be a concrete fact — not advice, not a paragraph.

Contact data: ${JSON.stringify(contact)}
Internal notes: ${notes || 'None'}
Today: ${new Date().toLocaleDateString()}

Important: If the contact is marked as 'active' but has not attended in more than 30 days, flag this contradiction explicitly. Example: "Marked active, but last attended 89 days ago."

If last_attended is null or very old and status is active, that is worth flagging.
If days_since_attended is over 21, treat as at-risk regardless of status.
If days_since_attended is over 60, treat as high risk.

Return ONLY valid JSON, no markdown:
{
  "insights": [
    {
      "icon": "⚠",
      "text": "Marked active, but last attended 89 days ago",
      "type": "risk"
    }
  ]
}

Types: risk (churn/absence/contradiction), milestone (achievement/progress), opportunity (open spot/advancement), nudge (follow-up/renewal)

Choose icons from this set only — no emojis, use these exact strings:
risk → ⚠
milestone → ★
opportunity → ◎
nudge → ↻

Keep each insight under 12 words. Be specific — use real numbers and dates from the data. Never invent facts.`
      }]
    })

    const raw = (response.content[0] as any).text
    const match = raw.match(/\{[\s\S]*\}/)
    const result = JSON.parse(match ? match[0] : raw)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ insights: [] }, { status: 200 })
  }
}