import Papa from 'papaparse'

export interface FieldMapping {
  csv_column: string
  field_key: string
  field_label?: string
  field_type?: string
  is_core?: boolean
  confidence?: string
}

export interface ParsedContact {
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  account_holder_name?: string | null
  account_holder_email?: string | null
  account_holder_phone?: string | null
  external_id?: string | null
  date_of_birth?: string | null
  instructor?: string | null
  last_attended?: string | null
  session_date?: string | null
  attendance_status?: string | null
  tags?: string[]
  instrument?: string | null
  service_type?: string | null
  program?: string | null
  plan_name?: string | null
  session_name?: string | null
  band_name?: string | null
  lesson_day?: string | null
  lesson_time?: string | null
  client_status?: string | null
}

type CsvRow = Record<string, string>

type CsvType = 'attendance' | 'subscriptions' | 'transactions'

const ATTENDED_STATUSES = new Set(['attended', 'present', 'attend', 'arrived', 'checked in', 'check-in', 'check in'])
const LATE_STATUSES = new Set(['late', 'late arrival'])
const ABSENT_STATUSES = new Set(['absent', 'absence', 'missed', 'unexcused', 'excused'])
const NO_SHOW_STATUSES = new Set(['no show', 'no-show', 'noshow'])
const CANCELLED_STATUSES = new Set(['cancelled', 'canceled', 'cancelled late', 'canceled late'])

/** Normalize an attendance status string to a canonical value, or null. */
export function normalizeAttendanceStatus(value: string | null | undefined): string | null {
  if (!value) return null
  const s = String(value).trim().toLowerCase()
  if (!s || s === '-' || s === '—') return null
  if (ATTENDED_STATUSES.has(s)) return 'attended'
  if (LATE_STATUSES.has(s)) return 'late'
  if (ABSENT_STATUSES.has(s)) return 'absent'
  if (NO_SHOW_STATUSES.has(s)) return 'no_show'
  if (CANCELLED_STATUSES.has(s)) return 'cancelled'
  return s
}

/** Whether a normalized status counts as the student having attended. */
export function isAttendedStatus(status: string | null | undefined): boolean {
  const s = normalizeAttendanceStatus(status)
  return s === 'attended' || s === 'late'
}

/** Parse a session date into YYYY-MM-DD, handling '8/1/2026 9:00:00 AM' and ISO formats. */
export function parseSessionDate(value: string | null | undefined): string | null {
  if (!value) return null
  const s = String(value).trim()
  if (!s) return null
  const slash = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slash) return `${slash[3]}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`
  const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

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

function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null
  const t = raw.trim()
  if (!t || t === '-' || t === '—' || ['n/a', 'none', 'null'].includes(t.toLowerCase())) return null
  return t
}

function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/)
  const first_name = parts[0] || ''
  const last_name = parts.slice(1).join(' ') || ''
  return { first_name, last_name }
}

function detectServiceType(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('band') || lower.includes('101') || lower.includes('rock city')) return 'band'
  if (lower.includes('semi-private') || lower.includes('semi private')) return 'semi-private'
  if (lower.includes('group') || lower.includes('kids n keys')) return 'group'
  return 'private'
}

/** Extract a band/ensemble name from a class/session value, stripping any
 *  trailing day/time schedule (e.g. "Rock City - SAT 9:30 AM" -> "Rock City")
 *  and "(Makeup)" modifiers. */
function deriveBandName(value: string | null | undefined): string | null {
  if (!value) return null
  let t = value.trim()
  if (!t) return null
  t = t.replace(/\s*-\s*(mon|tue|wed|thu|fri|sat|sun)\s+\d{1,2}:\d{2}\s*(am|pm)/i, '')
  t = t.replace(/\s*\([^)]*make\s?up[^)]*\)/i, '')
  return t.trim() || null
}

