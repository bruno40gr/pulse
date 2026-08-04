import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const { description, recipient_context, brand_voice } = await request.json()

    if (!description?.trim()) {
      return NextResponse.json({ error: 'Description required' }, { status: 400 })
    }

    const systemPrompt = `You are helping a small service business write an SMS message.
Write clearly, warmly, and directly. Keep it under 160 characters if possible.
Use {first_name} for personalization when it fits naturally.
${brand_voice ? `Brand voice guidance: ${brand_voice}` : ''}
Return ONLY the message text, nothing else.`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Write an SMS message about: ${description}
Recipients: ${recipient_context || 'general contacts'}`
      }]
    })

    const draft = (response.content[0] as any).text.trim()
    return NextResponse.json({ draft })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}