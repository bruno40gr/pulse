export function validBirthday(value: string, today = new Date().toISOString().slice(0, 10)): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > today) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function birthdayAge(value: string, today = new Date().toISOString().slice(0, 10)): number | null {
  if (!validBirthday(value, today)) return null
  return Number(today.slice(0, 4)) - Number(value.slice(0, 4)) - (today.slice(5) < value.slice(5) ? 1 : 0)
}

export function leadBirthdayProblem(payload: Record<string, unknown>): string | null {
  const values = [payload.date_of_birth, ...(Array.isArray(payload.siblings) ? payload.siblings.map(item => item && typeof item === 'object' ? item.date_of_birth : null) : [])]
  return values.some(value => value != null && value !== '' && (typeof value !== 'string' || !validBirthday(value)))
    ? 'Birthday must be a valid date between January 1, 1900 and today.' : null
}
