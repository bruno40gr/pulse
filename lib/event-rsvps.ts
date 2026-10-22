export const RSVP_EVENT_ID = 'headliner-grand-opening'
export const RSVP_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export type EventRsvp = {
  id: string
  name: string
  email: string
  party_size: number
  created_at: string
}

export type RsvpWorkspace = {
  parties: number
  guests: number
  rows: EventRsvp[]
}

export function validateEventRsvp(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const partySize = typeof body.partySize === 'number' || typeof body.partySize === 'string' ? Number(body.partySize) : NaN
  if (!name || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 99) return null
  return { name, email, partySize }
}

export function rsvpCsv(rows: EventRsvp[]) {
  function cell(value: string | number) {
    let text = String(value)
    // Prevent spreadsheet formula execution, including after leading whitespace.
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }
  return [['Name', 'Email', 'Party size', 'Submitted at'], ...rows.map(row => [row.name, row.email, row.party_size, row.created_at])]
    .map(row => row.map(cell).join(',')).join('\r\n')
}