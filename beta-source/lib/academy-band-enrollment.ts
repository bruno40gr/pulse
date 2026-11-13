import type { BandPrice } from './academy-band-pricing'
import { createOpportunities } from './academy-opportunities'
import type { AcademyGroup } from './academy-explorer'
import type { ExplorerInquiry, ExplorerPerson } from './event-explorer'
import type { ProgramTask, AvailabilityBlock } from './academy-program-proposals'

/** Local-only checkout receipt. Never contains card numbers or provider credentials. */
export type BandEnrollment = {
  pricing?: BandPrice; id: string; institution: 'music'; studentId: string; bandId: string; step: number;
  policyAccepted: boolean; subscriptionAccepted: boolean; payerName: string; payerEmail: string;
  monthlyPrice: string; paymentMethod: '' | 'demo_card'; paymentStatus: 'pending' | 'succeeded';
  subscriptionStatus: 'pending' | 'active' | 'not_applicable'; completedAt?: string; chooseBandLater?: boolean; requestId?: string; instrument?: string;
}
export const bandEnrollmentSteps = ['Student', 'Band', 'Policies', 'Payment & subscription']
export function newBandEnrollment(studentId = '', bandId = ''): BandEnrollment {
  return { id: crypto.randomUUID(), institution: 'music', studentId, bandId, step: 0, policyAccepted: false, subscriptionAccepted: false, payerName: '', payerEmail: '', monthlyPrice: '', paymentMethod: '', paymentStatus: 'pending', subscriptionStatus: 'pending' }
}
export function addBandCandidates(group: AcademyGroup, ids: string[], people: ExplorerPerson[], inquiries: ExplorerInquiry[]) {
  if (ids.some(id => !people.some(person => person.id === id))) throw new Error('Choose an existing student.')
  const pending = [...new Set([...(group.pendingMemberIds || []), ...ids])].filter(id => !group.memberIds.includes(id))
  const next = [...inquiries]
  for (const id of pending) {
    if (next.some(inquiry => inquiry.bandId === group.id && inquiry.personId === id && !['Lost', 'Spam', 'Ghosted us'].includes(inquiry.stage))) continue
    const person = people.find(person => person.id === id)!
    next.push({ id: crypto.randomUUID(), bandId: group.id, personId: id, accountId: person.accountId || id, interest: group.name, category: 'Program inquiries', origin: 'staff_initiated', stage: 'New', followUp: '', note: '', createdAt: new Date().toISOString() })
  }
  return { group: { ...group, pendingMemberIds: pending }, inquiries: next }
}
/** Scheduling includes unpaid candidates, without activating membership or billing. */
export function scheduleBandParticipants(group: AcademyGroup, ids: string[], schedule: string, people: ExplorerPerson[], inquiries: ExplorerInquiry[]) {
  const result = addBandCandidates(group, ids, people, inquiries)
  return { ...result, group: { ...result.group, schedule } }
}
export function bandEnrollmentError(draft: BandEnrollment, step: number, people: ExplorerPerson[], groups: AcademyGroup[]) {
  if (!people.some(person => person.id === draft.studentId)) return 'Choose a student.'
  if (step === 0) return ''
  const group = groups.find(group => group.id === draft.bandId)
  if (!group && !(draft.chooseBandLater && !draft.bandId)) return 'Choose a band.'
  if (group?.memberIds.includes(draft.studentId)) return 'This student is already a confirmed member.'
  if (draft.instrument !== undefined && !draft.instrument.trim()) return 'Choose an instrument for this student.'
  if (step === 1) return ''
  if (!draft.policyAccepted) return 'Agree to the band policies before continuing.'
  if (step === 2) return ''
  if (!draft.payerName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.payerEmail.trim())) return 'Enter the payer’s name and a valid email.'
  if (!draft.monthlyPrice.trim() || !Number.isFinite(Number(draft.monthlyPrice)) || Number(draft.monthlyPrice) <= 0) return 'Set a monthly subscription price.'
  if (draft.paymentMethod !== 'demo_card') return 'Choose a payment method.'
  if (!draft.subscriptionAccepted) return draft.pricing?.recurring === false ? 'Authorize the payment.' : 'Authorize the recurring subscription.'
  return ''
}
export function availableBandSubscriptions(enrollments: BandEnrollment[], studentId: string) {
  return enrollments.filter(record => record.studentId === studentId && !record.bandId && record.completedAt && record.paymentStatus === 'succeeded' && record.subscriptionStatus === 'active' && record.policyAccepted && record.subscriptionAccepted)
}

