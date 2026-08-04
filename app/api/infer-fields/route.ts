import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const { headers, sample_rows } = await request.json()
    if (!headers?.length) return NextResponse.json({ error: 'No headers provided' }, { status: 400 })

    // Guard against oversized payloads: if the payload exceeds 4000 chars,
    // drop sample rows entirely and rely on headers alone for inference.
    let rows = sample_rows
    if (JSON.stringify({ headers, sample_rows: rows }).length > 4000) {
      rows = []
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `You are helping a small business import their contact spreadsheet into a messaging tool called Pulse.

Analyze these CSV headers and sample data, then suggest field mappings.

CSV Headers: ${JSON.stringify(headers)}
Sample rows (first 3): ${JSON.stringify(rows)}

Return ONLY valid JSON, no markdown, no backticks:
{
  "mappings": [
    {
      "csv_column": "exact column name from CSV",
      "field_key": "snake_case key",
      "field_label": "Human readable label",
      "field_type": "text|dropdown|day|date|number",
      "is_core": true or false,
      "confidence": "high|medium|low"
    }
  ]
}

Core fields (is_core true): first_name, last_name, phone, email, client_status, opted_out.
Custom fields (is_core false): anything business-specific like instrument, instructor, class type, belt level, membership tier, lesson day, schedule, program etc.
For day fields: if sample values are day names use field_type day.
For date fields: if sample values look like dates use field_type date.
Skip columns with no clear contact meaning like IDs, invoice numbers, payment amounts.`
      }]
    })

    const raw = (response.content[0] as any).text
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    try {
      const result = JSON.parse(jsonMatch ? jsonMatch[0] : raw)
      return NextResponse.json(result)
    } catch {
      // Fallback: map core fields from headers so the import can still proceed.
      const fallbackMappings = headers
        .filter((h: string) => {
          const lower = h.toLowerCase()
          return !(lower.endsWith(' id') || lower === 'id' || lower === 'client id' || lower.includes('uuid'))
        })
        .map((h: string) => {
          const key = h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
          const core = ['first_name', 'last_name', 'phone', 'email', 'client_status', 'opted_out'].includes(key)
          return {
            csv_column: h,
            field_key: key || 'field_' + Math.random().toString(36).slice(2, 8),
            field_label: h.trim(),
            field_type: 'text',
            is_core: core,
            confidence: 'low',
          }
        })
      return NextResponse.json({ mappings: fallbackMappings })
    }
  } catch (error) {
    console.error('Field inference error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
