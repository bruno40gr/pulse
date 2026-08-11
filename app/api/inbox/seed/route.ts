// TEMP: Seed endpoint to populate fake inbox conversations for UI review across all tenants.
// Visit /api/inbox/seed to generate demo data for all academies.

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const STUDIO_PHONE = '+19168911212'

const TENANTS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Headliner Music Academy',
    conversations: [
      {
        match: { first: 'Taylor', last: 'Tallman' },
        messages: [
          { dir: 'inbound', body: 'Is the recital still on for Saturday at 3pm? I missed last practice.', minsAgo: 45 },
          { dir: 'outbound', body: 'Yes! Still on. Come early at 2:30 for a quick run-through.', minsAgo: 35 },
          { dir: 'inbound', body: 'Great, thank you! See you then.', minsAgo: 30 },
        ],
      },
      {
        match: { first: 'Declan', last: 'Howell' },
        messages: [
          { dir: 'inbound', body: "Declan can't make Thursday — family thing. Can we reschedule?", minsAgo: 180 },
          { dir: 'outbound', body: 'How about Friday at 4pm?', minsAgo: 170 },
          { dir: 'inbound', body: 'Friday at 4 works. Thanks!', minsAgo: 160 },
          { dir: 'outbound', body: 'Confirmed. See Declan Friday at 4!', minsAgo: 150 },
        ],
      },
      {
        match: { first: 'Aiden', last: 'Cavanna' },
        messages: [
          { dir: 'inbound', body: 'Any summer programs for intermediate violin?', minsAgo: 120 },
          { dir: 'outbound', body: 'Yes — 6-week summer intensive starting July. Want the link?', minsAgo: 110 },
          { dir: 'inbound', body: 'Please send! Been practicing Vivaldi every day.', minsAgo: 100 },
        ],
      },
      {
        match: { first: 'Nick', last: 'Milano' },
        messages: [
          { dir: 'inbound', body: 'Nick left his music folder at the studio — has audition pieces. Can we pick it up tomorrow?', minsAgo: 300 },
          { dir: 'outbound', body: 'Yes, opens 9am. I\'ll leave it at the desk with his name.', minsAgo: 290 },
          { dir: 'inbound', body: 'Perfect, we\'ll be there at 9. Thanks!', minsAgo: 280 },
        ],
      },
      {
        match: { first: 'Evelyn', last: 'Wells' },
        messages: [
          { dir: 'outbound', body: 'Reminder: spring concert tickets on sale tomorrow. Evelyn\'s solo is in the second half.', minsAgo: 1440 },
          { dir: 'inbound', body: 'Already got our tickets! She\'s been practicing Chopin nonstop.', minsAgo: 1380 },
          { dir: 'inbound', body: 'What should she wear? Formal?', minsAgo: 1375 },
          { dir: 'outbound', body: 'Semi-formal. Dress or slacks and blouse — no jeans.', minsAgo: 1370 },
          { dir: 'inbound', body: 'Got it, thanks! 😊', minsAgo: 1360 },
        ],
      },
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Sacramento Martial Arts',
    conversations: [
      {
        match: { first: 'Rachel', last: 'Anderson' },
        messages: [
          { dir: 'inbound', body: 'Hi, is the belt test this Saturday still at 10am? My son\'s been practicing his form.', minsAgo: 60 },
          { dir: 'outbound', body: 'Yes, 10am sharp! Make sure he brings his sparring gear too.', minsAgo: 50 },
          { dir: 'inbound', body: 'Will do. Thanks for confirming!', minsAgo: 40 },
        ],
      },
      {
        match: { first: 'Ethan', last: 'Brown' },
        messages: [
          { dir: 'inbound', body: 'Ethan twisted his ankle at soccer practice. Can we pause his membership for 2 weeks?', minsAgo: 240 },
          { dir: 'outbound', body: 'Absolutely — I\'ll freeze his membership starting today. Hope he recovers quick!', minsAgo: 230 },
          { dir: 'inbound', body: 'Thank you so much. He\'s already asking when he can come back.', minsAgo: 220 },
        ],
      },
      {
        match: { first: 'Ryan', last: 'Clark' },
        messages: [
          { dir: 'outbound', body: 'Hi! We have a new advanced sparring class starting Thursdays at 7pm. Ryan\'s ready for it.', minsAgo: 360 },
          { dir: 'inbound', body: 'That sounds great! Sign him up. What does he need to bring?', minsAgo: 350 },
          { dir: 'outbound', body: 'Just his mouthguard and gloves. Everything else is provided.', minsAgo: 340 },
          { dir: 'inbound', body: 'Perfect, he\'ll be there Thursday. Thanks for thinking of him!', minsAgo: 330 },
        ],
      },
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Kumon Learning Center',
    conversations: [
      {
        match: { first: 'Tyler', last: 'Adams' },
        messages: [
          { dir: 'inbound', body: 'Hi, Tyler finished level D math faster than expected. Can he move up to level E next month?', minsAgo: 90 },
          { dir: 'outbound', body: 'Great progress! I\'ll do the assessment this week. If he passes, he can start E on the 1st.', minsAgo: 80 },
          { dir: 'inbound', body: 'Wonderful, thank you! He\'s been working really hard.', minsAgo: 70 },
        ],
      },
      {
        match: { first: 'Marcus', last: 'Adeyemi' },
        messages: [
          { dir: 'outbound', body: 'Hi — just checking in. Marcus has missed 3 sessions this month. Everything okay?', minsAgo: 200 },
          { dir: 'inbound', body: 'Sorry! We\'ve had some family stuff. He\'ll be back on track next week.', minsAgo: 190 },
          { dir: 'outbound', body: 'No worries at all. I\'ll send the missed worksheets home with him next session.', minsAgo: 180 },
          { dir: 'inbound', body: 'That would be great, thank you for understanding.', minsAgo: 170 },
        ],
      },
      {
        match: { first: 'Fatima', last: 'Bello' },
        messages: [
          { dir: 'inbound', body: 'Fatima is struggling with the reading comprehension section. Any tips for at-home practice?', minsAgo: 480 },
          { dir: 'outbound', body: 'Try 15 minutes of reading aloud together each night — it makes a big difference. I can also send extra practice sheets.', minsAgo: 470 },
          { dir: 'inbound', body: 'That\'s a great idea. Yes, please send the practice sheets too. Thank you!', minsAgo: 460 },
        ],
      },
    ],
  },
]

