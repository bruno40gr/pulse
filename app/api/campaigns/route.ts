import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { name, channel, message, media_url, filter_query, recipient_count } = await request.json();

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .insert({
        name,
        channel,
        message,
        media_url,
        filter_query,
        recipient_count,
        status: 'draft',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}