const INSTRUMENTS = [
  'guitar', 'bass', 'drums', 'drum', 'voice', 'vocal', 'piano', 'keys', 'keyboard',
  'violin', 'trumpet', 'trombone', 'ukulele', 'flute', 'rock', 'band', 'kids',
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
    if (lower.indexOf(day) !== -1) {
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
      row[key].split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => {
        if (!tags.includes(t)) tags.push(t)
      })
    }
  }
  return tags
}

function isBlank(value: string | null | undefined): boolean {
  return value == null || String(value).trim() === '' || String(value).trim() === '-' || String(value).trim() === '—'
}

// ─────────────────────────────────────────────────────────────
// Mapping-driven extraction (generic — any school, any columns)
// ─────────────────────────────────────────────────────────────

// Canonical field keys the importer understands. Aliases broaden what the
// field-inference LLM may have returned.
const FIELD_ALIASES: Record<string, string[]> = {
  first_name: ['first_name', 'first name', 'given name'],
  last_name: ['last_name', 'last name', 'surname', 'family name'],
  full_name: ['full_name', 'full name', 'name', 'client_name', 'client name', 'student_name', 'student name', 'member_name', 'member name'],
  email: ['email', 'client_email', 'client email'],
  phone: ['phone', 'client_phone', 'client phone'],
  account_holder_name: ['account_holder_name', 'account holder name', 'accountmanager 1 name', 'accountmanager name', 'account manager name', 'payer name', 'parent name', 'guardian name', 'primary contact name'],
  account_holder_email: ['account_holder_email', 'account holder email', 'accountmanager 1 email', 'accountmanager email', 'account manager email', 'payer email', 'payer_email', 'account email', 'parent email', 'guardian email'],
  account_holder_phone: ['account_holder_phone', 'account holder phone', 'accountmanager 1 phone 1', 'accountmanager 1 phone', 'accountmanager phone', 'account manager phone', 'payer phone', 'payer_phone', 'parent phone', 'guardian phone'],
  external_id: ['external_id', 'external id', 'client_id', 'client id', 'member_id', 'member id', 'customer_id', 'customer id'],
  instructor: ['instructor', 'teacher', 'staff_name', 'staff name', 'coach'],
  program: ['program', 'service_name', 'service name', 'class_name', 'class name', 'service', 'appt/class name'],
  instrument: ['instrument'],
  service_type: ['service_type', 'service type', 'class type', 'class_type'],
  plan_name: ['plan_name', 'plan name', 'plan'],
  session_name: ['session_name', 'session name', 'session'],
  band_name: ['band_name', 'band name', 'ensemble', 'class', 'class name', 'band'],
  lesson_day: ['lesson_day', 'lesson day', 'day', 'schedule day'],
  lesson_time: ['lesson_time', 'lesson time', 'time'],
  session_date: ['session_date', 'session date', 'start_date', 'start date', 'date', 'class date', 'class_date', 'attendance date'],
  attendance_status: ['attendance_status', 'attendance status', 'attendance'],
  client_status: ['client_status', 'client status', 'status', 'membership status'],
  date_of_birth: ['date_of_birth', 'date of birth', 'dob', 'birthday', 'birth date'],
  tag: ['tag', 'tags', 'client tags'],
}

function buildFieldMap(mappings: FieldMapping[]): Map<string, string> {
  const fieldToColumn = new Map<string, string>()
  for (const m of mappings) {
    if (!m.csv_column || !m.field_key) continue
    const key = m.field_key.trim().toLowerCase()
    if (!fieldToColumn.has(key)) fieldToColumn.set(key, m.csv_column.trim())
  }
  return fieldToColumn
}

function resolveColumn(fieldToColumn: Map<string, string>, canonical: string): string | null {
  for (const alias of FIELD_ALIASES[canonical] || [canonical]) {
    const col = fieldToColumn.get(alias)
    if (col) return col
  }
  return null
}

