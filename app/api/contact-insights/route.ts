import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Valence = 'attention' | 'celebrate' | 'opportunity' | 'passive'
type Source = 'profile' | 'student_note' | 'internal_note'

interface Insight {
  headline: string
  detail: string | null
  action: string | null
  valence: Valence
  source: Source
}

export async function POST(request: Request) {
  try {
    const { contact, student_notes, internal_notes } = await request.json()

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{
        role: 'user',
        content: `You are a relationship assistant for a small service business. Produce relationship intelligence for a contact.

## Input
Contact data: ${JSON.stringify(contact)}
Student-facing notes: ${student_notes || 'None'}
Internal notes (team-only): ${internal_notes || 'None'}
Today: ${new Date().toLocaleDateString()}

## What to produce
Generate 0-5 insights. Each insight must be grounded in actual data or note content — never fabricate.

There are four valences:
- "attention": something needs a warm, gentle nudge. Examples: attendance gap > 21 days, renewal approaching, follow-up owed, schedule change requested.
- "celebrate": something genuinely positive worth acknowledging. Examples: recital/performance nailed, streak milestone, level advancement.
- "opportunity": a door is open. Examples: new program that fits their instrument/level, hasn't tried group classes, cross-sell that matches their history.
- "passive": a quiet fact worth remembering but requiring no action. Examples: "renewal date approaching", "14-week streak before the gap".

Rules:
1. Only emit an insight when there is a clear signal. 1 insight is valid. 0 insights is valid (empty array).
2. "attention" is the strongest it should ever feel — no alarmist language.
3. For note-derived insights, only elevate DURABLE, actionable signals. Skip transient logistics like "paused reminders this week" or "traveling until Monday".
4. internal_notes are team-only. If an insight is derived from an internal note, set source="internal_note" so the UI can mark it and exclude it from customer-facing surfaces.
5. Keep headline under 6 words. detail is optional supporting context (1 sentence, use real numbers/dates). action is optional and only for attention/celebrate/opportunity — use a short verb phrase ("Check in", "Send congratulations", "Recommend program", "Send billing reminder").

Return ONLY valid JSON, no markdown:
{
  "insights": [
    {
      "headline": "Attendance gap",
      "detail": "11 days since last lesson. Tyler usually attends Saturdays.",
      "action": "Check in",
      "valence": "attention",
      "source": "profile"
    }
  ]
}`
      }]
    })

    const raw = (response.content[0] as any).text
    const match = raw.match(/\{[\s\S]*\}/)
    const result = JSON.parse(match ? match[0] : raw)

    // Normalize: ensure insights is an array of valid shapes
    const insights: Insight[] = (result.insights || [])
      .filter((i: any) => i && typeof i.headline === 'string' && i.headline.trim())
      .map((i: any) => ({
        headline: i.headline.trim(),
        detail: typeof i.detail === 'string' ? i.detail.trim() : null,
        action: typeof i.action === 'string' ? i.action.trim() : null,
        valence: ['attention', 'celebrate', 'opportunity', 'passive'].includes(i.valence) ? i.valence : 'passive',
        source: ['profile', 'student_note', 'internal_note'].includes(i.source) ? i.source : 'profile',
      }))

    return NextResponse.json({ insights })
  } catch (error) {
    return NextResponse.json({ insights: [] }, { status: 200 })
  }
}