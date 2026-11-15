import { activeInquiry, type ExplorerInquiry, type ExplorerPerson } from './event-explorer'

export function isOpenBandOpportunity(inquiry: ExplorerInquiry) {
  return activeInquiry(inquiry) && Boolean(inquiry.bandId || inquiry.serviceType === 'band' || /\b(band|ensemble)\b/i.test(inquiry.interest))
}

/** Simulation only: one person keeps their real account across independent opportunities. */
export function createOpportunities(inquiries: ExplorerInquiry[], people: ExplorerPerson[], input: {
  personIds: string[]; interest: string; category: string; origin: NonNullable<ExplorerInquiry['origin']>;
  programId?: string; proposalId?: string; bandId?: string; serviceType?: 'band'; source?: string; followUp: string; note: string;
}) {
  if (!input.interest.trim()) throw new Error('Select or enter a program or service.')
  const ids = [...new Set(input.personIds)]
  if (!ids.length || ids.some(id => !people.some(person => person.id === id))) throw new Error('Select existing people first.')
  const next = [...inquiries]
  const reused: string[] = []
  const bandIntent = Boolean(input.bandId || input.serviceType === 'band' || /\b(band|ensemble)\b/i.test(input.interest))
  for (const personId of ids) {
    const match = next.find(item => item.personId === personId && activeInquiry(item) && (
      input.bandId ? item.bandId === input.bandId : bandIntent ? !item.bandId && !item.proposalId && isOpenBandOpportunity(item) : input.proposalId ? item.proposalId === input.proposalId : !item.bandId && !item.proposalId && (input.programId ? item.programId === input.programId : item.category === input.category && item.interest.trim().toLowerCase() === input.interest.trim().toLowerCase())
    ))
    if (match) { reused.push(match.id); continue }
    const person = people.find(person => person.id === personId)!
    next.push({ id: crypto.randomUUID(), personId, accountId: person.accountId || person.id, programId: input.programId, proposalId: input.proposalId, bandId: input.bandId, serviceType: bandIntent ? 'band' : input.serviceType,
      interest: input.interest.trim(), category: input.category, origin: input.origin, source: input.source || undefined,
      stage: 'New', followUp: input.followUp, note: input.note, createdAt: new Date().toISOString() })
  }
  return { inquiries: next, reused, created: next.length - inquiries.length }
}