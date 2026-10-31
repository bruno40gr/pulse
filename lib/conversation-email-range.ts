/** Inclusive calendar dates, translated to exclusive epoch bounds for Gmail. */
export function currentEmailMonth(now = new Date()) {
  const year = now.getFullYear(), month = now.getMonth()
  const date = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return { from: date(1), to: date(new Date(year, month + 1, 0).getDate()) }
}

export function emailDateRange(from: string | null, to: string | null, now = new Date()) {
  const defaults = currentEmailMonth(now)
  const start = from || defaults.from, end = to || defaults.to
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  if (!valid(start) || !valid(end) || start > end) throw new Error('Choose a valid email date range.')
  return { from: start, to: end, start: Date.parse(`${start}T00:00:00Z`), end: Date.parse(`${end}T00:00:00Z`) + 86400000 }
}

export function isLeadEmailContact(person: { profileType?: string | null; aliases?: string[] }) {
  return person.profileType === 'lead' || !!person.aliases?.some(alias => alias.startsWith('lead:'))
}