/** Assign coverage once, without charging again or borrowing sibling coverage. */
export function assignBandSubscription(subscriptionId: string, studentId: string, bandId: string, enrollments: BandEnrollment[], groups: AcademyGroup[], people: ExplorerPerson[], inquiries: ExplorerInquiry[]) {
  if (!availableBandSubscriptions(enrollments, studentId).some(record => record.id === subscriptionId)) throw new Error('Choose an available subscription for this student.')
  const group = groups.find(group => group.id === bandId)
  if (!group) throw new Error('Choose a band.')
  if (group.memberIds.includes(studentId)) throw new Error('This student is already a confirmed member.')
  const pending = addBandCandidates(group, [studentId], people, inquiries)
  return {
    enrollments: enrollments.map(record => record.id === subscriptionId ? { ...record, bandId, chooseBandLater: false } : record),
    groups: groups.map(band => band.id === bandId ? { ...pending.group, memberInstruments: { ...band.memberInstruments, ...(enrollments.find(record => record.id === subscriptionId)?.instrument ? { [studentId]: enrollments.find(record => record.id === subscriptionId)!.instrument! } : {}) }, memberIds: [...band.memberIds, studentId], pendingMemberIds: pending.group.pendingMemberIds.filter(id => id !== studentId) } : band),
    inquiries: pending.inquiries.map(inquiry => inquiry.bandId === bandId && inquiry.personId === studentId && !['Lost', 'Spam', 'Ghosted us'].includes(inquiry.stage) ? { ...inquiry, stage: 'Enrolled' as const, updatedAt: new Date().toISOString() } : inquiry),
    people: people.map(person => person.id === studentId ? { ...person, enrolled: true, customer: true, roles: [...new Set([...person.roles, 'Student'])] } : person),
  }
}

/** Validate before simulated payment; a paid subscription can await its one band. */
export function completeBandEnrollment(draft: BandEnrollment, groups: AcademyGroup[], people: ExplorerPerson[], inquiries: ExplorerInquiry[]) {
  if (draft.completedAt) throw new Error('This enrollment has already been completed.')
  const error = bandEnrollmentError(draft, 3, people, groups)
  if (error) throw new Error(error)
  const receipt: BandEnrollment = { ...draft, paymentStatus: 'succeeded', subscriptionStatus: draft.pricing?.recurring === false ? 'not_applicable' : 'active', completedAt: new Date().toISOString() }
  if (!draft.bandId) return { receipt, groups, inquiries: createOpportunities(inquiries, people, { personIds: [draft.studentId], interest: 'Band program', category: 'Program inquiries', serviceType: 'band', origin: 'staff_initiated', followUp: '', note: '' }).inquiries, people: people.map(person => person.id === draft.studentId ? { ...person, enrolled: true, customer: true, roles: [...new Set([...person.roles, 'Student'])] } : person) }
  const band = groups.find(group => group.id === draft.bandId)!
  const pending = addBandCandidates(band, [draft.studentId], people, inquiries)
  return {
    receipt,
    groups: groups.map(group => group.id === band.id ? { ...pending.group, memberInstruments: { ...group.memberInstruments, ...(draft.instrument ? { [draft.studentId]: draft.instrument } : {}) }, memberIds: [...group.memberIds, draft.studentId], pendingMemberIds: pending.group.pendingMemberIds.filter(id => id !== draft.studentId) } : group),
    inquiries: pending.inquiries.map(inquiry => inquiry.bandId === band.id && inquiry.personId === draft.studentId && !['Lost', 'Spam', 'Ghosted us'].includes(inquiry.stage) ? { ...inquiry, stage: 'Enrolled' as const, updatedAt: receipt.completedAt } : inquiry),
    people: people.map(person => person.id === draft.studentId ? { ...person, enrolled: true, customer: true, roles: [...new Set([...person.roles, 'Student'])] } : person),
  }
}
/** Intersect submitted windows, never creating bookings or confirming memberships. */
export function bandAvailabilityOverlap(tasks: ProgramTask[], ids: string[]): AvailabilityBlock[] {
  if (!ids.length || ids.some(id => !tasks.some(task => task.studentId === id && task.submitted))) return []
  let windows = tasks.find(task => task.studentId === ids[0])!.blocks
  for (const id of ids.slice(1)) {
    const blocks = tasks.find(task => task.studentId === id)!.blocks
    windows = windows.flatMap(window => blocks.flatMap(block => {
      const from = window.from > block.from ? window.from : block.from, to = window.to < block.to ? window.to : block.to
      return window.date === block.date && from < to ? [{ id: `${window.id}:${block.id}`, date: window.date, from, to }] : []
    }))
  }
  return windows
}
/** Never infer subscription instruments from inquiry interests or a sibling. */
export function defaultBandInstrument(person?: ExplorerPerson) {
  return person?.subscriptions?.find(subscription => subscription.status === 'active' && subscription.recurring)?.instrument || ''
}