function pickValue(row: CsvRow, fieldToColumn: Map<string, string>, canonical: string): string | null {
  const col = resolveColumn(fieldToColumn, canonical)
  if (!col) return null
  const v = row[col]
  return isBlank(v) ? null : String(v).trim()
}

function parseCSVWithMappings(rows: CsvRow[], mappings: FieldMapping[]): ParsedContact[] {
  const fieldToColumn = buildFieldMap(mappings)
  const contacts: ParsedContact[] = []

  for (const row of rows) {
    // Name: prefer full_name (split), else first_name + last_name
    let first_name = ''
    let last_name = ''
    const fullName = pickValue(row, fieldToColumn, 'full_name')
    if (fullName) {
      ;({ first_name, last_name } = splitName(fullName))
    } else {
      first_name = pickValue(row, fieldToColumn, 'first_name') || ''
      last_name = pickValue(row, fieldToColumn, 'last_name') || ''
    }
    if (!first_name && !last_name) continue

    const sessionDate = parseSessionDate(pickValue(row, fieldToColumn, 'session_date'))
    const attendanceStatus = normalizeAttendanceStatus(pickValue(row, fieldToColumn, 'attendance_status'))

    // Tags (all mapped tag columns, plus legacy 'Client Tags' columns)
    const tags = toTags(row)
    for (const [key, col] of fieldToColumn) {
      if ((key === 'tag' || key.startsWith('tag_')) && row[col] && !isBlank(row[col])) {
        row[col].split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => {
          if (!tags.includes(t)) tags.push(t)
        })
      }
    }

    const program = pickValue(row, fieldToColumn, 'program')
    const planName = pickValue(row, fieldToColumn, 'plan_name')
    const sessionName = pickValue(row, fieldToColumn, 'session_name')
    const explicitInstrument = pickValue(row, fieldToColumn, 'instrument')
    const serviceName = program || planName || sessionName || ''

    // Instrument/service detection: use explicit fields when present, else infer
    // from the program/plan/session names and tags.
    let instrument = explicitInstrument
    if (!instrument) {
      const tagInstrument = tags.find((t) => INSTRUMENTS.includes(t.toLowerCase()))
      instrument = tagInstrument
        ? tagInstrument.charAt(0).toUpperCase() + tagInstrument.slice(1)
        : serviceName
          ? detectInstrument(serviceName)
          : null
    }

    const explicitServiceType = pickValue(row, fieldToColumn, 'service_type')
    const serviceType = explicitServiceType
      ? explicitServiceType.toLowerCase()
      : serviceName
        ? detectServiceType(serviceName)
        : null

    const lessonDay = pickValue(row, fieldToColumn, 'lesson_day')
      || (sessionName ? detectLessonDay(sessionName) : null)
    const lessonTime = pickValue(row, fieldToColumn, 'lesson_time')
      || (sessionName ? detectLessonTime(sessionName) : null)

    const clientStatusRaw = pickValue(row, fieldToColumn, 'client_status')

    contacts.push({
      first_name,
      last_name,
      email: normalizeEmail(pickValue(row, fieldToColumn, 'email')),
      phone: normalizePhone(pickValue(row, fieldToColumn, 'phone')),
      account_holder_name: pickValue(row, fieldToColumn, 'account_holder_name'),
      account_holder_email: normalizeEmail(pickValue(row, fieldToColumn, 'account_holder_email')),
      account_holder_phone: normalizePhone(pickValue(row, fieldToColumn, 'account_holder_phone')),
      external_id: pickValue(row, fieldToColumn, 'external_id'),
      date_of_birth: pickValue(row, fieldToColumn, 'date_of_birth'),
      instructor: pickValue(row, fieldToColumn, 'instructor'),
      session_date: sessionDate,
      attendance_status: attendanceStatus,
      last_attended: sessionDate && isAttendedStatus(attendanceStatus) ? sessionDate : null,
      tags: tags.length > 0 ? tags : undefined,
      instrument: instrument || null,
      service_type: serviceType,
      program: program || null,
      plan_name: planName,
      session_name: sessionName,
      band_name: serviceType === 'band'
        ? (deriveBandName(pickValue(row, fieldToColumn, 'band_name')) || deriveBandName(sessionName))
        : null,
      lesson_day: lessonDay,
      lesson_time: lessonTime,
      client_status: clientStatusRaw ? clientStatusRaw.toLowerCase() : null,
    })
  }

  return contacts
}

