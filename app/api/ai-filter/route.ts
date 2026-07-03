import { NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic';
import { supabaseAdmin } from '@/lib/supabase';

const SYSTEM_PROMPT = `
You are a contact filter assistant for Headliner Music Academy. 
You will receive a natural language query and a list of contacts in JSON format.
Return ONLY a JSON object with this structure:
{
  "contact_ids": ["uuid1", "uuid2", ...],
  "explanation": "Brief human-readable explanation of the filter applied"
}

Filter the contacts based on the query. Consider:
- Instrument (guitar, piano, drums, voice, bass, violin, trumpet, etc.)
- Service type (private, group, semi-private, band) — band includes all 101 classes (Guitar 101, Bass 101, Drums 101, Voice 101), Rock City, and Band 101
- Lesson day (monday, tuesday, wednesday, thursday, friday, saturday, sunday)
- Instructor name
- Plan name
- Last attended date (for churn/no-show queries)
- Tags
- Client status (active/inactive)

Be intelligent about synonyms: "bass players" = contacts with instrument containing "bass", 
"Tuesday students" = contacts with lesson_day = "tuesday", etc.
"band students" or "band classes" = contacts with service_type = "band"
"group students" = contacts with service_type = "group"
"semi-private students" = contacts with service_type = "semi-private"
"Haven't shown up in a week" = last_attended older than 7 days ago.

Return empty contact_ids array if no contacts match. Never return contacts who are opted out.
The current date is ${new Date().toLocaleDateString()}.
`;

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    const { data: contacts, error } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('opted_out', false);

    if (error) throw error;

    const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001", // As specified, though exact model might change
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
            {
                role: 'user',
                content: `Query: "${query}"\n\nContacts: ${JSON.stringify(contacts, null, 2)}`
            }
        ]
    });

    const rawText = (response.content[0] as any).text;
const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
const result = JSON.parse(cleaned);

    return NextResponse.json(result);

  } catch (error) {
    console.error('AI filter error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}