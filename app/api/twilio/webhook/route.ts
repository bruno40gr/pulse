import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { twiml } from 'twilio';

// This is the webhook that Twilio will call when a message is received.
// After deploying, you will need to configure this URL in your Twilio console:
// https://your-vercel-domain.vercel.app/api/twilio/webhook
export async function POST(request: Request) {
    const formData = await request.formData();
    const body = Object.fromEntries(formData.entries());

    const from = body.From as string;
    const messageBody = body.Body as string;
    const twilioSid = body.MessageSid as string;

    try {
        const { data: contact, error } = await supabaseAdmin
            .from('contacts')
            .select('id, opted_out')
            .eq('phone', from)
            .single();

        if (error || !contact) {
            throw new Error(`Contact not found for phone number: ${from}`);
        }

        const message = {
            contact_id: contact.id,
            channel: 'sms',
            direction: 'inbound',
            body: messageBody,
            twilio_sid: twilioSid,
            status: 'received',
        };
        
        await supabaseAdmin.from('messages').insert(message);

        // Handle opt-out/opt-in
        const lowerBody = messageBody.trim().toLowerCase();
        if (lowerBody === 'stop' && !contact.opted_out) {
            await supabaseAdmin.from('contacts').update({ opted_out: true }).eq('id', contact.id);
        } else if (lowerBody === 'start' && contact.opted_out) {
            await supabaseAdmin.from('contacts').update({ opted_out: false }).eq('id', contact.id);
        }

        const response = new twiml.MessagingResponse();
        return new NextResponse(response.toString(), {
            headers: { 'Content-Type': 'text/xml' },
        });

    } catch (error) {
        console.error('Twilio webhook error:', error);
        // Still return a 200 to Twilio to avoid retry loops, but log the error.
        return new NextResponse(null, { status: 200 });
    }
}