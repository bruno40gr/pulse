import { smsDestination } from '@/lib/communication-recipients'
import type { MockRecipient } from '@/lib/prototype-messaging'

export type SmsPickerGroup = { id: string; name: string; phone: string; members: MockRecipient[] }

/** Group destinations, never names; missing numbers must not combine unrelated people. */
export function smsPickerGroups(people: MockRecipient[]): SmsPickerGroup[] {
  const groups = new Map<string, SmsPickerGroup>()
  for (const person of people) {
    const key = smsDestination(person.phone) || `person:${person.id}`
    const existing = groups.get(key)
    if (existing) existing.members.push(person)
    else groups.set(key, { id: person.id, name: person.name, phone: person.phone, members: [person] })
  }
  return [...groups.values()]
}

export function smsPickerMatches(person: MockRecipient, query: string) {
  const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
  const term = normalize(query)
  return [person.name, person.student, person.phone].some(value => normalize(value).includes(term))
}

/** Preserve the chosen student's ID while counting/sending each destination once. */
export function uniqueSmsPickerSelection(people: MockRecipient[], ids: string[]): string[] {
  const selected = new Set(ids)
  return smsPickerGroups(people).flatMap(group => {
    const member = group.members.find(person => selected.has(person.id))
    return member ? [member.id] : []
  })
}