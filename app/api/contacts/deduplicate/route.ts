import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  const { data: contacts, error: fetchError } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .order('id', { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const duplicatesMap = new Map<string, any[]>();
  for (const contact of contacts) {
    const key = `${contact.first_name?.toLowerCase()}-${contact.last_name?.toLowerCase()}`;
    if (!duplicatesMap.has(key)) duplicatesMap.set(key, []);
    duplicatesMap.get(key)!.push(contact);
  }

  let mergedCount = 0;
  for (const [, duplicateContacts] of duplicatesMap.entries()) {
    if (duplicateContacts.length > 1) {
      const mergedContact = { ...duplicateContacts[0] };
      for (let i = 1; i < duplicateContacts.length; i++) {
        for (const field in duplicateContacts[i]) {
          if (duplicateContacts[i][field] !== null && mergedContact[field] === null) {
            mergedContact[field] = duplicateContacts[i][field];
          }
        }
      }

      await supabaseAdmin.from('contacts').update(mergedContact).eq('id', mergedContact.id);

      const idsToDelete = duplicateContacts.slice(1).map((c) => c.id);
      if (idsToDelete.length > 0) {
        await supabaseAdmin.from('contacts').delete().in('id', idsToDelete);
        mergedCount += idsToDelete.length;
      }
    }
  }

  return NextResponse.json({ message: 'Deduplication complete', mergedCount });
}