import Papa from 'papaparse';

const normalizePhoneNumber = (phone: string | null | undefined): string | null => {
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

export interface ParsedContact {
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  service_type?: string;
  instrument?: string;
  lesson_day?: string;
  lesson_time?: string;
  instructor?: string;
  plan_name?: string;
  session_name?: string;
  client_status?: string;
  last_attended?: string;
  tags?: string[];
}

const detectCSVType = (headers: string[]): 'attendance' | 'subscriptions' | 'transactions' | 'unknown' => {
  const h = headers.map(x => x.toLowerCase());
  if (h.includes('client name') && h.includes('staff name')) return 'attendance';
  if (h.includes('plan name') && h.includes('primary staff name')) return 'subscriptions';
  if (h.includes('payer phone') && h.includes('payer email')) return 'transactions';
  return 'unknown';
};

const detectServiceType = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('101') || lower.includes('rock city') || lower.includes('band 101')) return 'band';
  if (lower.includes('semi-private') || lower.includes('semi private')) return 'semi-private';
  if (lower.includes('group') || lower.includes('kids n keys')) return 'group';
  return 'private';
};

const detectInstrument = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('guitar')) return 'Guitar';
  if (lower.includes('bass')) return 'Bass';
  if (lower.includes('drums') || lower.includes('drum')) return 'Drums';
  if (lower.includes('voice') || lower.includes('vocal')) return 'Voice';
  if (lower.includes('piano') || lower.includes('keys') || lower.includes('keyboard')) return 'Piano';
  if (lower.includes('violin')) return 'Violin';
  if (lower.includes('trumpet')) return 'Trumpet';
  if (lower.includes('trombone')) return 'Trombone';
  if (lower.includes('ukulele')) return 'Ukulele';
  if (lower.includes('flute')) return 'Flute';
  if (lower.includes('rock')) return 'Rock';
  if (lower.includes('band')) return 'Band';
  if (lower.includes('kids') || lower.includes('kid')) return 'Kids';
  return name.split(' ')[0];
};

export const parseCSV = (csvText: string): Promise<ParsedContact[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const csvType = detectCSVType(headers);
        if (csvType === 'unknown') return reject(new Error('Unknown CSV file type.'));

        const contacts = (results.data as any[]).map(row => {
          const contact: ParsedContact = { first_name: '', last_name: '' };

          if (csvType === 'attendance') {
            const parts = (row['Client Name'] || '').split(' ');
            contact.first_name = parts[0] || '';
            contact.last_name = parts.slice(1).join(' ') || '';
            contact.email = normalizeEmail(row['Client Email']);
            contact.phone = normalizePhoneNumber(row['AccountManager 1 phone 1']);
            contact.instructor = row['Staff Name'];
            contact.last_attended = row['Start Date'];
            contact.tags = Object.keys(row)
              .filter(key => key.startsWith('Client Tags') && row[key])
              .map(key => row[key]);
            const serviceName = row['Service Name'] || '';
            contact.instrument = detectInstrument(serviceName);
            contact.service_type = detectServiceType(serviceName);

          } else if (csvType === 'subscriptions') {
            const parts = (row['Client Name'] || '').split(' ');
            contact.first_name = parts[0] || '';
            contact.last_name = parts.slice(1).join(' ') || '';
            contact.email = normalizeEmail(row['Payer Email']);
            contact.plan_name = row['Plan Name'];
            contact.instructor = row['Primary Staff Name'];
            contact.client_status = row['Client Status']?.toLowerCase();
            const planName = row['Plan Name'] || '';
            contact.instrument = detectInstrument(planName);
            contact.service_type = detectServiceType(planName);
            const session = row['Session'] || '';
            const sessionLower = session.toLowerCase();
            const dayMatch = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].find(d => sessionLower.includes(d));
            contact.lesson_day = dayMatch || undefined;
            const timeMatch = session.match(/\d{1,2}:\d{2}\s*(am|pm)/i);
            contact.lesson_time = timeMatch ? timeMatch[0] : undefined;
            contact.session_name = session;

          } else if (csvType === 'transactions') {
            const parts = (row['Client Name'] || '').split(' ');
            contact.first_name = parts[0] || '';
            contact.last_name = parts.slice(1).join(' ') || '';
            contact.email = normalizeEmail(row['Payer Email']);
            contact.phone = normalizePhoneNumber(row['Payer Phone']);
          }

          return contact;
        });

        resolve(contacts.filter(c => c.first_name && c.last_name));
      },
      error: (error: Error) => reject(error),
    });
  });
};