import Papa from 'papaparse'

export interface ParsedContact {
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  date_of_birth?: string | null
  instructor?: string | null
  last_attended?: string | null
  tags?: string[]
  instrument?: string | null
  service_type?: string | null
  plan_name?: string | null
  session_name?: string | null
  lesson_day?: string | null
  lesson_time?: string | null
  client_status?: string | null
}

type CsvRow = Record<string, string>

type CsvType = 'attendance' | 'subscriptions' | 'transactions'

function detectType(headers: string[]): CsvType {
  if (headers.includes('Client Name') && headers.includes('Staff Name')) return 'attendance'
  if (headers.includes('Plan Name') && headers.includes('Primary Staff Name')) return 'subscriptions'
  if (headers.includes('Payer Phone') && headers.includes('Payer Email')) return 'transactions'
  return 'attendance'
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return '1' + digits
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits
  return null
}

function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/)
  const first_name = parts[0] || ''
  const last_name = parts.slice(1).join(' ') || ''
  return { first_name, last_name }
}

function detectServiceType(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('101') || lower.includes('rock city')) return 'band'
  if (lower.includes('semi-private') || lower.includes('semi private')) return 'semi-private'
  if (lower.includes('group') || lower.includes('kids n keys')) return 'group'
  return 'private'
}

const INSTRUMENTS = [
  'guitar',
  'bass',
  'drums',
  'drum',
  'voice',
  'vocal',
  'piano',
  'keys',
  'keyboard',
  'violin',
  'trumpet',
  'trombone',
  'ukulele',
  'flute',
  'rock',
  'band',
  'kids',
]

function detectInstrument(name: string): string {
  const lower = name.toLowerCase()
  for (const inst of INSTRUMENTS) {
    if (lower.includes(inst)) {
      return inst.charAt(0).toUpperCase() + inst.slice(1)
    }
  }
  const firstWord = name.trim().split(/\s+/)[0] || ''
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1)
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function detectLessonDay(session: string): string | null {
  const lower = session.toLowerCase()
  for (const day of DAYS) {
    const idx = lower.indexOf(day)
    if (idx !== -1) {
      return day.charAt(0).toUpperCase() + day.slice(1)
    }
  }
  return null
}

function detectLessonTime(session: string): string | null {
  const match = session.match(/\d{1,2}:\d{2}\s*(am|pm)/i)
  return match ? match[0].trim() : null
}

function toTags(row: CsvRow): string[] {
  const tags: string[] = []
  for (const key of Object.keys(row)) {
    if (key.startsWith('Client Tags') && row[key]) {
      row[key]
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
        .forEach(t => {
          if (!tags.includes(t)) tags.push(t)
        })
    }
  }
  return tags
}

export async function parseCSV(csv: string): Promise<ParsedContact[]> {
  const result = Papa.parse<CsvRow>(csv, { header: true, skipEmptyLines: true })
  const rows = result.data
  if (rows.length === 0) return []

  const headers = result.meta.fields || Object.keys(rows[0] || {})
  const type = detectType(headers)

  const contacts: ParsedContact[] = []

  for (const row of rows) {
    const { first_name, last_name } = splitName(row['Client Name'] || '')
    if (!first_name || !last_name) continue

    const contact: ParsedContact = {
      first_name,
      last_name,
      email: null,
      phone: null,
    }

    // Detect date of birth from common header names
    contact.date_of_birth = row['Date of Birth'] || row['DOB'] || row['Birthday'] || row['Birth Date'] || null

    if (type === 'attendance') {
      contact.email = row['Client Email'] || null
      contact.phone = normalizePhone(row['AccountManager 1 phone 1'])
      contact.instructor = row['Staff Name'] || null
      contact.last_attended = row['Start Date'] || null
      contact.tags = toTags(row)
      const serviceName = row['Service Name'] || ''
      contact.service_type = serviceName ? detectServiceType(serviceName) : null
      contact.instrument = serviceName ? detectInstrument(serviceName) : null
    } else if (type === 'subscriptions') {
      contact.email = row['Payer Email'] || null
      contact.instructor = row['Primary Staff Name'] || null
      contact.plan_name = row['Plan Name'] || null
      const planName = row['Plan Name'] || ''
      contact.service_type = planName ? detectServiceType(planName) : null
      contact.instrument = planName ? detectInstrument(planName) : null
      const session = row['Session'] || ''
      contact.session_name = session || null
      contact.lesson_day = session ? detectLessonDay(session) : null
      contact.lesson_time = session ? detectLessonTime(session) : null
      contact.client_status = row['Client Status'] ? row['Client Status'].toLowerCase() : null
    } else {
      contact.email = row['Payer Email'] || null
      contact.phone = normalizePhone(row['Payer Phone'])
    }

    contacts.push(contact)
  }

  return contacts
}