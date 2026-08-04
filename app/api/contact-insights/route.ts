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

Analyze this contact and generate 3-5 short, factual insight chips. Each insight should be a specific, scannable fact — not a paragraph.

Contact data: ${JSON.stringify(contact)}
Internal notes: ${notes || 'None'}
Today: ${new Date().toLocaleDateString()}

Return ONLY valid JSON, no markdown:
{
  "insights": [
    { "icon": "📅", "text": "Missed last 3 sessions" },
    { "icon": "📝", "text": "Parent requested no promotional messages" }
  ]
}

Choose icons that match the insight type:
📅 attendance/schedule
📝 communication preference or note
⭐ achievement or milestone
💳 billing or membership
🎂 personal milestone
⚠️ needs attention
💬 recent communication
📈 progress

Be specific. Use real data from the contact. Keep each insight under 10 words. Never invent facts not present in the data.`
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