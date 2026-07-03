import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { twilioClient } from '@/lib/twilio';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const { recipientIds } = await request.json();

  try {
    // 1. Fetch campaign and contacts
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();
    
    if (campaignError) throw campaignError;

    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .in('id', recipientIds);

    if (contactsError) throw contactsError;

    // 2. Send messages
    const messagePromises = contacts.map(contact => {
        const personalizedMessage = campaign.message.replace('{first_name}', contact.first_name);
        
        return twilioClient.messages.create({
            body: `${personalizedMessage}\n\nReply STOP to unsubscribe.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: contact.phone,
            mediaUrl: campaign.media_url ? [campaign.media_url] : undefined,
        }).then(message => ({
            contact_id: contact.id,
            status: 'queued' as const,
            twilio_sid: message.sid,
            error_message: undefined as string | undefined,
        })).catch(error => ({
            contact_id: contact.id,
            status: 'failed' as const,
            twilio_sid: undefined as string | undefined,
            error_message: error.message,
        }));
    });

    const results = await Promise.allSettled(messagePromises);

    // 3. Record message statuses
    const messageRecords = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => ({
            campaign_id: campaignId,
            contact_id: result.value.contact_id,
            channel: 'sms',
            direction: 'outbound',
            status: result.value.status,
            twilio_sid: result.value.twilio_sid,
            error_message: result.value.error_message
        }));

    await supabaseAdmin.from('messages').insert(messageRecords);

    // 4. Update campaign status
    await supabaseAdmin
      .from('campaigns')
      .update({ status: 'sent', sent_at: new Date() })
      .eq('id', campaignId);

    return NextResponse.json({ success: true, message: 'Campaign sent.' });

  } catch (error) {
    console.error('Failed to send campaign:', error);
    // Optionally update campaign to 'failed' status
    await supabaseAdmin.from('campaigns').update({ status: 'failed' }).eq('id', campaignId);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}