import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { parseCSV, ParsedContact } from '@/lib/csv-parser';

// Helper for normalization, mirroring the client-side logic
const normalizePhone = (phone: string | null | undefined): string | null => {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, '');
    if (digits.length === 10) digits = `1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return null;
};
const normalizeEmail = (email: string | null | undefined): string | null => {
    if (!email) return null;
    return email.trim().toLowerCase();
};

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .order('last_name', { ascending: true });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        const { csv } = await request.json();
        if (!csv) {
            return NextResponse.json({ error: 'No CSV data provided' }, { status: 400 });
        }
        
        const parsedContacts = await parseCSV(csv);

        const { data: existingContacts, error: selectError } = await supabaseAdmin
            .from('contacts')
            .select('*');
        if (selectError) throw selectError;

        const phoneMap = new Map(existingContacts.map(c => [normalizePhone(c.phone), c]));
        const emailMap = new Map(existingContacts.map(c => [normalizeEmail(c.email), c]));
        const nameMap = new Map(existingContacts.map(c => [`${c.first_name} ${c.last_name}`.toLowerCase(), c]));

        let createdCount = 0;
        let updatedCount = 0;
        const toInsert = [];
        const toUpdate = [];

        for (const contact of parsedContacts) {
            const normPhone = normalizePhone(contact.phone);
            const normEmail = normalizeEmail(contact.email);
            const normName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
            
            let existing = (normPhone && phoneMap.get(normPhone)) || 
                           (normEmail && emailMap.get(normEmail)) || 
                           nameMap.get(normName);

            if (existing) {
                const merged = { ...existing };
                (Object.keys(contact) as (keyof typeof contact)[]).forEach(key => {
    if (contact[key] !== null && contact[key] !== undefined) {
        (merged as any)[key] = contact[key];
    }
});
                toUpdate.push(merged);
            } else {
                toInsert.push(contact);
            }
        }

        if (toInsert.length > 0) {
            const { error } = await supabaseAdmin.from('contacts').insert(toInsert);
            if (error) throw error;
            createdCount = toInsert.length;
        }

        if (toUpdate.length > 0) {
            for (const contact of toUpdate) {
                const { error } = await supabaseAdmin
                    .from('contacts')
                    .update(contact)
                    .eq('id', contact.id);
                if (error) console.warn(`Failed to update contact ${contact.id}:`, error.message);
                else updatedCount++;
            }
        }
        
        return NextResponse.json({
            message: 'Import successful',
            created: createdCount,
            updated: updatedCount,
        });

    } catch (error) {
        console.error('Import failed:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}