export async function GET() {
  const results: string[] = []

  for (const tenant of TENANTS) {
    try {
      // Delete existing seed messages for this tenant
      const { error: deleteError } = await supabaseAdmin
        .from('messages')
        .delete()
        .eq('tenant_id', tenant.id)
        .not('to_phone', 'is', null)

      if (deleteError) console.error(`Delete error for ${tenant.name}:`, deleteError)

      // Get people with students → accounts join
      const { data: people, error: peopleError } = await supabaseAdmin
        .from('people')
        .select(`
          id, first_name, last_name, phone,
          students (
            account_id,
            accounts ( id, name, phone, email )
          )
        `)
        .eq('tenant_id', tenant.id)
        .limit(200)

      if (peopleError) {
        results.push(`${tenant.name}: Error fetching contacts — ${peopleError.message}`)
        continue
      }

      let inserted = 0

      for (const conv of tenant.conversations) {
        const person = people.find(
          p =>
            p.first_name?.toLowerCase() === conv.match.first.toLowerCase() &&
            p.last_name?.toLowerCase() === conv.match.last.toLowerCase()
        )

        if (!person) {
          console.log(`${tenant.name}: ${conv.match.first} ${conv.match.last} not found`)
          continue
        }

        const student = (person as any).students?.[0] || {}
        const account = student.accounts || {}
        const accountPhone: string | null = account.phone || null

        let otherPhone = (accountPhone && accountPhone !== person.phone)
          ? accountPhone
          : person.phone

        // Fallback: if no phone at all, generate a synthetic one so conversations still appear
        if (!otherPhone) {
          const hash = person.id?.replace(/-/g, '').slice(0, 10) || '0000000000'
          otherPhone = `+1${hash}`
          console.log(`${tenant.name}: using synthetic phone ${otherPhone} for ${person.first_name} ${person.last_name}`)
        }

        const now = Date.now()
        for (const msg of conv.messages) {
          const { error } = await supabaseAdmin.from('messages').insert({
            tenant_id: tenant.id,
            contact_id: person.id,
            direction: msg.dir,
            channel: 'sms',
            body: msg.body,
            status: msg.dir === 'outbound' ? 'delivered' : 'received',
            twilio_sid: `SM${Math.random().toString(36).substring(2, 12)}`,
            to_phone: msg.dir === 'outbound' ? otherPhone : STUDIO_PHONE,
            from_phone: msg.dir === 'outbound' ? STUDIO_PHONE : otherPhone,
            created_at: new Date(now - msg.minsAgo * 60 * 1000).toISOString(),
          })
          if (error) console.error(`Insert error for ${person.first_name}:`, error)
          else inserted++
        }
      }

      results.push(`${tenant.name}: ${inserted} messages seeded`)
    } catch (err) {
      results.push(`${tenant.name}: Error — ${(err as Error).message}`)
    }
  }

  return NextResponse.json({
    success: true,
    results,
    note: 'Inbox data populated for all academies. Switch between tenants to see different conversations.',
  })
}