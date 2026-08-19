const DEMO_TENANTS = new Set([
  '00000000-0000-0000-0000-000000000002', // Sacramento Martial Arts
  '00000000-0000-0000-0000-000000000003', // Kumon Learning Center
])

type AccountHolder = {
  name: string | null
  phone: string | null
  email: string | null
  relationship: string | null
  is_primary: boolean
}

type DemoContactShape = {
  id: string
  tenant_id?: string | null
  first_name: string
  last_name: string
  phone?: string | null
  email?: string | null
  client_status?: string | null
  last_attended?: string | null
  message_routing?: string | null
  is_minor?: boolean | null
  account_holder_name?: string | null
  account_holder_phone?: string | null
  account_holder_email?: string | null
  family_name?: string | null
  account_holders?: AccountHolder[]
  notes?: string | null
  notes_history?: Array<{ text: string, timestamp: string }>
  student_notes_history?: Array<{ text: string, timestamp: string }>
}

const ADULT_RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Grandparent']

function isDemoTenant(tenantId?: string | null) {
  return Boolean(tenantId && DEMO_TENANTS.has(tenantId))
}

function hashValue(...parts: string[]) {
  return parts.join('|').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
}

function buildPhone(seed: number) {
  const base = (1000000 + (seed % 9000000)).toString().padStart(7, '0')
  return `+1916${base}`
}

function buildAdultName(lastName: string, variant: number) {
  const firstNames = ['Elena', 'Marcus', 'Daniel', 'Rachel', 'David', 'Hana', 'Mei', 'Alina']
  return `${firstNames[variant % firstNames.length]} ${lastName}`
}

function buildAdultEmail(name: string) {
  return `${name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@example.com`
}

function ensureAccountHolders(contact: DemoContactShape) {
  const seed = hashValue(contact.first_name, contact.last_name, contact.id)
  const lastName = contact.last_name || 'Family'
  const existing = Array.isArray(contact.account_holders) ? [...contact.account_holders] : []
  const primaryName = contact.account_holder_name || existing[0]?.name || buildAdultName(lastName, seed)
  const primaryPhone = contact.account_holder_phone || existing[0]?.phone || buildPhone(seed + 11)
  const primaryEmail = contact.account_holder_email || existing[0]?.email || buildAdultEmail(primaryName)

  const primary: AccountHolder = {
    name: primaryName,
    phone: primaryPhone,
    email: primaryEmail,
    relationship: existing[0]?.relationship || ADULT_RELATIONSHIPS[seed % ADULT_RELATIONSHIPS.length],
    is_primary: true,
  }

  if (!contact.is_minor) {
    return [primary]
  }

  const shouldHaveSecondHolder = seed % 3 !== 0
  if (!shouldHaveSecondHolder) return [primary]

  const secondaryName = existing[1]?.name || buildAdultName(lastName, seed + 5)
  return [
    primary,
    {
      name: secondaryName,
      phone: existing[1]?.phone || buildPhone(seed + 29),
      email: existing[1]?.email || buildAdultEmail(secondaryName),
      relationship: existing[1]?.relationship || ADULT_RELATIONSHIPS[(seed + 1) % ADULT_RELATIONSHIPS.length],
      is_primary: false,
    },
  ]
}

function ensureHistory(
  existing: Array<{ text: string, timestamp: string }> | undefined,
  entries: string[],
  seed: number,
) {
  if (Array.isArray(existing) && existing.length > 0) return existing
  return entries.slice(0, 2 + (seed % 2)).map((text, index) => ({
    text,
    timestamp: new Date(Date.now() - (index + 1) * 1000 * 60 * 60 * (18 + seed % 24)).toISOString(),
  }))
}

export function enrichDemoContact<T extends DemoContactShape>(contact: T): T {
  if (!isDemoTenant(contact.tenant_id)) return contact

  const seed = hashValue(contact.first_name, contact.last_name, contact.id)
  const accountHolders = ensureAccountHolders(contact)
  const studentPhone = contact.phone || (!contact.is_minor ? buildPhone(seed) : null)
  const accountHolderPhone = contact.account_holder_phone || accountHolders[0]?.phone || buildPhone(seed + 41)
  const accountHolderName = contact.account_holder_name || accountHolders[0]?.name || null
  const accountHolderEmail = contact.account_holder_email || accountHolders[0]?.email || null

  const studentNotes = [
    `${contact.first_name} responded well to recent coaching and is engaged in lessons.`,
    contact.is_minor
      ? `Guardian mentioned schedule is steadier this month and ${contact.first_name} should be on time going forward.`
      : `${contact.first_name} asked about next-step programming and seems open to follow-up outreach.`,
    contact.last_attended
      ? `Last attended ${contact.last_attended}; staff should keep momentum going with a personal check-in.`
      : `Attendance needs a gentle follow-up so the team can confirm current availability.`,
  ]

  const internalNotes = [
    contact.is_minor
      ? `Use account-holder routing first; family prefers clear logistical details and short follow-ups.`
      : `Okay to message directly; contact has been responsive and appreciates concise outreach.`,
    `Keep this record demo-ready: populated contact paths, recent notes, and consistent program metadata.`,
    `Staff context: this account has enough history to feel mature during walkthroughs and search demos.`,
  ]

  return {
    ...contact,
    phone: studentPhone,
    account_holder_name: accountHolderName,
    account_holder_phone: accountHolderPhone,
    account_holder_email: accountHolderEmail,
    family_name: contact.family_name || accountHolderName,
    message_routing: contact.message_routing || (contact.is_minor ? 'account_holder' : 'student'),
    account_holders: accountHolders,
    notes: contact.notes || internalNotes[0],
    student_notes_history: ensureHistory(contact.student_notes_history, studentNotes, seed),
    notes_history: ensureHistory(contact.notes_history, internalNotes, seed + 7),
  }
}