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

Use these canonical field_key values (snake_case only):
Core (is_core true): first_name, last_name, full_name, email, phone, client_status, opted_out, external_id, date_of_birth.
Attendance (is_core false): session_date, attendance_status.
Business (is_core false): instructor, instrument, program, service_type, plan_name, session_name, band_name, lesson_day, lesson_time, tag.

Mapping rules:
- A single name column (e.g. "Client Name", "Student Name", "Member Name") -> full_name. If the sheet has separate first/last columns, use first_name and last_name.
- A stable client/customer/member id -> external_id.
- A column holding the class/session date -> session_date (field_type date).
- A column holding an attendance mark (values like Attended, Absent, Late, No Show) -> attendance_status (field_type dropdown).
- The teacher/staff/coach column -> instructor. The account-manager, parent, primary-contact, or payer name columns are the ACCOUNT HOLDER, not staff — never map those to instructor.
- The service/class/program name column -> program.
- Day-of-week columns -> lesson_day (field_type day). Time columns -> lesson_time.
- Tag columns (e.g. "Client Tags 1", "Instrument", "Genre") -> tag.
Skip columns with no clear contact meaning like invoice numbers or payment amounts (but a client id column IS meaningful -> external_id).`
      }]
    })

    const raw = (response.content[0] as any).text
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    try {
      const result = JSON.parse(jsonMatch ? jsonMatch[0] : raw)

      // Ensure unique field_keys — multiple columns can map to the same field
      // (e.g. several "Client Tags" columns → "tag"), which would otherwise break
      // React keys and collapse in the importer.
      if (Array.isArray(result.mappings)) {
        const seen = new Set<string>()
        for (const m of result.mappings) {
          if (!m || typeof m.field_key !== 'string' || !m.field_key) continue
          let key = m.field_key
          let n = 2
          while (seen.has(key)) {
            key = `${m.field_key}_${n++}`
          }
          m.field_key = key
          seen.add(key)
        }
      }

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