// ─────────────────────────────────────────────────────────────
// Legacy fallback (hardcoded Headliner-ish columns) — kept for
// direct API callers that don't send mappings.
// ─────────────────────────────────────────────────────────────

function parseCSVLegacy(rows: CsvRow[], headers: string[]): ParsedContact[] {
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
      account_holder_name: null,
      account_holder_email: null,
      account_holder_phone: null,
    }

    contact.date_of_birth = row['Date of Birth'] || row['DOB'] || row['Birthday'] || row['Birth Date'] || null
    contact.external_id = row['Client Id'] || row['Client ID'] || null

    if (type === 'attendance') {
      const sessionDate = parseSessionDate(row['Start Date'])
      const attendanceStatus = normalizeAttendanceStatus(row['Attendance'])
      // The student is "Client Name"; the billing/family account holder is the AccountManager.
      contact.email = normalizeEmail(row['Client Email'])
      contact.phone = null
      contact.account_holder_name = row['AccountManager 1 name'] || row['AccountManager 2 name'] || null
      contact.account_holder_email = normalizeEmail(row['AccountManager 1 email'] || row['AccountManager 2 email'])
      contact.account_holder_phone = normalizePhone(row['AccountManager 1 phone 1'] || row['AccountManager 1 phone 2'] || row['AccountManager 2 phone 1'])
      contact.instructor = row['Staff Name'] || null
      contact.session_date = sessionDate
      contact.attendance_status = attendanceStatus
      contact.last_attended = sessionDate && isAttendedStatus(attendanceStatus) ? sessionDate : null
      contact.tags = toTags(row)
      const serviceName = row['Service Name'] || row['Appt/Class Name'] || ''
      contact.program = serviceName || null
      contact.service_type = serviceName ? detectServiceType(serviceName) : null
      contact.instrument = serviceName ? detectInstrument(serviceName) : null
      contact.plan_name = row['Plan'] || null
      contact.band_name = contact.service_type === 'band' ? deriveBandName(row['Appt/Class Name']) : null
    } else if (type === 'subscriptions') {
      // Student = "Client Name"; account holder = "Payer". Subscriptions carry no phone.
      contact.email = normalizeEmail(row['Client Email'])
      contact.phone = null
      contact.account_holder_name = row['Payer Name'] || null
      contact.account_holder_email = normalizeEmail(row['Payer Email'])
      contact.account_holder_phone = null
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
      contact.band_name = contact.service_type === 'band' ? deriveBandName(row['Class']) : null
    } else {
      // Transactions are payer-level (no "Client Name"), so no student person is built here.
      contact.email = null
      contact.phone = null
      contact.account_holder_name = row['Payer Name'] || null
      contact.account_holder_email = normalizeEmail(row['Payer Email'])
      contact.account_holder_phone = normalizePhone(row['Payer Phone'])
    }

    contacts.push(contact)
  }

  return contacts
}

export async function parseCSV(csv: string, mappings?: FieldMapping[]): Promise<ParsedContact[]> {
  const result = Papa.parse<CsvRow>(csv, { header: true, skipEmptyLines: true })
  const rows = result.data
  if (rows.length === 0) return []

  if (mappings && mappings.length > 0) {
    return parseCSVWithMappings(rows, mappings)
  }

  const headers = result.meta.fields || Object.keys(rows[0] || {})
  return parseCSVLegacy(rows, headers)
}
